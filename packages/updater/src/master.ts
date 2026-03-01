// packages/updater/src/master.ts
/**
 * Master mode - WebSocket server for coordinating agents
 */
import { WebSocketServer, WebSocket } from 'ws';
import { executeUpdate } from './executor.js';
import type { UpdateCommand, AgentMessage, LogMessage, ResultMessage } from './types.js';

export interface MasterOptions {
  port: number;
  whitelist: string[];
  repoRoot: string;
  myIp: string;
}

interface ConnectedAgent {
  ws: WebSocket;
  ip: string;
}

export interface MasterInstance {
  wss: WebSocketServer;
  agents: Map<string, ConnectedAgent>;
  broadcast: (msg: UpdateCommand) => void;
  triggerUpdate: (target: string, branch: string, onLog?: (msg: string) => void) => Promise<void>;
}

export function startMaster(options: MasterOptions): MasterInstance {
  const { port, whitelist, repoRoot, myIp } = options;
  const agents = new Map<string, ConnectedAgent>();
  let currentLogCallback: ((msg: string) => void) | null = null;

  console.log(`[Master] Starting WebSocket server on port ${port}`);
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress?.replace('::ffff:', '') || 'unknown';

    // Check whitelist
    if (!whitelist.includes(ip)) {
      console.log(`[Master] Rejected connection from ${ip} (not in whitelist)`);
      ws.close();
      return;
    }

    console.log(`[Master] Agent connected: ${ip}`);
    agents.set(ip, { ws, ip });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as AgentMessage;

        if (msg.type === 'log') {
          const logLine = `[${msg.ip}] ${msg.message}`;
          console.log(logLine);
          currentLogCallback?.(logLine);
        } else if (msg.type === 'result') {
          const status = msg.success ? '✓' : '✗';
          const detail = msg.success ? msg.version : msg.error;
          const logLine = `[${msg.ip}] ${status} ${detail}`;
          console.log(logLine);
          currentLogCallback?.(logLine);
        }
      } catch (err) {
        console.error(`[Master] Error parsing message:`, err);
      }
    });

    ws.on('close', () => {
      console.log(`[Master] Agent disconnected: ${ip}`);
      agents.delete(ip);
    });
  });

  function broadcast(msg: UpdateCommand): void {
    const payload = JSON.stringify(msg);
    for (const agent of agents.values()) {
      agent.ws.send(payload);
    }
  }

  async function triggerUpdate(
    target: string,
    branch: string,
    onLog?: (msg: string) => void
  ): Promise<void> {
    currentLogCallback = onLog || null;

    const cmd: UpdateCommand = { type: 'update', target, branch };

    // Broadcast to agents
    broadcast(cmd);

    // Also update self if target is 'all' or my own IP
    if (target === 'all' || target === myIp) {
      await executeUpdate({
        branch,
        repoRoot,
        onLog: (message) => {
          const logLine = `[${myIp}] ${message}`;
          console.log(logLine);
          onLog?.(logLine);
        },
      });
    }
  }

  console.log(`[Master] Server ready, whitelist: ${whitelist.join(', ')}`);

  return { wss, agents, broadcast, triggerUpdate };
}
