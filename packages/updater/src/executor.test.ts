// packages/updater/src/executor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { executeUpdate } from './executor.js';

vi.mock('child_process');
vi.mock('fs');

function createMockProcess(exitCode: number = 0, output?: string, errorOutput?: string) {
  const mockProcess = new EventEmitter() as any;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.pid = 12345;
  mockProcess.unref = vi.fn();

  setImmediate(() => {
    if (output) {
      mockProcess.stdout.emit('data', output);
    }
    if (errorOutput) {
      mockProcess.stderr.emit('data', errorOutput);
    }
    mockProcess.emit('close', exitCode);
  });

  return mockProcess;
}

function createErrorMockProcess(errorMessage: string) {
  const mockProcess = new EventEmitter() as any;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();

  setImmediate(() => {
    mockProcess.emit('error', new Error(errorMessage));
  });

  return mockProcess;
}

/** Create N successful mock processes */
function mockSuccessfulSpawns(count: number) {
  for (let i = 0; i < count; i++) {
    vi.mocked(spawn).mockReturnValueOnce(createMockProcess(0) as any);
  }
}

const ENV_CONFIG = {
  envId: 0,
  relay: { port: 8080, pm2Name: 'estelle-relay' },
  pylon: {
    pm2Name: 'estelle-pylon',
    pylonIndex: '1',
    relayUrl: 'ws://localhost:8080',
    configDir: '~/.claude',
    credentialsBackupDir: '~/.claude-credentials',
    mcpPort: 9876,
    dataDir: './release-data',
    defaultWorkingDir: '/home/user',
  },
};

function mockReadFileSync() {
  vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
    if (typeof filePath === 'string' && filePath.includes('version.json')) {
      return JSON.stringify({ version: 'v0305_1', buildTime: '2026-03-05T00:00:00Z' });
    }
    if (typeof filePath === 'string' && filePath.includes('environments.')) {
      return JSON.stringify(ENV_CONFIG);
    }
    return '{}';
  });
}

