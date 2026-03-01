// packages/updater/src/executor.ts
/**
 * Git pull + deploy executor
 */
import { spawn } from 'child_process';

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
    const child = spawn(cmd, args, { cwd, shell: true });

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

export async function executeUpdate(options: ExecuteOptions): Promise<ExecuteResult> {
  const { branch, repoRoot, onLog } = options;

  // Step 1: git fetch
  onLog(`git fetch origin...`);
  const fetchResult = await runCommand('git', ['fetch', 'origin'], repoRoot, onLog);
  if (!fetchResult.success) {
    return { success: false, error: `git fetch failed: ${fetchResult.error}` };
  }

  // Step 2: git checkout
  onLog(`git checkout ${branch}...`);
  const checkoutResult = await runCommand('git', ['checkout', branch], repoRoot, onLog);
  if (!checkoutResult.success) {
    return { success: false, error: `git checkout failed: ${checkoutResult.error}` };
  }

  // Step 3: git pull
  onLog(`git pull origin ${branch}...`);
  const pullResult = await runCommand('git', ['pull', 'origin', branch], repoRoot, onLog);
  if (!pullResult.success) {
    return { success: false, error: `git pull failed: ${pullResult.error}` };
  }

  // Step 4: pnpm deploy:release
  onLog(`pnpm deploy:release...`);
  const deployResult = await runCommand('pnpm', ['deploy:release'], repoRoot, onLog);
  if (!deployResult.success) {
    return { success: false, error: `deploy failed: ${deployResult.error}` };
  }

  onLog(`Update complete`);
  return { success: true };
}
