// packages/updater/src/agent.ts
/**
 * Agent mode - connects to master and executes deploy commands
 */
import WebSocket from 'ws';
import { executeUpdate } from './executor.js';
import type { UpdateCommand, LogMessage, ResultMessage } from './types.js';

/** Flush-enabled log for PM2 compatibility */
function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function logError(message: string, err?: unknown): void {
  process.stderr.write(`${message}${err ? ` ${err}` : ''}\n`);
}

export interface AgentOptions {
  masterUrl: string;
  repoRoot: string;
  myIp?: string;
}

/**
 * Safely send a message over WebSocket
 * Handles connection state and errors gracefully
 */
function safeSend(ws: WebSocket, msg: object): void {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  } catch (err) {
    logError(`[Agent] Failed to send message:`, err);
  }
}

export function startAgent(options: AgentOptions): WebSocket {
  const { masterUrl, repoRoot, myIp = 'unknown' } = options;

  log(`[Agent] Connecting to master: ${masterUrl}`);
  const ws = new WebSocket(masterUrl);

  ws.on('open', () => {
    log(`[Agent] Connected to master`);
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString()) as UpdateCommand;

      if (msg.type === 'update') {
        // Check if this command is for us
        if (msg.target !== 'all' && msg.target !== myIp) {
          return; // Not for us
        }

        log(`[Agent] Received update command: branch=${msg.branch}`);

        const result = await executeUpdate({
          branch: msg.branch,
          repoRoot,
          onLog: (message) => {
            const logMsg: LogMessage = { type: 'log', ip: myIp, message };
            safeSend(ws, logMsg);
          },
        }).catch((err) => ({
          success: false as const,
          version: undefined,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));

        const resultMsg: ResultMessage = {
          type: 'result',
          ip: myIp,
          success: result.success,
          version: result.version,
          error: result.error,
        };
        safeSend(ws, resultMsg);
      }
    } catch (err) {
      logError(`[Agent] Error processing message:`, err);
    }
  });

  ws.on('close', () => {
    log(`[Agent] Disconnected from master, reconnecting in 5s...`);
    setTimeout(() => startAgent(options), 5000);
  });

  ws.on('error', (err) => {
    logError(`[Agent] WebSocket error:`, err);
  });

  return ws;
}
