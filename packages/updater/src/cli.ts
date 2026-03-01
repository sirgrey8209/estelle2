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
import { start } from './index.js';
import { loadConfig, parseMasterIp, getDefaultConfigPath } from './config.js';
import { WebSocket } from 'ws';
import type { UpdateCommand } from './types.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Start mode (auto-detect master/agent)
    await start();
    return;
  }

  if (args[0] === 'trigger') {
    // Trigger mode: connect to running master and send command
    const target = args[1] || 'all';
    const branch = args[2] || 'master';

    const configPath = getDefaultConfigPath();
    const config = loadConfig(configPath);

    // Connect to the already-running master as a client
    const httpUrl = config.masterUrl.replace('ws://', 'http://');
    console.log(`[CLI] Connecting to master: ${config.masterUrl}`);

    const ws = new WebSocket(config.masterUrl);

    ws.on('open', () => {
      console.log(`[CLI] Connected. Triggering update: target=${target}, branch=${branch}`);

      const cmd: UpdateCommand = { type: 'update', target, branch };
      ws.send(JSON.stringify(cmd));

      // Wait for response then exit
      setTimeout(() => {
        console.log(`[CLI] Command sent. Check pm2 logs estelle-updater for progress.`);
        ws.close();
        process.exit(0);
      }, 1000);
    });

    ws.on('error', (err) => {
      console.error(`[CLI] Connection failed: ${err.message}`);
      console.error(`[CLI] Is estelle-updater running? Check: pm2 status`);
      process.exit(1);
    });

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
