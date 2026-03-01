// packages/updater/src/executor.ts
/**
 * Git pull + deploy executor
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface ExecuteOptions {
  branch: string;
  repoRoot: string;
  onLog: (message: string) => void;
}

export interface ExecuteResult {
  success: boolean;
  version?: string;
  error?: string;
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  onLog: (msg: string) => void
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd });

    child.stdout?.on('data', (data) => {
      onLog(data.toString());
    });

    child.stderr?.on('data', (data) => {
      onLog(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `Exit code: ${code}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

function runDetached(
  cmd: string,
  args: string[],
  cwd: string,
  onLog: (msg: string) => void
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const logDir = path.join(cwd, 'release-data', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, `deploy-${Date.now()}.log`);
    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');

    onLog(`Deploy log: ${logFile}`);

    const child = spawn(cmd, args, {
      cwd,
      detached: true,
      stdio: ['ignore', out, err],
    });

    child.unref();

    // Give it a moment to start, then report success
    setTimeout(() => {
      onLog(`Deploy started (pid: ${child.pid}, detached)`);
      resolve({ success: true });
    }, 1000);

    child.on('error', (e) => {
      resolve({ success: false, error: e.message });
    });
  });
}

export async function executeUpdate(options: ExecuteOptions): Promise<ExecuteResult> {
  const { branch, repoRoot, onLog } = options;

  // Step 1: git fetch
  onLog(`[1/4] git fetch origin...`);
  const fetchResult = await runCommand('git', ['fetch', 'origin'], repoRoot, onLog);
  if (!fetchResult.success) {
    return { success: false, error: `git fetch failed: ${fetchResult.error}` };
  }

  // Step 2: git checkout
  onLog(`[2/4] git checkout ${branch}...`);
  const checkoutResult = await runCommand('git', ['checkout', branch], repoRoot, onLog);
  if (!checkoutResult.success) {
    return { success: false, error: `git checkout failed: ${checkoutResult.error}` };
  }

  // Step 3: git pull
  onLog(`[3/4] git pull origin ${branch}...`);
  const pullResult = await runCommand('git', ['pull', 'origin', branch], repoRoot, onLog);
  if (!pullResult.success) {
    return { success: false, error: `git pull failed: ${pullResult.error}` };
  }

  // Step 4: pnpm deploy:release (detached - survives parent restart)
  onLog(`[4/4] pnpm deploy:release (detached)...`);
  const deployResult = await runDetached('pnpm', ['deploy:release'], repoRoot, onLog);
  if (!deployResult.success) {
    return { success: false, error: `deploy failed: ${deployResult.error}` };
  }

  onLog(`✓ Update complete`);
  return { success: true };
}
