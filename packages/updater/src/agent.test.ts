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
    startAgent({ masterUrl: 'ws://5.223.72.58:9900', repoRoot: '/app' });

    expect(WebSocket).toHaveBeenCalledWith('ws://5.223.72.58:9900');
  });

  it('should execute update on command', async () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();
    mockWs.close = vi.fn();

    vi.mocked(WebSocket).mockImplementation(() => mockWs as any);

    vi.resetModules();
    const { startAgent } = await import('./agent.js');
    const { executeUpdate } = await import('./executor.js');

    startAgent({ masterUrl: 'ws://5.223.72.58:9900', repoRoot: '/app' });

    // Simulate receiving update command
    const cmd = JSON.stringify({ type: 'update', target: 'all', branch: 'master' });
    mockWs.emit('message', cmd);

    // Wait for async execution
    await new Promise((r) => setTimeout(r, 10));

    expect(executeUpdate).toHaveBeenCalled();
  });
});
