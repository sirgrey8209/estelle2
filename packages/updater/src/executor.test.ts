// packages/updater/src/executor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
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

describe('executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.cpSync).mockReturnValue(undefined);
    vi.mocked(fs.createWriteStream).mockReturnValue({
      write: vi.fn(),
      end: vi.fn(),
    } as any);
  });

  it('should execute full update flow for Agent (pylon only)', async () => {
    // 6 spawns: fetch, checkout, pull, build, pm2 restart pylon
    mockSuccessfulSpawns(5);

    const logs: string[] = [];
    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: (msg) => logs.push(msg),
      isMaster: false,
    });

    expect(result.success).toBe(true);

    // Verify copy step: only pylon/dist
    expect(fs.cpSync).toHaveBeenCalledTimes(1);
    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining('pylon/dist'),
      expect.stringContaining('release/pylon/dist'),
      { recursive: true },
    );

    // Verify pm2 restart pylon
    const calls = vi.mocked(spawn).mock.calls;
    expect(calls[4]).toEqual(['pm2', ['restart', 'estelle-pylon'], expect.any(Object)]);
  });

  it('should execute full update flow for Master (relay + pylon)', async () => {
    // 7 spawns: fetch, checkout, pull, build, pm2 restart relay, pm2 restart pylon
    mockSuccessfulSpawns(6);

    const logs: string[] = [];
    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: (msg) => logs.push(msg),
      isMaster: true,
    });

    expect(result.success).toBe(true);

    // Verify copy step: pylon/dist + relay/dist + relay/public
    expect(fs.cpSync).toHaveBeenCalledTimes(3);
    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining('pylon/dist'),
      expect.stringContaining('release/pylon/dist'),
      { recursive: true },
    );
    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining('relay/dist'),
      expect.stringContaining('release/relay/dist'),
      { recursive: true },
    );
    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining('relay/public'),
      expect.stringContaining('release/relay/public'),
      { recursive: true },
    );

    // Verify pm2 restarts: relay then pylon
    const calls = vi.mocked(spawn).mock.calls;
    expect(calls[4]).toEqual(['pm2', ['restart', 'estelle-relay'], expect.any(Object)]);
    expect(calls[5]).toEqual(['pm2', ['restart', 'estelle-pylon'], expect.any(Object)]);
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
      .mockReturnValueOnce(createMockProcess(1, '', 'build error\n') as any); // build

    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: () => {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('pnpm build failed');
  });

  it('should handle spawn error', async () => {
    vi.mocked(spawn)
      .mockReturnValueOnce(createErrorMockProcess('spawn ENOENT') as any);

    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: () => {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('spawn ENOENT');
  });

  it('should call commands in correct order', async () => {
    // Agent: 5 spawns
    mockSuccessfulSpawns(5);

    await executeUpdate({
      branch: 'main',
      repoRoot: '/repo',
      onLog: () => {},
    });

    const calls = vi.mocked(spawn).mock.calls;
    expect(calls[0]).toEqual(['git', ['fetch', 'origin'], expect.any(Object)]);
    expect(calls[1]).toEqual(['git', ['checkout', 'main'], expect.any(Object)]);
    expect(calls[2]).toEqual(['git', ['pull', 'origin', 'main'], expect.any(Object)]);
    expect(calls[3]).toEqual(['pnpm', ['build'], expect.any(Object)]);
    expect(calls[4]).toEqual(['pm2', ['restart', 'estelle-pylon'], expect.any(Object)]);
  });
});
