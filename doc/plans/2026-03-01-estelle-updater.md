# estelle-updater Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cross-platform Git-based deployment system with master/agent architecture for Windows/Linux sync.

**Architecture:** Single codebase auto-detects role (master vs agent) by comparing local IP to masterUrl. Master runs WebSocket server + self-deploy. Agents connect to master and execute deploy commands.

**Tech Stack:** TypeScript, ws (WebSocket), Node.js child_process for git/deploy, PM2

---

## Task 1: Package Setup

**Files:**
- Create: `packages/updater/package.json`
- Create: `packages/updater/tsconfig.json`
- Create: `packages/updater/src/types.ts`

**Step 1: Create package.json**

```json
{
  "name": "@estelle/updater",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "estelle-updater": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.13",
    "vitest": "^2.1.9",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create types.ts**

```typescript
/**
 * estelle-updater Types
 */

export interface UpdaterConfig {
  masterUrl: string;
  whitelist: string[];
}

export interface UpdateCommand {
  type: 'update';
  target: 'all' | string;  // 'all' or specific IP
  branch: string;
}

export interface LogMessage {
  type: 'log';
  ip: string;
  message: string;
}

export interface ResultMessage {
  type: 'result';
  ip: string;
  success: boolean;
  version?: string;
  error?: string;
}

export type AgentMessage = LogMessage | ResultMessage;

export type MasterMessage = UpdateCommand;
```

**Step 4: Run pnpm install**

Run: `pnpm install`

**Step 5: Commit**

```bash
git add packages/updater/
git commit -m "feat(updater): initialize package structure"
```

---

## Task 2: Config Loader

**Files:**
- Create: `packages/updater/src/config.ts`
- Create: `packages/updater/src/config.test.ts`
- Create: `config/updater.json`

**Step 1: Write the failing test**

```typescript
// packages/updater/src/config.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

