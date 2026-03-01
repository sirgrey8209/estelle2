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
    vi.resetModules();
  });

  it('should connect to master and listen for commands', async () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();
    mockWs.close = vi.fn();
    mockWs.readyState = WebSocket.OPEN;

    vi.mocked(WebSocket).mockImplementation(() => mockWs as any);

    const { startAgent } = await import('./agent.js');
    startAgent({ masterUrl: 'ws://89.167.4.124:9900', repoRoot: '/app' });

    expect(WebSocket).toHaveBeenCalledWith('ws://89.167.4.124:9900');
  });

  it('should execute update on command and send result', async () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();
    mockWs.close = vi.fn();
    mockWs.readyState = WebSocket.OPEN;

    vi.mocked(WebSocket).mockImplementation(() => mockWs as any);

    const { startAgent } = await import('./agent.js');
    const { executeUpdate } = await import('./executor.js');

    startAgent({ masterUrl: 'ws://89.167.4.124:9900', repoRoot: '/app', myIp: '1.2.3.4' });

    // Simulate receiving update command
    const cmd = JSON.stringify({ type: 'update', target: 'all', branch: 'master' });
    mockWs.emit('message', cmd);

    // Wait for async execution
    await new Promise((r) => setTimeout(r, 20));

    // Verify executeUpdate was called
    expect(executeUpdate).toHaveBeenCalled();

    // Verify result message was sent
    expect(mockWs.send).toHaveBeenCalled();
    const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1][0];
    const resultMsg = JSON.parse(lastCall);
    expect(resultMsg.type).toBe('result');
    expect(resultMsg.success).toBe(true);
    expect(resultMsg.ip).toBe('1.2.3.4');
  });

  it('should send log messages via onLog callback', async () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();
    mockWs.close = vi.fn();
    mockWs.readyState = WebSocket.OPEN;

    vi.mocked(WebSocket).mockImplementation(() => mockWs as any);

    // Mock executeUpdate to call onLog
    const { executeUpdate } = await import('./executor.js');
    vi.mocked(executeUpdate).mockImplementation(async (opts) => {
      opts.onLog('test log message');
      return { success: true, version: 'v0301_1' };
    });

    const { startAgent } = await import('./agent.js');
    startAgent({ masterUrl: 'ws://89.167.4.124:9900', repoRoot: '/app', myIp: '1.2.3.4' });

    // Simulate receiving update command
    const cmd = JSON.stringify({ type: 'update', target: 'all', branch: 'master' });
    mockWs.emit('message', cmd);

    await new Promise((r) => setTimeout(r, 20));

    // Find log message call
    const logCall = mockWs.send.mock.calls.find((call: string[]) => {
      const msg = JSON.parse(call[0]);
      return msg.type === 'log';
    });

    expect(logCall).toBeDefined();
    const logMsg = JSON.parse(logCall[0]);
    expect(logMsg.type).toBe('log');
    expect(logMsg.message).toBe('test log message');
    expect(logMsg.ip).toBe('1.2.3.4');
  });

  it('should not execute update when target does not match', async () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();
    mockWs.close = vi.fn();
    mockWs.readyState = WebSocket.OPEN;

    vi.mocked(WebSocket).mockImplementation(() => mockWs as any);

    const { startAgent } = await import('./agent.js');
    const { executeUpdate } = await import('./executor.js');

    startAgent({ masterUrl: 'ws://89.167.4.124:9900', repoRoot: '/app', myIp: '1.2.3.4' });

    // Command for different IP
    const cmd = JSON.stringify({ type: 'update', target: '9.9.9.9', branch: 'master' });
    mockWs.emit('message', cmd);

    await new Promise((r) => setTimeout(r, 20));

    expect(executeUpdate).not.toHaveBeenCalled();
  });

  it('should handle executor failure gracefully', async () => {
    const mockWs = new EventEmitter() as any;
    mockWs.send = vi.fn();
    mockWs.close = vi.fn();
    mockWs.readyState = WebSocket.OPEN;

    vi.mocked(WebSocket).mockImplementation(() => mockWs as any);

    // Mock executeUpdate to reject
    const { executeUpdate } = await import('./executor.js');
    vi.mocked(executeUpdate).mockRejectedValue(new Error('Deploy failed'));

    const { startAgent } = await import('./agent.js');
    startAgent({ masterUrl: 'ws://89.167.4.124:9900', repoRoot: '/app', myIp: '1.2.3.4' });

    const cmd = JSON.stringify({ type: 'update', target: 'all', branch: 'master' });
    mockWs.emit('message', cmd);

    await new Promise((r) => setTimeout(r, 20));

    // Should still send result message with error
    const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1][0];
    const resultMsg = JSON.parse(lastCall);
    expect(resultMsg.type).toBe('result');
    expect(resultMsg.success).toBe(false);
    expect(resultMsg.error).toBe('Deploy failed');
  });
});
