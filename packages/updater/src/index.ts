// packages/updater/src/index.ts
/**
 * estelle-updater main entry point
 *
 * Auto-detects role (master vs agent) by comparing local IP to masterUrl.
 */
import { loadConfig, parseMasterIp, getDefaultConfigPath } from './config.js';
import { getExternalIp } from './ip.js';
import { startMaster, type MasterInstance } from './master.js';
import { startAgent } from './agent.js';
import path from 'path';
import fs from 'fs';

/** Flush-enabled log for PM2 compatibility */
function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

export { startMaster, type MasterInstance } from './master.js';
export { startAgent } from './agent.js';
export { executeUpdate } from './executor.js';
export { loadConfig, parseMasterIp, getDefaultConfigPath } from './config.js';
export { getExternalIp } from './ip.js';
export * from './types.js';

function findRepoRoot(): string {
  let dir = process.cwd();
  let prevDir = '';
  while (dir !== prevDir) {  // Cross-platform: stops when dirname no longer changes
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.workspaces) {
        return dir;
      }
    }
    prevDir = dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export async function start(): Promise<void> {
  log(`[Updater] Starting...`);

  const configPath = getDefaultConfigPath();
  log(`[Updater] Loading config from: ${configPath}`);

  const config = loadConfig(configPath);
  const masterIp = parseMasterIp(config.masterUrl);
  const myIp = getExternalIp();
  const repoRoot = findRepoRoot();

  log(`[Updater] My IP: ${myIp}, Master IP: ${masterIp}`);

  if (myIp === masterIp) {
    // Master mode
    log(`[Updater] Starting as MASTER`);
    const url = new URL(config.masterUrl);
    startMaster({
      port: parseInt(url.port, 10),
      whitelist: config.whitelist,
      repoRoot,
      myIp,
    });
  } else {
    // Agent mode
    log(`[Updater] Starting as AGENT`);
    startAgent({
      masterUrl: config.masterUrl,
      repoRoot,
      myIp,
    });
  }
}

// Auto-start if run directly (works with both direct execution and PM2)
// Exclude cli.ts to prevent double-start when CLI imports this module
const isMainModule = !process.argv[1]?.includes('cli.') &&
                     (process.argv[1]?.includes('index.js') ||
                      process.argv[1]?.includes('start.cjs'));

if (isMainModule) {
  start().catch((err) => {
    console.error('[Updater] Fatal error:', err);
    process.exit(1);
  });
}
