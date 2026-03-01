// packages/updater/src/executor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { executeUpdate } from './executor.js';

vi.mock('child_process');

function createMockProcess(exitCode: number = 0, output?: string, errorOutput?: string) {
  const mockProcess = new EventEmitter() as any;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();

  // Use setImmediate to ensure event is emitted after promise is set up
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

describe('executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute git pull and deploy', async () => {
    // Mock all 4 commands: fetch, checkout, pull, deploy
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(0, 'fetch done\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'checkout done\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'Already up to date.\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'deploy done\n') as any);

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
  });

  it('should fail when git pull fails', async () => {
    // fetch succeeds, checkout succeeds, pull fails
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(0, 'fetch done\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'checkout done\n') as any)
      .mockReturnValueOnce(createMockProcess(1, '', 'fatal: not a git repository\n') as any);

    const logs: string[] = [];

    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: (msg) => logs.push(msg),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('git pull failed');
  });

  it('should handle spawn error', async () => {
    vi.mocked(spawn)
      .mockReturnValueOnce(createErrorMockProcess('spawn ENOENT') as any);

    const logs: string[] = [];

    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: (msg) => logs.push(msg),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('spawn ENOENT');
  });

  it('should stream logs via onLog callback', async () => {
    // Mock all 4 commands with specific output
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(0, 'Fetching origin\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'Switched to branch\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'Updating abc123..def456\nFast-forward\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'Deploy complete\n') as any);

    const logs: string[] = [];

    const result = await executeUpdate({
      branch: 'develop',
      repoRoot: '/project',
      onLog: (msg) => logs.push(msg),
    });

    expect(result.success).toBe(true);
    expect(logs.some(log => log.includes('Updating'))).toBe(true);
  });

  it('should fail when git fetch fails', async () => {
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(1, '', 'fatal: could not read from remote\n') as any);

    const logs: string[] = [];

    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: (msg) => logs.push(msg),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('git fetch failed');
  });

  it('should fail when deploy fails', async () => {
    // All git commands succeed, deploy fails
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(0, 'fetch done\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'checkout done\n') as any)
      .mockReturnValueOnce(createMockProcess(0, 'pull done\n') as any)
      .mockReturnValueOnce(createMockProcess(1, '', 'Build failed\n') as any);

    const logs: string[] = [];

    const result = await executeUpdate({
      branch: 'master',
      repoRoot: '/app',
      onLog: (msg) => logs.push(msg),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('deploy failed');
  });

  it('should call commands in correct order', async () => {
    vi.mocked(spawn)
      .mockReturnValueOnce(createMockProcess(0) as any)
      .mockReturnValueOnce(createMockProcess(0) as any)
      .mockReturnValueOnce(createMockProcess(0) as any)
      .mockReturnValueOnce(createMockProcess(0) as any);

    await executeUpdate({
      branch: 'main',
      repoRoot: '/repo',
      onLog: () => {},
    });

    const calls = vi.mocked(spawn).mock.calls;
    expect(calls[0]).toEqual(['git', ['fetch', 'origin'], expect.any(Object)]);
    expect(calls[1]).toEqual(['git', ['checkout', 'main'], expect.any(Object)]);
    expect(calls[2]).toEqual(['git', ['pull', 'origin', 'main'], expect.any(Object)]);
    expect(calls[3]).toEqual(['pnpm', ['deploy:release'], expect.any(Object)]);
  });
});