describe('executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.cpSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
    vi.mocked(fs.createWriteStream).mockReturnValue({
      write: vi.fn(),
      end: vi.fn(),
    } as any);
    mockReadFileSync();
  });

  it('should execute full update flow for Agent (pylon only)', async () => {
    // Agent spawns: fetch, checkout, pull, install, build, pm2 delete pylon, pm2 start, pm2 save
    mockSuccessfulSpawns(8);

    const logs: string[] = [];
    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: (msg) => logs.push(msg),
      isMaster: false,
      environmentFile: 'environments.office.json',
    });

    expect(result.success).toBe(true);
    expect(result.version).toBe('v0305_1');

    // Agent copies: core, updater, pylon (3 total, no relay)
    expect(fs.cpSync).toHaveBeenCalledTimes(3);
    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('core', 'dist')),
      expect.stringContaining(path.join('release', 'core', 'dist')),
      { recursive: true },
    );
    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('updater', 'dist')),
      expect.stringContaining(path.join('release', 'updater', 'dist')),
      { recursive: true },
    );
    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('pylon', 'dist')),
      expect.stringContaining(path.join('release', 'pylon', 'dist')),
      { recursive: true },
    );

    // Verify pm2 commands: delete pylon, start, save
    const calls = vi.mocked(spawn).mock.calls;
    // 0=fetch, 1=checkout, 2=pull, 3=install, 4=build, 5=pm2 delete, 6=pm2 start, 7=pm2 save
    expect(calls[5]).toEqual(['pm2', ['delete', 'estelle-pylon'], expect.any(Object)]);
    expect(calls[6][0]).toBe('pm2');
    expect(calls[6][1][0]).toBe('start');
    expect(calls[7]).toEqual(['pm2', ['save'], expect.any(Object)]);
  });

  it('should execute full update flow for Master (relay + pylon)', async () => {
    // Master spawns: fetch, checkout, pull, install, build,
    //   pm2 delete relay, pm2 delete pylon, pm2 start, pm2 save
    mockSuccessfulSpawns(9);

    const logs: string[] = [];
    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: (msg) => logs.push(msg),
      isMaster: true,
      environmentFile: 'environments.cloud.json',
    });

    expect(result.success).toBe(true);
    expect(result.version).toBe('v0305_1');

    // Master copies: core, updater, pylon, relay/dist, relay/public (5 total)
    expect(fs.cpSync).toHaveBeenCalledTimes(5);
    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('pylon', 'dist')),
      expect.stringContaining(path.join('release', 'pylon', 'dist')),
      { recursive: true },
    );
    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('relay', 'dist')),
      expect.stringContaining(path.join('release', 'relay', 'dist')),
      { recursive: true },
    );
    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('relay', 'public')),
      expect.stringContaining(path.join('release', 'relay', 'public')),
      { recursive: true },
    );

    // Verify pm2 commands: delete relay, delete pylon, start, save
    const calls = vi.mocked(spawn).mock.calls;
    // 0=fetch, 1=checkout, 2=pull, 3=install, 4=build,
    // 5=pm2 delete relay, 6=pm2 delete pylon, 7=pm2 start, 8=pm2 save
    expect(calls[5]).toEqual(['pm2', ['delete', 'estelle-relay'], expect.any(Object)]);
    expect(calls[6]).toEqual(['pm2', ['delete', 'estelle-pylon'], expect.any(Object)]);
    expect(calls[7][0]).toBe('pm2');
    expect(calls[7][1][0]).toBe('start');
    expect(calls[8]).toEqual(['pm2', ['save'], expect.any(Object)]);
  });

  it('should fail when git fetch fails', async () => {
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(1, '', 'fatal: could not read from remote\n') as any);

    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: () => {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('git fetch failed');
  });

  it('should fail when git pull fails', async () => {
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(0, 'fetch done\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'checkout done\n') as any)
      .mockReturnValueOnce(createMockProcess(1, '', 'fatal: not a git repository\n') as any);

    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: () => {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('git pull failed');
  });

  it('should fail when build fails', async () => {
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(0) as any) // fetch
      .mockReturnValueOnce(createMockProcess(0) as any) // checkout
      .mockReturnValueOnce(createMockProcess(0) as any) // pull
      .mockReturnValueOnce(createMockProcess(0) as any) // install
      .mockReturnValueOnce(createMockProcess(1, '', 'build error\n') as any); // build

    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: () => {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('pnpm build failed');
  });

  it('should call commands in correct order', async () => {
    // Agent without env config: fetch, checkout, pull, install, build,
    //   pm2 delete pylon (default name), pm2 start, pm2 save = 8
    mockSuccessfulSpawns(8);

    await executeUpdate({
      branch: 'main',
      repoRoot: '/repo',
      onLog: () => {},
    });

    const calls = vi.mocked(spawn).mock.calls;
    expect(calls[0]).toEqual(['git', ['fetch', 'origin'], expect.any(Object)]);
    expect(calls[1]).toEqual(['git', ['checkout', 'main'], expect.any(Object)]);
    expect(calls[2]).toEqual(['git', ['pull', 'origin', 'main'], expect.any(Object)]);
    expect(calls[3]).toEqual(['pnpm', ['install'], expect.any(Object)]);
    expect(calls[4]).toEqual(['pnpm', ['build'], expect.any(Object)]);
    expect(calls[5]).toEqual(['pm2', ['delete', 'estelle-pylon'], expect.any(Object)]);
    expect(calls[6][0]).toBe('pm2');
    expect(calls[6][1][0]).toBe('start');
    expect(calls[7]).toEqual(['pm2', ['save'], expect.any(Object)]);
  });

  it('should write ecosystem file with correct env vars', async () => {
    // Master with env config: fetch, checkout, pull, install, build,
    //   pm2 delete relay, pm2 delete pylon, pm2 start, pm2 save = 9
    mockSuccessfulSpawns(9);

    await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: () => {},
      isMaster: true,
      environmentFile: 'environments.cloud.json',
    });

    // Verify writeFileSync was called with ecosystem content
    const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
    const ecosystemCall = writeCalls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('ecosystem.config.cjs'),
    );
    expect(ecosystemCall).toBeDefined();

    const content = ecosystemCall![1] as string;
    expect(content).toContain('module.exports');

    // Parse the ecosystem config from the written content
    // Content is: module.exports = {...};
    const jsonStr = content.replace('module.exports = ', '').replace(/;$/, '');
    const ecosystem = JSON.parse(jsonStr);

    expect(ecosystem.apps).toHaveLength(2);

    // Relay app should be first (unshift)
    const relayApp = ecosystem.apps[0];
    expect(relayApp.name).toBe('estelle-relay');
    expect(relayApp.env.PORT).toBe('8080');
    expect(relayApp.cwd).toContain(path.join('release', 'relay'));

    // Pylon app should be second
    const pylonApp = ecosystem.apps[1];
    expect(pylonApp.name).toBe('estelle-pylon');
    expect(pylonApp.env.ESTELLE_VERSION).toBe('v0305_1');
    expect(pylonApp.env.ESTELLE_ENV_CONFIG).toBeDefined();

    // Verify ESTELLE_ENV_CONFIG contents
    const envConfigParsed = JSON.parse(pylonApp.env.ESTELLE_ENV_CONFIG);
    expect(envConfigParsed.envId).toBe(0);
    expect(envConfigParsed.pylon.pylonIndex).toBe('1');
    expect(envConfigParsed.pylon.relayUrl).toBe('ws://localhost:8080');
    expect(envConfigParsed.pylon.mcpPort).toBe(9876);
  });
});
