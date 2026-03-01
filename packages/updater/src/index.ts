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

export { startMaster, type MasterInstance } from './master.js';
export { startAgent } from './agent.js';
export { executeUpdate } from './executor.js';
export { loadConfig, parseMasterIp, getDefaultConfigPath } from './config.js';
export { getExternalIp } from './ip.js';
export * from './types.js';

function findRepoRoot(): string {
  let dir = process.cwd();
  while (dir !== '/') {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.workspaces) {
        return dir;
      }
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export async function start(): Promise<void> {
  const configPath = getDefaultConfigPath();
  console.log(`[Updater] Loading config from: ${configPath}`);

  const config = loadConfig(configPath);
  const masterIp = parseMasterIp(config.masterUrl);
  const myIp = await getExternalIp();
  const repoRoot = findRepoRoot();

  console.log(`[Updater] My IP: ${myIp}, Master IP: ${masterIp}`);

  if (myIp === masterIp) {
    // Master mode
    console.log(`[Updater] Starting as MASTER`);
    const url = new URL(config.masterUrl);
    startMaster({
      port: parseInt(url.port, 10),
      whitelist: config.whitelist,
      repoRoot,
      myIp,
    });
  } else {
    // Agent mode
    console.log(`[Updater] Starting as AGENT`);
    startAgent({
      masterUrl: config.masterUrl,
      repoRoot,
      myIp,
    });
  }
}

// Auto-start if run directly
if (process.argv[1]?.includes('updater')) {
  start().catch(console.error);
}
