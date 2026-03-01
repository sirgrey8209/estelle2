#!/usr/bin/env node
// packages/updater/src/cli.ts
/**
 * estelle-updater CLI
 *
 * Usage:
 *   npx estelle-updater              # Start as master or agent (auto-detect)
 *   npx estelle-updater trigger all master
 *   npx estelle-updater trigger 5.223.72.58 hotfix
 */
import { start, startMaster } from './index.js';
import { loadConfig, parseMasterIp, getDefaultConfigPath } from './config.js';
import { getExternalIp } from './ip.js';
import path from 'path';
import fs from 'fs';

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

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Start mode (auto-detect master/agent)
    await start();
    return;
  }

  if (args[0] === 'trigger') {
    // Trigger mode: trigger <target> <branch>
    const target = args[1] || 'all';
    const branch = args[2] || 'master';

    const configPath = getDefaultConfigPath();
    const config = loadConfig(configPath);
    const masterIp = parseMasterIp(config.masterUrl);
    const myIp = getExternalIp();
    const repoRoot = findRepoRoot();

    if (myIp !== masterIp) {
      console.error(`[CLI] Error: trigger command can only be run on master (${masterIp})`);
      process.exit(1);
    }

    console.log(`[CLI] Triggering update: target=${target}, branch=${branch}`);

    const url = new URL(config.masterUrl);
    const master = startMaster({
      port: parseInt(url.port, 10),
      whitelist: config.whitelist,
      repoRoot,
      myIp,
    });

    // Wait a bit for agents to connect, then trigger
    setTimeout(async () => {
      await master.triggerUpdate(target, branch, (msg) => {
        console.log(msg);
      });
      console.log(`[CLI] Update complete`);
      process.exit(0);
    }, 2000);

    return;
  }

  // Help
  console.log(`Usage:
  npx estelle-updater              Start as master or agent (auto-detect)
  npx estelle-updater trigger <target> <branch>

Examples:
  npx estelle-updater trigger all master
  npx estelle-updater trigger 5.223.72.58 hotfix-123
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
