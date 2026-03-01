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
      whitelist: ['5.223.72.58'],
      repoRoot: '/app',
      myIp: '5.223.72.58',
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
      whitelist: ['5.223.72.58'],
      repoRoot: '/app',
      myIp: '5.223.72.58',
    });

    const mockSocket = new EventEmitter() as any;
    mockSocket.close = vi.fn();
    mockSocket.send = vi.fn();

    const mockReq = { socket: { remoteAddress: '1.2.3.4' } };
    mockWss.emit('connection', mockSocket, mockReq);

    expect(mockSocket.close).toHaveBeenCalled();
  });
});
