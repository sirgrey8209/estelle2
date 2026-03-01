/**
 * Deploy Orchestrator
 *
 * Main entry point for the cross-platform deploy script.
 * Coordinates version generation, TypeScript build, and PM2 service management.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateVersion } from './version.js';
import { build } from './builder.js';
import { stopService, startService, saveServices } from './pm2-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type DeployTarget = 'stage' | 'release';

export interface DeployOptions {
  target: DeployTarget;
  repoRoot?: string;
}

export interface DeployResult {
  success: boolean;
  version?: string;
  error?: string;
}

interface EnvironmentConfig {
  relay: {
    port: number;
    pm2Name: string;
  };
  pylon: {
    pm2Name: string;
    relayUrl: string;
    mcpPort: number;
    configDir: string;
    credentialsBackupDir: string;
    dataDir: string;
    defaultWorkingDir: string;
  };
  envId: number;
}

function log(phase: string, message: string): void {
  console.log(`[${phase}] ${message}`);
}

function logDetail(message: string): void {
  console.log(`  ${message}`);
}

function loadConfig(repoRoot: string, target: DeployTarget): EnvironmentConfig {
  const configPath = path.join(repoRoot, 'config', 'environments.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);
  return config[target];
}

function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME || process.env.USERPROFILE || '', p.slice(2));
  }
  return p;
}

export async function deploy(options: DeployOptions): Promise<DeployResult> {
  const repoRoot = options.repoRoot || path.resolve(__dirname, '..', '..');
  const target = options.target;

  log('Phase 0', 'Loading configuration...');
  const config = loadConfig(repoRoot, target);
  logDetail(`Target: ${target}`);

  // Version
  log('Version', 'Generating build version...');
  const counterPath = path.join(repoRoot, 'config', 'build-counter.json');
  const version = generateVersion(counterPath);
  logDetail(`Version: (${target})${version}`);

  // Build
  log('Phase 1', 'Building TypeScript packages...');
  const buildResult = await build(repoRoot);
  if (!buildResult.success) {
    return { success: false, error: buildResult.error };
  }
  logDetail('TypeScript build completed');

  // Stop services
  log('Phase 2', 'Stopping PM2 services...');
  stopService(config.relay.pm2Name);
  stopService(config.pylon.pm2Name);
  logDetail('Services stopped');

  // Generate version.json for client
  log('Phase 3', 'Generating version.json...');
  const relayPublic = path.join(repoRoot, 'packages', 'relay', 'public');
  if (!fs.existsSync(relayPublic)) {
    fs.mkdirSync(relayPublic, { recursive: true });
  }
  const versionJson = JSON.stringify({
    env: target,
    version,
    buildTime: new Date().toISOString(),
  });
  fs.writeFileSync(path.join(relayPublic, 'version.json'), versionJson);
  logDetail('version.json created');

  // Data directory
  const dataDirName = target === 'release' ? 'release-data' : 'stage-data';
  const dataDir = path.join(repoRoot, dataDirName);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Build ESTELLE_ENV_CONFIG
  const envConfig = JSON.stringify({
    envId: config.envId,
    pylon: {
      relayUrl: config.pylon.relayUrl,
      configDir: expandPath(config.pylon.configDir),
      credentialsBackupDir: expandPath(config.pylon.credentialsBackupDir),
      dataDir: path.resolve(repoRoot, config.pylon.dataDir),
      mcpPort: config.pylon.mcpPort,
      defaultWorkingDir: expandPath(config.pylon.defaultWorkingDir),
    },
  });

  // Start Relay
  log('Phase 4', 'Starting PM2 services...');
  const relayResult = startService({
    name: config.relay.pm2Name,
    script: 'dist/bin.js',
    cwd: path.join(repoRoot, 'packages', 'relay'),
    env: {
      PORT: String(config.relay.port),
      STATIC_DIR: relayPublic,
    },
  });
  if (!relayResult.success) {
    return { success: false, error: `Relay start failed: ${relayResult.error}` };
  }
  logDetail(`Relay started: ${config.relay.pm2Name}`);

  // Start Pylon
  const pylonResult = startService({
    name: config.pylon.pm2Name,
    script: 'dist/bin.js',
    cwd: path.join(repoRoot, 'packages', 'pylon'),
    env: {
      ESTELLE_VERSION: version,
      ESTELLE_ENV_CONFIG: envConfig,
    },
  });
  if (!pylonResult.success) {
    return { success: false, error: `Pylon start failed: ${pylonResult.error}` };
  }
  logDetail(`Pylon started: ${config.pylon.pm2Name}`);

  saveServices();

  log('Done', `Deploy complete: (${target})${version}`);
  return { success: true, version };
}
