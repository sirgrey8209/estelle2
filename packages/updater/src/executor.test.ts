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

function createDetachedMockProcess() {
  const mockProcess = new EventEmitter() as any;
  mockProcess.pid = 99999;
  mockProcess.unref = vi.fn();
  // No close event - detached process runs independently
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

describe('executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.openSync).mockReturnValue(3);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
  });

  it('should execute git pull and deploy (detached)', async () => {
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(0, 'fetch done\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'checkout done\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'Already up to date.\n') as any)
      .mockReturnValueOnce(createDetachedMockProcess() as any);

    const logs: string[] = [];

    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: (msg) => logs.push(msg),
    });

    expect(result.success).toBe(true);
    expect(spawn).toHaveBeenCalledWith(
      'git',
      ['pull', 'origin', 'master'],
      expect.any(Object)
    );
    // Deploy should be called with detached option
    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['deploy:release'],
      expect.objectContaining({ detached: true })
    );
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

  it('should call commands in correct order', async () => {
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(0) as any)
      .mockReturnValueOnce(createMockProcess(0) as any)
      .mockReturnValueOnce(createMockProcess(0) as any)
      .mockReturnValueOnce(createDetachedMockProcess() as any);

    await executeUpdate({
      branch: 'main',
      repoRoot: '/repo',
      onLog: () => {},
    });

    const calls = vi.mocked(spawn).mock.calls;
    expect(calls[0]).toEqual(['git', ['fetch', 'origin'], expect.any(Object)]);
    expect(calls[1]).toEqual(['git', ['checkout', 'main'], expect.any(Object)]);
    expect(calls[2]).toEqual(['git', ['pull', 'origin', 'main'], expect.any(Object)]);
    expect(calls[3][0]).toBe('pnpm');
    expect(calls[3][1]).toEqual(['deploy:release']);
    expect(calls[3][2]).toMatchObject({ detached: true });
  });
});
