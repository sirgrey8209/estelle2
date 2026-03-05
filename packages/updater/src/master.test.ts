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
    vi.resetModules();
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

  it('should accept connections from whitelisted IPs', async () => {
    const mockWss = new EventEmitter() as any;
    mockWss.clients = new Set();

    vi.mocked(WebSocketServer).mockImplementation(() => mockWss as any);

    const { startMaster } = await import('./master.js');
    const master = startMaster({
      port: 9900,
      whitelist: ['89.167.4.124'],
      repoRoot: '/app',
      myIp: '89.167.4.124',
    });

    const mockSocket = new EventEmitter() as any;
    mockSocket.close = vi.fn();
    mockSocket.send = vi.fn();
    mockSocket.readyState = WebSocket.OPEN;

    const mockReq = { socket: { remoteAddress: '89.167.4.124' } };
    mockWss.emit('connection', mockSocket, mockReq);

    expect(mockSocket.close).not.toHaveBeenCalled();
    expect(master.agents.size).toBe(1);
  });

  it('should broadcast update command to all agents', async () => {
    const mockWss = new EventEmitter() as any;
    mockWss.clients = new Set();

    vi.mocked(WebSocketServer).mockImplementation(() => mockWss as any);

    const { startMaster } = await import('./master.js');
    const master = startMaster({
      port: 9900,
      whitelist: ['89.167.4.124', '1.2.3.4'],
      repoRoot: '/app',
      myIp: '89.167.4.124',
    });

    // Connect two agents
    const mockSocket1 = new EventEmitter() as any;
    mockSocket1.close = vi.fn();
    mockSocket1.send = vi.fn();
    mockSocket1.readyState = WebSocket.OPEN;

    const mockSocket2 = new EventEmitter() as any;
    mockSocket2.close = vi.fn();
    mockSocket2.send = vi.fn();
    mockSocket2.readyState = WebSocket.OPEN;

    mockWss.emit('connection', mockSocket1, { socket: { remoteAddress: '89.167.4.124' } });
    mockWss.emit('connection', mockSocket2, { socket: { remoteAddress: '1.2.3.4' } });

    // Broadcast
    master.broadcast({ type: 'update', target: 'all', branch: 'master' });

    expect(mockSocket1.send).toHaveBeenCalled();
    expect(mockSocket2.send).toHaveBeenCalled();

    // calls[0] = welcome message, calls[1] = update message
    const sentMsg = JSON.parse(mockSocket1.send.mock.calls[1][0]);
    expect(sentMsg.type).toBe('update');
    expect(sentMsg.branch).toBe('master');
  });

  it('should trigger self update when target is all', async () => {
    const mockWss = new EventEmitter() as any;
    mockWss.clients = new Set();

    vi.mocked(WebSocketServer).mockImplementation(() => mockWss as any);

    const { startMaster } = await import('./master.js');
    const { executeUpdate } = await import('./executor.js');

    const master = startMaster({
      port: 9900,
      whitelist: ['89.167.4.124'],
      repoRoot: '/app',
      myIp: '89.167.4.124',
    });

    const logs: string[] = [];
    await master.triggerUpdate('all', 'master', (msg) => logs.push(msg));

    expect(executeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'master',
        repoRoot: '/app',
      })
    );
  });

  it('should include environmentFile in update command to agents', async () => {
    const mockWss = new EventEmitter() as any;
    mockWss.clients = new Set();

    vi.mocked(WebSocketServer).mockImplementation(() => mockWss as any);

    const { startMaster } = await import('./master.js');
    const master = startMaster({
      port: 9900,
      whitelist: ['89.167.4.124', '1.2.3.4'],
      repoRoot: '/app',
      myIp: '89.167.4.124',
      machines: {
        '89.167.4.124': { environmentFile: 'environments.cloud.json' },
        '1.2.3.4': { environmentFile: 'environments.office.json' },
      },
    });

    // Connect two agents
    const mockSocket1 = new EventEmitter() as any;
    mockSocket1.close = vi.fn();
    mockSocket1.send = vi.fn();
    mockSocket1.readyState = WebSocket.OPEN;

    const mockSocket2 = new EventEmitter() as any;
    mockSocket2.close = vi.fn();
    mockSocket2.send = vi.fn();
    mockSocket2.readyState = WebSocket.OPEN;

    mockWss.emit('connection', mockSocket1, { socket: { remoteAddress: '89.167.4.124' } });
    mockWss.emit('connection', mockSocket2, { socket: { remoteAddress: '1.2.3.4' } });

    // Broadcast
    master.broadcast({ type: 'update', target: 'all', branch: 'master' });

    // calls[0] = welcome message, calls[1] = update message
    const sentMsg1 = JSON.parse(mockSocket1.send.mock.calls[1][0]);
    expect(sentMsg1.environmentFile).toBe('environments.cloud.json');

    const sentMsg2 = JSON.parse(mockSocket2.send.mock.calls[1][0]);
    expect(sentMsg2.environmentFile).toBe('environments.office.json');
  });

  it('should pass environmentFile to executeUpdate for self-update', async () => {
    const mockWss = new EventEmitter() as any;
    mockWss.clients = new Set();

    vi.mocked(WebSocketServer).mockImplementation(() => mockWss as any);

    const { startMaster } = await import('./master.js');
    const { executeUpdate } = await import('./executor.js');

    const master = startMaster({
      port: 9900,
      whitelist: ['89.167.4.124'],
      repoRoot: '/app',
      myIp: '89.167.4.124',
      machines: {
        '89.167.4.124': { environmentFile: 'environments.cloud.json' },
      },
    });

    await master.triggerUpdate('all', 'master');

    expect(executeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'master',
        repoRoot: '/app',
        environmentFile: 'environments.cloud.json',
      })
    );
  });

  it('should handle agent disconnect', async () => {
    const mockWss = new EventEmitter() as any;
    mockWss.clients = new Set();

    vi.mocked(WebSocketServer).mockImplementation(() => mockWss as any);

    const { startMaster } = await import('./master.js');
    const master = startMaster({
      port: 9900,
      whitelist: ['89.167.4.124'],
      repoRoot: '/app',
      myIp: '89.167.4.124',
    });

    const mockSocket = new EventEmitter() as any;
    mockSocket.close = vi.fn();
    mockSocket.send = vi.fn();
    mockSocket.readyState = WebSocket.OPEN;

    mockWss.emit('connection', mockSocket, { socket: { remoteAddress: '89.167.4.124' } });
    expect(master.agents.size).toBe(1);

    // Simulate disconnect
    mockSocket.emit('close');
    expect(master.agents.size).toBe(0);
  });

  it('should handle log messages from agents', async () => {
    const mockWss = new EventEmitter() as any;
    mockWss.clients = new Set();

    vi.mocked(WebSocketServer).mockImplementation(() => mockWss as any);

    const { startMaster } = await import('./master.js');
    const logs: string[] = [];
    const master = startMaster({
      port: 9900,
      whitelist: ['89.167.4.124'],
      repoRoot: '/app',
      myIp: '89.167.4.124',
    });

    const mockSocket = new EventEmitter() as any;
    mockSocket.close = vi.fn();
    mockSocket.send = vi.fn();
    mockSocket.readyState = WebSocket.OPEN;

    mockWss.emit('connection', mockSocket, { socket: { remoteAddress: '89.167.4.124' } });

    // Set up log callback via triggerUpdate
    master.triggerUpdate('none', 'master', (msg) => logs.push(msg));

    // Simulate receiving log message
    const logMsg = JSON.stringify({ type: 'log', ip: '89.167.4.124', message: 'Building...' });
    mockSocket.emit('message', logMsg);

    expect(logs.some((log) => log.includes('Building...'))).toBe(true);
  });
});
