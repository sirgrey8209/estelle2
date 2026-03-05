// packages/updater/src/executor.ts
/**
 * Git pull + build + PM2 restart executor
 *
 * Simple update flow:
 * 1. git fetch + checkout + pull
 * 2. pnpm build
 * 3. Copy dist to release/
 * 4. pm2 restart (Relay + Pylon for Master, Pylon only for Agent)
 *
 * Cross-platform support for logging:
 * - Linux/Mac: spawn with detached + stdio file descriptors (native support)
 * - Windows: spawn wrapper script that handles redirection (Node.js limitation)
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
}

export interface ExecuteResult {
  success: boolean;
  version?: string;
  error?: string;
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
  const { branch, repoRoot, onLog, isMaster = false } = options;
  const { log, close } = createLogger(repoRoot, onLog);

  try {
    const role = isMaster ? 'Master' : 'Agent';
    log(`=== Update started (${role}) ===`);

    // Step 1: git fetch
    log(`[1/7] git fetch origin...`);
    const fetchResult = await runCommand('git', ['fetch', 'origin'], repoRoot, log);
    if (!fetchResult.success) {
      log(`✗ git fetch failed: ${fetchResult.error}`);
      return { success: false, error: `git fetch failed: ${fetchResult.error}` };
    }

    // Step 2: git checkout
    log(`[2/7] git checkout ${branch}...`);
    const checkoutResult = await runCommand('git', ['checkout', branch], repoRoot, log);
    if (!checkoutResult.success) {
      log(`✗ git checkout failed: ${checkoutResult.error}`);
      return { success: false, error: `git checkout failed: ${checkoutResult.error}` };
    }

    // Step 3: git pull
    log(`[3/7] git pull origin ${branch}...`);
    const pullResult = await runCommand('git', ['pull', 'origin', branch], repoRoot, log);
    if (!pullResult.success) {
      log(`✗ git pull failed: ${pullResult.error}`);
      return { success: false, error: `git pull failed: ${pullResult.error}` };
    }

    // Step 4: pnpm install (for new dependencies)
    log(`[4/7] pnpm install...`);
    const installResult = await runCommand('pnpm', ['install'], repoRoot, log);
    if (!installResult.success) {
      log(`✗ pnpm install failed: ${installResult.error}`);
      return { success: false, error: `pnpm install failed: ${installResult.error}` };
    }

    // Step 5: pnpm build
    log(`[5/7] pnpm build...`);
    const buildResult = await runCommand('pnpm', ['build'], repoRoot, log);
    if (!buildResult.success) {
      log(`✗ pnpm build failed: ${buildResult.error}`);
      return { success: false, error: `pnpm build failed: ${buildResult.error}` };
    }

    // Step 6: Copy build artifacts to release/
    log(`[6/7] Copying build artifacts to release/...`);
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

    // Step 7: pm2 restart
    log(`[7/7] pm2 restart...`);

    if (isMaster) {
      // Master: restart both Relay and Pylon
      log(`Restarting estelle-relay...`);
      const relayResult = await runCommand('pm2', ['restart', 'estelle-relay'], repoRoot, log);
      if (!relayResult.success) {
        log(`⚠ estelle-relay restart failed (may not exist): ${relayResult.error}`);
      }

      log(`Restarting estelle-pylon...`);
      const pylonResult = await runCommand('pm2', ['restart', 'estelle-pylon'], repoRoot, log);
      if (!pylonResult.success) {
        log(`✗ estelle-pylon restart failed: ${pylonResult.error}`);
        return { success: false, error: `pm2 restart estelle-pylon failed: ${pylonResult.error}` };
      }
    } else {
      // Agent: restart Pylon only
      log(`Restarting estelle-pylon...`);
      const pylonResult = await runCommand('pm2', ['restart', 'estelle-pylon'], repoRoot, log);
      if (!pylonResult.success) {
        log(`✗ estelle-pylon restart failed: ${pylonResult.error}`);
        return { success: false, error: `pm2 restart estelle-pylon failed: ${pylonResult.error}` };
      }
    }

    log(`✓ Update complete`);
    return { success: true };
  } finally {
    close();
  }
}
