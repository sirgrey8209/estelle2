// packages/updater/src/master.ts
/**
 * Master mode - WebSocket server for coordinating agents
 */
import { WebSocketServer, WebSocket } from 'ws';
import { executeUpdate } from './executor.js';
import type { UpdateCommand, AgentMessage, LogMessage, ResultMessage, MachineConfig } from './types.js';

export interface MasterOptions {
  port: number;
  whitelist: string[];
  repoRoot: string;
  myIp: string;
  machines?: Record<string, MachineConfig>;
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

  // Ping all agents every 30s to detect dead connections
  const pingInterval = setInterval(() => {
    for (const [ip, agent] of agents) {
      if (agent.ws.readyState === WebSocket.OPEN) {
        agent.ws.ping();
        console.log(`[Master] Ping → ${ip}`);
      } else {
        console.log(`[Master] Removing dead agent: ${ip}`);
        agents.delete(ip);
      }
    }
  }, 30_000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  wss.on('error', (err) => {
    console.error(`[Master] WebSocket server error:`, err);
  });

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

    // Send welcome message with the agent's IP (as seen after NAT)
    try {
      ws.send(JSON.stringify({ type: 'welcome', yourIp: ip }));
    } catch (err) {
      console.error(`[Master] Failed to send welcome to ${ip}:`, err);
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'update') {
          // Received trigger command from CLI or MCP
          console.log(`[Master] Received trigger: target=${msg.target}, branch=${msg.branch}`);
          triggerUpdate(msg.target, msg.branch);
        } else if (msg.type === 'log') {
          const logLine = `[${(msg as LogMessage).ip}] ${(msg as LogMessage).message}`;
          console.log(logLine);
          currentLogCallback?.(logLine);
        } else if (msg.type === 'result') {
          const rm = msg as ResultMessage;
          const status = rm.success ? '✓' : '✗';
          const detail = rm.success ? rm.version : rm.error;
          const logLine = `[${rm.ip}] ${status} ${detail}`;
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

  function broadcast(baseCmd: UpdateCommand): void {
    for (const [ip, agent] of agents) {
      try {
        if (agent.ws.readyState === WebSocket.OPEN) {
          const cmd = {
            ...baseCmd,
            environmentFile: options.machines?.[ip]?.environmentFile,
          };
          agent.ws.send(JSON.stringify(cmd));
        }
      } catch (err) {
        console.error(`[Master] Failed to send to ${ip}:`, err);
      }
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
        isMaster: true,
        environmentFile: options.machines?.[myIp]?.environmentFile,
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
