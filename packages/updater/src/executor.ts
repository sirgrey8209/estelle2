// packages/updater/src/executor.ts
/**
 * Git pull + build + PM2 restart executor
 *
 * Update flow:
 * 1. git fetch + checkout + pull
 * 2. pnpm install
 * 3. pnpm build
 * 4. Copy dist to release/
 * 5. Read version + environment config
 * 6. PM2 delete/start via ecosystem file
 * 7. pm2 save
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const isWindows = process.platform === 'win32';

export interface ExecuteOptions {
  branch: string;
  repoRoot: string;
  onLog: (message: string) => void;
  /** Master restarts Relay + Pylon, Agent restarts Pylon only */
  isMaster?: boolean;
  /** Environment config file for this machine (e.g., 'environments.office.json') */
  environmentFile?: string;
}

export interface ExecuteResult {
  success: boolean;
  version?: string;
  error?: string;
}

/** Expand ~ to home directory */
function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME || process.env.USERPROFILE || '', p.slice(2));
  }
  return p;
}

/** Local log function - writes to both callback and local file */
function createLogger(repoRoot: string, onLog: (msg: string) => void) {
  const logDir = path.join(repoRoot, 'release-data', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, `update-${Date.now()}.log`);
  const stream = fs.createWriteStream(logFile, { flags: 'a' });

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    stream.write(line + '\n');
    onLog(msg); // Also send to master
  };

  const close = () => stream.end();

  log(`Log file: ${logFile}`);
  return { log, close, logFile };
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  onLog: (msg: string) => void
): Promise<{ success: boolean; output?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: true, windowsHide: true });
    let output = '';

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      onLog(text.trim());
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      output += text;
      onLog(text.trim());
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, error: `Exit code: ${code}`, output });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