vi.mock('fs');

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load config from file', async () => {
    const mockConfig = {
      masterUrl: 'ws://89.167.4.124:9900',
      whitelist: ['89.167.4.124', '121.0.0.1'],
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

    const { loadConfig } = await import('./config.js');
    const config = loadConfig('/path/to/config.json');

    expect(config.masterUrl).toBe('ws://89.167.4.124:9900');
    expect(config.whitelist).toContain('89.167.4.124');
  });

  it('should parse masterUrl to extract IP', async () => {
    vi.resetModules();
    const { parseMasterIp } = await import('./config.js');

    expect(parseMasterIp('ws://89.167.4.124:9900')).toBe('89.167.4.124');
    expect(parseMasterIp('ws://192.168.1.1:8080')).toBe('192.168.1.1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @estelle/updater test`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

```typescript
// packages/updater/src/config.ts
/**
 * Configuration loader for estelle-updater
 */
import fs from 'fs';
import path from 'path';
import type { UpdaterConfig } from './types.js';

export function loadConfig(configPath: string): UpdaterConfig {
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as UpdaterConfig;
}

export function parseMasterIp(masterUrl: string): string {
  // ws://89.167.4.124:9900 → 89.167.4.124
  const url = new URL(masterUrl);
  return url.hostname;
}

export function getDefaultConfigPath(): string {
  // Find repo root by looking for package.json with workspaces
  let dir = process.cwd();
  while (dir !== '/') {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.workspaces) {
        return path.join(dir, 'config', 'updater.json');
      }
    }
    dir = path.dirname(dir);
  }
  return path.join(process.cwd(), 'config', 'updater.json');
}
```

**Step 4: Create config file**

```json
// config/updater.json
{
  "masterUrl": "ws://89.167.4.124:9900",
  "whitelist": ["89.167.4.124"]
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter @estelle/updater test`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/updater/src/config.ts packages/updater/src/config.test.ts config/updater.json
git commit -m "feat(updater): add config loader"
```

---

## Task 3: IP Detection

**Files:**
- Create: `packages/updater/src/ip.ts`
- Create: `packages/updater/src/ip.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/updater/src/ip.test.ts
import { describe, it, expect, vi } from 'vitest';
import https from 'https';
import { EventEmitter } from 'events';

vi.mock('https');

describe('ip', () => {
  it('should get external IP from ipify', async () => {
    const mockResponse = new EventEmitter() as any;
    mockResponse.setEncoding = vi.fn();

    vi.mocked(https.get).mockImplementation((url, callback: any) => {
      callback(mockResponse);
      process.nextTick(() => {
        mockResponse.emit('data', '89.167.4.124');
        mockResponse.emit('end');
      });
      return new EventEmitter() as any;
    });

    const { getExternalIp } = await import('./ip.js');
    const ip = await getExternalIp();

    expect(ip).toBe('89.167.4.124');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @estelle/updater test`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/updater/src/ip.ts
/**
 * External IP detection
 */
import https from 'https';

export function getExternalIp(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data.trim()));
      res.on('error', reject);
    }).on('error', reject);
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @estelle/updater test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/updater/src/ip.ts packages/updater/src/ip.test.ts
git commit -m "feat(updater): add external IP detection"
```

---

## Task 4: Deploy Executor

**Files:**
- Create: `packages/updater/src/executor.ts`
- Create: `packages/updater/src/executor.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/updater/src/executor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

vi.mock('child_process');

describe('executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute git pull and deploy', async () => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    vi.mocked(spawn).mockReturnValue(mockProcess as any);

    const { executeUpdate } = await import('./executor.js');
    const logs: string[] = [];

    const promise = executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: (msg) => logs.push(msg),
    });

    // Simulate successful execution
    process.nextTick(() => {
      mockProcess.stdout.emit('data', 'Already up to date.\n');
      mockProcess.emit('close', 0);
    });

    const result = await promise;
    expect(result.success).toBe(true);
    expect(spawn).toHaveBeenCalledWith(
      'git',
      ['pull', 'origin', 'master'],
      expect.any(Object)
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @estelle/updater test`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/updater/src/executor.ts
/**
 * Git pull + deploy executor
 */
import { spawn } from 'child_process';
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

  onLog(`✓ Update complete`);
  return { success: true };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @estelle/updater test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/updater/src/executor.ts packages/updater/src/executor.test.ts
git commit -m "feat(updater): add git pull + deploy executor"
```

---

## Task 5: Agent Mode

**Files:**
- Create: `packages/updater/src/agent.ts`
- Create: `packages/updater/src/agent.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/updater/src/agent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

vi.mock('ws');
vi.mock('./executor.js', () => ({
  executeUpdate: vi.fn().mockResolvedValue({ success: true, version: 'v0301_1' }),
}));

describe('agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should connect to master and listen for commands', async () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();
    mockWs.close = vi.fn();

    vi.mocked(WebSocket).mockImplementation(() => mockWs as any);

    const { startAgent } = await import('./agent.js');
    startAgent({ masterUrl: 'ws://89.167.4.124:9900', repoRoot: '/app' });

    expect(WebSocket).toHaveBeenCalledWith('ws://89.167.4.124:9900');
  });

  it('should execute update on command', async () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();
    mockWs.close = vi.fn();

    vi.mocked(WebSocket).mockImplementation(() => mockWs as any);

    vi.resetModules();
    const { startAgent } = await import('./agent.js');
    const { executeUpdate } = await import('./executor.js');

    startAgent({ masterUrl: 'ws://89.167.4.124:9900', repoRoot: '/app' });

    // Simulate receiving update command
    const cmd = JSON.stringify({ type: 'update', target: 'all', branch: 'master' });
    mockWs.emit('message', cmd);

    // Wait for async execution
    await new Promise((r) => setTimeout(r, 10));

    expect(executeUpdate).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @estelle/updater test`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// packages/updater/src/agent.ts
/**
 * Agent mode - connects to master and executes deploy commands
 */
import WebSocket from 'ws';
import { executeUpdate } from './executor.js';
import type { UpdateCommand, LogMessage, ResultMessage } from './types.js';

export interface AgentOptions {
  masterUrl: string;
  repoRoot: string;
  myIp?: string;
}

export function startAgent(options: AgentOptions): WebSocket {
  const { masterUrl, repoRoot, myIp = 'unknown' } = options;

  console.log(`[Agent] Connecting to master: ${masterUrl}`);
  const ws = new WebSocket(masterUrl);

  ws.on('open', () => {
    console.log(`[Agent] Connected to master`);
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString()) as UpdateCommand;

      if (msg.type === 'update') {
        // Check if this command is for us
        if (msg.target !== 'all' && msg.target !== myIp) {
          return; // Not for us
        }

        console.log(`[Agent] Received update command: branch=${msg.branch}`);

        const result = await executeUpdate({
          branch: msg.branch,
          repoRoot,
          onLog: (message) => {
            const logMsg: LogMessage = { type: 'log', ip: myIp, message };
            ws.send(JSON.stringify(logMsg));
          },
        });

        const resultMsg: ResultMessage = {
          type: 'result',
          ip: myIp,
          success: result.success,
          version: result.version,
          error: result.error,
        };
        ws.send(JSON.stringify(resultMsg));
      }
    } catch (err) {
      console.error(`[Agent] Error processing message:`, err);
    }
  });

  ws.on('close', () => {
    console.log(`[Agent] Disconnected from master, reconnecting in 5s...`);
    setTimeout(() => startAgent(options), 5000);
  });

  ws.on('error', (err) => {
    console.error(`[Agent] WebSocket error:`, err);
  });

  return ws;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @estelle/updater test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/updater/src/agent.ts packages/updater/src/agent.test.ts
git commit -m "feat(updater): add agent mode"
```

---

## Task 6: Master Mode

**Files:**
- Create: `packages/updater/src/master.ts`
- Create: `packages/updater/src/master.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/updater/src/master.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

vi.mock('ws');
vi.mock('./executor.js', () => ({
  executeUpdate: vi.fn().mockResolvedValue({ success: true }),
}));

describe('master', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start WebSocket server on specified port', async () => {
    const mockWss = new EventEmitter() as any;
    mockWss.clients = new Set();

    vi.mocked(WebSocketServer).mockImplementation(() => mockWss as any);

    const { startMaster } = await import('./master.js');
    startMaster({
      port: 9900,
      whitelist: ['89.167.4.124'],
      repoRoot: '/app',
      myIp: '89.167.4.124',
    });

    expect(WebSocketServer).toHaveBeenCalledWith({ port: 9900 });
  });

  it('should reject connections from non-whitelisted IPs', async () => {
    const mockWss = new EventEmitter() as any;
    mockWss.clients = new Set();

    vi.mocked(WebSocketServer).mockImplementation(() => mockWss as any);

    vi.resetModules();
    const { startMaster } = await import('./master.js');
    startMaster({
      port: 9900,
      whitelist: ['89.167.4.124'],
      repoRoot: '/app',
      myIp: '89.167.4.124',
    });

    const mockSocket = new EventEmitter() as any;
    mockSocket.close = vi.fn();
    mockSocket.send = vi.fn();

    const mockReq = { socket: { remoteAddress: '1.2.3.4' } };
    mockWss.emit('connection', mockSocket, mockReq);

    expect(mockSocket.close).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @estelle/updater test`
Expected: FAIL

**Step 3: Write implementation**

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @estelle/updater test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/updater/src/master.ts packages/updater/src/master.test.ts
git commit -m "feat(updater): add master mode with WebSocket server"
```

---

## Task 7: Main Entry Point (Auto Role Detection)

**Files:**
- Create: `packages/updater/src/index.ts`

**Step 1: Write implementation**

```typescript
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
```

**Step 2: Verify build**

Run: `pnpm --filter @estelle/updater build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/updater/src/index.ts
git commit -m "feat(updater): add main entry with auto role detection"
```

---

## Task 8: CLI

**Files:**
- Create: `packages/updater/src/cli.ts`

**Step 1: Write implementation**

```typescript
// packages/updater/src/cli.ts
#!/usr/bin/env node
/**
 * estelle-updater CLI
 *
 * Usage:
 *   npx estelle-updater              # Start as master or agent (auto-detect)
 *   npx estelle-updater trigger all master
 *   npx estelle-updater trigger 89.167.4.124 hotfix
 */
import { start, startMaster } from './index.js';
import { loadConfig, parseMasterIp, getDefaultConfigPath } from './config.js';
import { getExternalIp } from './ip.js';
import path from 'path';
import fs from 'fs';

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
    const myIp = await getExternalIp();
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
  npx estelle-updater trigger 89.167.4.124 hotfix-123
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 2: Verify build**

Run: `pnpm --filter @estelle/updater build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/updater/src/cli.ts
git commit -m "feat(updater): add CLI with trigger command"
```

---

## Task 9: MCP Tool Integration

**Files:**
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts`

**Step 1: Add update MCP tool handler**

Find the deploy handler section and add update tool after it:

```typescript
// In the _handleAction method, add new case:
case 'update': {
  const { target, branch } = body as { target?: string; branch?: string };
  if (!target) {
    return {
      success: false,
      error: 'Missing target field for update action',
    } as FailResponse;
  }
  const result = await this._runUpdateCommand(target, branch || 'master');
  return result;
}
```

**Step 2: Add _runUpdateCommand method**

```typescript
private async _runUpdateCommand(
  target: string,
  branch: string
): Promise<SuccessResponse | FailResponse> {
  const repoRoot = this._findRepoRoot();

  try {
    // Dynamically import updater
    const { startMaster, getExternalIp, loadConfig, parseMasterIp, getDefaultConfigPath } =
      await import('@estelle/updater');

    const configPath = getDefaultConfigPath();
    const config = loadConfig(configPath);
    const masterIp = parseMasterIp(config.masterUrl);
    const myIp = await getExternalIp();

    if (myIp !== masterIp) {
      return {
        success: false,
        error: `Update can only be triggered from master (${masterIp})`,
      };
    }

    const url = new URL(config.masterUrl);
    const master = startMaster({
      port: parseInt(url.port, 10),
      whitelist: config.whitelist,
      repoRoot,
      myIp,
    });

    const logs: string[] = [];
    await master.triggerUpdate(target, branch, (msg) => logs.push(msg));

    return {
      success: true,
      message: `Update triggered: target=${target}, branch=${branch}`,
      logs,
    };
  } catch (err) {
    return {
      success: false,
      error: `Update failed: ${err}`,
    };
  }
}
```

**Step 3: Run typecheck**

Run: `pnpm --filter @estelle/pylon typecheck`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add packages/pylon/src/servers/pylon-mcp-server.ts
git commit -m "feat(pylon): add update MCP tool for remote deployment"
```

---

## Task 10: PM2 Configuration

**Files:**
- Modify: `config/environments.json` (add updater config)

**Step 1: Update environments.json**

Add updater configuration to each environment:

```json
{
  "stage": {
    // ... existing config ...
    "updater": {
      "pm2Name": "estelle-updater"
    }
  },
  "release": {
    // ... existing config ...
    "updater": {
      "pm2Name": "estelle-updater"
    }
  }
}
```

**Step 2: Update deploy script to start updater**

Modify `scripts/deploy/index.ts` to also start updater service:

```typescript
// After starting Pylon, add:
log('Phase 5', 'Starting estelle-updater...');
const updaterResult = startService({
  name: config.updater?.pm2Name || 'estelle-updater',
  script: 'dist/index.js',
  cwd: path.join(repoRoot, 'packages', 'updater'),
});
if (!updaterResult.success) {
  console.warn(`[Warning] Updater start failed: ${updaterResult.error}`);
  // Don't fail deploy for updater
}
logDetail(`Updater started: ${config.updater?.pm2Name || 'estelle-updater'}`);
```

**Step 3: Commit**

```bash
git add config/environments.json scripts/deploy/index.ts
git commit -m "feat(deploy): add estelle-updater to PM2 services"
```

---

## Task 11: Documentation

**Files:**
- Modify: `doc/deploy-remote.md`

**Step 1: Add updater section**

```markdown
## 원격 배포 (estelle-updater)

### 개요

estelle-updater는 Git 기반 크로스 플랫폼 배포 시스템입니다.
- Windows와 Linux 환경 간 코드 동기화
- WebSocket 기반 실시간 로그 스트리밍
- MCP 도구 또는 CLI로 트리거

### 설정

`config/updater.json`:
```json
{
  "masterUrl": "ws://89.167.4.124:9900",
  "whitelist": ["89.167.4.124", "YOUR_IP"]
}
```

### 사용법

**MCP 도구:**
```typescript
update({ target: 'all', branch: 'master' })
update({ target: '121.x.x.x', branch: 'hotfix' })
```

**CLI:**
```bash
npx estelle-updater trigger all master
npx estelle-updater trigger 89.167.4.124 hotfix
```

### 동작 방식

1. 명령 수신
2. `git fetch && git checkout {branch} && git pull`
3. `pnpm deploy:release` 자동 실행
4. 실시간 로그 스트리밍
5. 완료/실패 알림
```

**Step 2: Commit**

```bash
git add doc/deploy-remote.md
git commit -m "docs: add estelle-updater documentation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Package setup | packages/updater/{package.json,tsconfig.json,src/types.ts} |
| 2 | Config loader | packages/updater/src/config.ts, config/updater.json |
| 3 | IP detection | packages/updater/src/ip.ts |
| 4 | Deploy executor | packages/updater/src/executor.ts |
| 5 | Agent mode | packages/updater/src/agent.ts |
| 6 | Master mode | packages/updater/src/master.ts |
| 7 | Main entry | packages/updater/src/index.ts |
| 8 | CLI | packages/updater/src/cli.ts |
| 9 | MCP integration | packages/pylon/src/servers/pylon-mcp-server.ts |
| 10 | PM2 config | config/environments.json, scripts/deploy/index.ts |
| 11 | Documentation | doc/deploy-remote.md |
