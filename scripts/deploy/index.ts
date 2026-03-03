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
  /** Agent mode: deploy Pylon only (Relay is elsewhere) */
  pylonOnly?: boolean;
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
  updater?: {
    pm2Name: string;
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
  const pylonOnly = options.pylonOnly ?? false;

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

  // Copy build artifacts to release/
  log('Phase 1.5', 'Copying build artifacts to release/...');
  const releaseDir = path.join(repoRoot, 'release');
  const pkgDir = path.join(repoRoot, 'packages');

  // Always copy pylon/dist
  const pylonDistSrc = path.join(pkgDir, 'pylon', 'dist');
  const pylonDistDest = path.join(releaseDir, 'pylon', 'dist');
  fs.mkdirSync(pylonDistDest, { recursive: true });
  fs.cpSync(pylonDistSrc, pylonDistDest, { recursive: true });
  logDetail('pylon/dist → release/pylon/dist');

  if (!pylonOnly) {
    // Copy relay/dist
    const relayDistSrc = path.join(pkgDir, 'relay', 'dist');
    const relayDistDest = path.join(releaseDir, 'relay', 'dist');
    fs.mkdirSync(relayDistDest, { recursive: true });
    fs.cpSync(relayDistSrc, relayDistDest, { recursive: true });
    logDetail('relay/dist → release/relay/dist');

    // Copy relay/public
    const relayPublicSrc = path.join(pkgDir, 'relay', 'public');
    const relayPublicDest = path.join(releaseDir, 'relay', 'public');
    fs.mkdirSync(relayPublicDest, { recursive: true });
    fs.cpSync(relayPublicSrc, relayPublicDest, { recursive: true });
    logDetail('relay/public → release/relay/public');
  }

  // Stop services
  log('Phase 2', 'Stopping PM2 services...');
  if (!pylonOnly && config.relay.pm2Name) {
    stopService(config.relay.pm2Name);
  }
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
      pylonIndex: config.pylon.pylonIndex,
      relayUrl: config.pylon.relayUrl,
      configDir: expandPath(config.pylon.configDir),
      credentialsBackupDir: expandPath(config.pylon.credentialsBackupDir),
      dataDir: path.resolve(repoRoot, config.pylon.dataDir),
      mcpPort: config.pylon.mcpPort,
      defaultWorkingDir: expandPath(config.pylon.defaultWorkingDir),
    },
  });

  // Start Relay (only if not pylonOnly and pm2Name is configured)
  log('Phase 4', 'Starting PM2 services...');
  if (!pylonOnly && config.relay.pm2Name) {
    const relayResult = startService({
      name: config.relay.pm2Name,
      script: 'dist/bin.js',
      cwd: path.join(repoRoot, 'release', 'relay'),
      env: {
        PORT: String(config.relay.port),
        STATIC_DIR: path.join(repoRoot, 'release', 'relay', 'public'),
      },
    });
    if (!relayResult.success) {
      return { success: false, error: `Relay start failed: ${relayResult.error}` };
    }
    logDetail(`Relay started: ${config.relay.pm2Name}`);
  } else {
    logDetail(`Relay skipped (pylonOnly=${pylonOnly}, pm2Name=${config.relay.pm2Name || 'none'})`);
  }

  // Start Pylon
  const pylonResult = startService({
    name: config.pylon.pm2Name,
    script: 'dist/bin.js',
    cwd: path.join(repoRoot, 'release', 'pylon'),
    env: {
      ESTELLE_VERSION: version,
      ESTELLE_ENV_CONFIG: envConfig,
    },
  });
  if (!pylonResult.success) {
    return { success: false, error: `Pylon start failed: ${pylonResult.error}` };
  }
  logDetail(`Pylon started: ${config.pylon.pm2Name}`);

  // Note: estelle-updater is NOT restarted here
  // It must stay running to coordinate deployments across machines
  logDetail(`Updater skipped (must stay running for coordination)`);

  saveServices();

  log('Done', `Deploy complete: (${target})${version}`);
  return { success: true, version };
}