export async function executeUpdate(options: ExecuteOptions): Promise<ExecuteResult> {
  const { branch, repoRoot, onLog, isMaster = false, environmentFile } = options;
  const { log, close } = createLogger(repoRoot, onLog);

  try {
    const role = isMaster ? 'Master' : 'Agent';
    log(`=== Update started (${role}) ===`);

    // Step 1: git fetch
    log(`[1/8] git fetch origin...`);
    const fetchResult = await runCommand('git', ['fetch', 'origin'], repoRoot, log);
    if (!fetchResult.success) {
      log(`✗ git fetch failed: ${fetchResult.error}`);
      return { success: false, error: `git fetch failed: ${fetchResult.error}` };
    }

    // Step 2: git checkout
    log(`[2/8] git checkout ${branch}...`);
    const checkoutResult = await runCommand('git', ['checkout', branch], repoRoot, log);
    if (!checkoutResult.success) {
      log(`✗ git checkout failed: ${checkoutResult.error}`);
      return { success: false, error: `git checkout failed: ${checkoutResult.error}` };
    }

    // Step 3: git pull
    log(`[3/8] git pull origin ${branch}...`);
    const pullResult = await runCommand('git', ['pull', 'origin', branch], repoRoot, log);
    if (!pullResult.success) {
      log(`✗ git pull failed: ${pullResult.error}`);
      return { success: false, error: `git pull failed: ${pullResult.error}` };
    }

    // Step 4: pnpm install (for new dependencies)
    log(`[4/8] pnpm install...`);
    const installResult = await runCommand('pnpm', ['install'], repoRoot, log);
    if (!installResult.success) {
      log(`✗ pnpm install failed: ${installResult.error}`);
      return { success: false, error: `pnpm install failed: ${installResult.error}` };
    }

    // Step 5: pnpm build
    log(`[5/8] pnpm build...`);
    const buildResult = await runCommand('pnpm', ['build'], repoRoot, log);
    if (!buildResult.success) {
      log(`✗ pnpm build failed: ${buildResult.error}`);
      return { success: false, error: `pnpm build failed: ${buildResult.error}` };
    }

    // Step 6: Copy build artifacts to release/
    log(`[6/8] Copying build artifacts to release/...`);
    const releaseDir = path.join(repoRoot, 'release');
    const pkgDir = path.join(repoRoot, 'packages');

    // Copy core/dist (required by relay and pylon via workspace symlinks)
    const coreDistSrc = path.join(pkgDir, 'core', 'dist');
    const coreDistDest = path.join(releaseDir, 'core', 'dist');
    fs.mkdirSync(coreDistDest, { recursive: true });
    fs.cpSync(coreDistSrc, coreDistDest, { recursive: true });
    log(`  core/dist → release/core/dist`);

    // Copy updater/dist (required by pylon via workspace symlinks)
    const updaterDistSrc = path.join(pkgDir, 'updater', 'dist');
    const updaterDistDest = path.join(releaseDir, 'updater', 'dist');
    fs.mkdirSync(updaterDistDest, { recursive: true });
    fs.cpSync(updaterDistSrc, updaterDistDest, { recursive: true });
    log(`  updater/dist → release/updater/dist`);

    // Always copy pylon/dist
    const pylonDistSrc = path.join(pkgDir, 'pylon', 'dist');
    const pylonDistDest = path.join(releaseDir, 'pylon', 'dist');
    fs.mkdirSync(pylonDistDest, { recursive: true });
    fs.cpSync(pylonDistSrc, pylonDistDest, { recursive: true });
    log(`  pylon/dist → release/pylon/dist`);

    if (isMaster) {
      // Copy relay/dist
      const relayDistSrc = path.join(pkgDir, 'relay', 'dist');
      const relayDistDest = path.join(releaseDir, 'relay', 'dist');
      fs.mkdirSync(relayDistDest, { recursive: true });
      fs.cpSync(relayDistSrc, relayDistDest, { recursive: true });
      log(`  relay/dist → release/relay/dist`);

      // Copy relay/public
      const relayPublicSrc = path.join(pkgDir, 'relay', 'public');
      const relayPublicDest = path.join(releaseDir, 'relay', 'public');
      fs.mkdirSync(relayPublicDest, { recursive: true });
      fs.cpSync(relayPublicSrc, relayPublicDest, { recursive: true });
      log(`  relay/public → release/relay/public`);
    }

    // Ensure @estelle workspace deps in release/node_modules/ as fallback
    // (pnpm workspace symlinks through release/*/node_modules can be unreliable)
    const releaseEstelleDir = path.join(releaseDir, 'node_modules', '@estelle');
    for (const dep of ['core', 'updater']) {
      const depDest = path.join(releaseEstelleDir, dep);
      fs.rmSync(depDest, { recursive: true, force: true });
      fs.mkdirSync(depDest, { recursive: true });
      fs.cpSync(path.join(pkgDir, dep, 'package.json'), path.join(depDest, 'package.json'));
      fs.cpSync(path.join(pkgDir, dep, 'dist'), path.join(depDest, 'dist'), { recursive: true });
    }
    log(`  @estelle/{core,updater} → release/node_modules/`);

    // Read version from config/version.json
    const versionPath = path.join(repoRoot, 'config', 'version.json');
    let version = 'dev';
    try {
      const versionJson = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
      version = versionJson.version;
      log(`  Version: ${version}`);
    } catch {
      log('  Warning: could not read config/version.json, using "dev"');
    }

    // Load environment config
    let envConfig: Record<string, any> | null = null;
    if (environmentFile) {
      const envPath = path.join(repoRoot, 'config', environmentFile);
      try {
        envConfig = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
        log(`  Environment: ${environmentFile}`);
      } catch {
        log(`  Warning: could not read ${environmentFile}`);
      }
    }

    // Step 7: PM2 services
    log(`[7/8] PM2 services...`);

    // Build ecosystem config
    const apps: Array<Record<string, unknown>> = [];

    const pylonPm2Name = envConfig?.pylon?.pm2Name || 'estelle-pylon';
    const pylonEnv: Record<string, string> = {
      ESTELLE_VERSION: version,
    };

    if (envConfig) {
      pylonEnv.ESTELLE_ENV_CONFIG = JSON.stringify({
        envId: envConfig.envId,
        pylon: {
          pylonIndex: (envConfig.pylon as any).pylonIndex,
          relayUrl: (envConfig.pylon as any).relayUrl,
          configDir: expandPath((envConfig.pylon as any).configDir),
          credentialsBackupDir: expandPath((envConfig.pylon as any).credentialsBackupDir),
          dataDir: path.resolve(repoRoot, (envConfig.pylon as any).dataDir),
          mcpPort: (envConfig.pylon as any).mcpPort,
          defaultWorkingDir: expandPath((envConfig.pylon as any).defaultWorkingDir),
        },
      });
    }

    apps.push({
      name: pylonPm2Name,
      script: 'dist/bin.js',
      cwd: path.join(repoRoot, 'release', 'pylon'),
      env: pylonEnv,
    });

    if (isMaster && envConfig?.relay) {
      const relayPm2Name = (envConfig.relay as any).pm2Name;
      if (relayPm2Name) {
        const relayPort = (envConfig.relay as any).port || 8080;
        apps.unshift({
          name: relayPm2Name,
          script: 'dist/bin.js',
          cwd: path.join(repoRoot, 'release', 'relay'),
          env: {
            PORT: String(relayPort),
            STATIC_DIR: path.join(repoRoot, 'release', 'relay', 'public'),
          },
        });
      }
    }

    // Delete existing processes (ignore failures - may not exist)
    for (const app of apps) {
      log(`  Stopping ${app.name}...`);
      await runCommand('pm2', ['delete', app.name as string], repoRoot, log);
    }

    // Write ecosystem file and start
    const ecosystemPath = path.join(repoRoot, 'release', 'ecosystem.config.cjs');
    const ecosystemContent = `module.exports = ${JSON.stringify({ apps }, null, 2)};`;
    fs.writeFileSync(ecosystemPath, ecosystemContent);
    log(`  Starting services via ecosystem config...`);

    const startResult = await runCommand('pm2', ['start', ecosystemPath], repoRoot, log);
    if (!startResult.success) {
      log(`✗ pm2 start failed: ${startResult.error}`);
      return { success: false, error: `pm2 start failed: ${startResult.error}` };
    }

    // Step 8: pm2 save
    log(`[8/8] pm2 save...`);
    await runCommand('pm2', ['save'], repoRoot, log);

    log(`✓ Update complete (${version})`);
    return { success: true, version };
  } finally {
    close();
  }
}
