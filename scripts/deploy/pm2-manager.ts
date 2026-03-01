/**
 * PM2 Manager for Deploy Process
 *
 * Provides functions to manage PM2 services during deployment:
 * - stopService: Stops and removes a PM2 process by name
 * - startService: Starts a new PM2 process with configuration
 * - saveServices: Persists the current PM2 process list
 *
 * This module is part of the cross-platform deploy script system,
 * handling PM2 process lifecycle management with environment
 * variable support for both Linux and macOS environments.
 */
import { execSync } from 'child_process';

export interface PM2ServiceConfig {
  name: string;
  script: string;
  cwd: string;
  env?: Record<string, string>;
}

export interface PM2Result {
  success: boolean;
  error?: string;
}

export function stopService(name: string): void {
  try {
    execSync(`pm2 delete ${name}`, { stdio: 'pipe' });
  } catch {
    // Ignore errors (service might not exist)
  }
}

export function startService(config: PM2ServiceConfig): PM2Result {
  try {
    const envStr = config.env
      ? Object.entries(config.env)
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ')
      : '';

    const cmd = envStr
      ? `${envStr} pm2 start ${config.script} --name ${config.name} --cwd ${config.cwd}`
      : `pm2 start ${config.script} --name ${config.name} --cwd ${config.cwd}`;

    execSync(cmd, { stdio: 'inherit', shell: true });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export function saveServices(): void {
  try {
    execSync('pm2 save', { stdio: 'pipe' });
  } catch {
    // Ignore errors
  }
}
