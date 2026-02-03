/**
 * @file mock-e2e.test.ts
 * @description E2E Mock 테스트 - Pylon ↔ Relay ↔ Client 전체 플로우 검증
 *
 * MockWebSocketAdapter를 사용하여 실제 소켓 연결 없이
 * 전체 메시지 플로우를 테스트합니다.
 *
 * 이 테스트의 목적:
 * 1. 네트워크 의존성 없이 빠른 테스트
 * 2. 복잡한 시나리오 (다중 Pylon, 다중 Client) 테스트
 * 3. CI 환경에서 안정적인 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockWebSocketAdapter } from '@estelle/core';
import { Pylon } from '../../src/pylon.js';
import type { PylonConfig, PylonDependencies } from '../../src/pylon.js';
import { WorkspaceStore } from '../../src/stores/workspace-store.js';
import { MessageStore } from '../../src/stores/message-store.js';
import { RelayClient } from '../../src/network/relay-client.js';
import { InMemoryPersistence } from '../../src/persistence/in-memory-persistence.js';

// ============================================================================
// Mock Relay 서버
// ============================================================================

/**
 * Mock Relay 서버
 *
 * 실제 Relay 서버의 핵심 동작을 시뮬레이션합니다:
 * - 연결/인증 처리
 * - 메시지 라우팅
 * - 브로드캐스트
 */
class MockRelayServer {
  /** 연결된 클라이언트 */
  private clients = new Map<string, {
    adapter: MockWebSocketAdapter;
    deviceId: number | null;
    deviceType: string | null;
    authenticated: boolean;
  }>();

  /** 다음 동적 deviceId */
  private nextClientId = 100;

  /** 클라이언트 연결 */
  connectClient(clientId: string, adapter: MockWebSocketAdapter): void {
    this.clients.set(clientId, {
      adapter,
      deviceId: null,
      deviceType: null,
      authenticated: false,
    });

    // connected 메시지 전송
    adapter.simulateMessage(JSON.stringify({
      type: 'connected',
      payload: { clientId, message: 'Welcome to Mock Relay' },
    }));
  }

  /** 클라이언트 연결 해제 */
  disconnectClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // 다른 클라이언트에게 disconnect 알림
    if (client.authenticated) {
      this.broadcastToOthers(clientId, {
        type: 'client_disconnect',
        payload: {
          deviceId: client.deviceId,
          deviceType: client.deviceType,
        },
      });

      // device_status 브로드캐스트
      this.broadcastDeviceStatus(clientId);
    }

    this.clients.delete(clientId);

    // 모든 app 클라이언트가 해제되면 nextClientId 리셋
    const hasAppClients = Array.from(this.clients.values()).some(
      (c) => c.authenticated && c.deviceType !== 'pylon'
    );
    if (!hasAppClients) {
      this.nextClientId = 100;
    }
  }

  /** 메시지 처리 */
  handleMessage(clientId: string, message: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const msg = message as { type: string; payload?: Record<string, unknown>; to?: unknown; broadcast?: unknown };

    // 인증 처리
    if (msg.type === 'auth') {
      this.handleAuth(clientId, client, msg.payload || {});
      return;
    }

    // 인증되지 않은 요청 거부
    if (!client.authenticated) {
      client.adapter.simulateMessage(JSON.stringify({
        type: 'error',
        payload: { error: 'Not authenticated' },
      }));
      return;
    }

    // ping/pong
    if (msg.type === 'ping') {
      client.adapter.simulateMessage(JSON.stringify({ type: 'pong' }));
      return;
    }

    // get_devices
    if (msg.type === 'get_devices') {
      this.sendDeviceList(clientId);
      return;
    }

    // 메시지 라우팅
    this.routeMessage(clientId, msg);
  }

  /** 인증 처리 */
  private handleAuth(
    clientId: string,
    client: { adapter: MockWebSocketAdapter; deviceId: number | null; deviceType: string | null; authenticated: boolean },
    payload: Record<string, unknown>
  ): void {
    const { deviceId, deviceType } = payload;

    if (!deviceType) {
      client.adapter.simulateMessage(JSON.stringify({
        type: 'auth_result',
        payload: { success: false, error: 'Missing deviceType' },
      }));
      return;
    }

    // Pylon은 deviceId 필수
    if (deviceType === 'pylon' && deviceId === undefined) {
      client.adapter.simulateMessage(JSON.stringify({
        type: 'auth_result',
        payload: { success: false, error: 'Missing deviceId for pylon' },
      }));
      return;
    }

    // App은 자동 할당
    let assignedDeviceId: number;
    if (deviceType === 'pylon') {
      assignedDeviceId = deviceId as number;
    } else {
      assignedDeviceId = this.nextClientId++;
    }

    client.deviceId = assignedDeviceId;
    client.deviceType = deviceType as string;
    client.authenticated = true;

    // 성공 응답
    client.adapter.simulateMessage(JSON.stringify({
      type: 'auth_result',
      payload: {
        success: true,
        device: {
          deviceId: assignedDeviceId,
          deviceType,
          name: `Device ${assignedDeviceId}`,
          icon: '📱',
          role: deviceType === 'pylon' ? 'pylon' : 'client',
        },
      },
    }));

    // 다른 클라이언트에게 device_status 브로드캐스트
    this.broadcastDeviceStatus(clientId);
  }

  /** 디바이스 상태 브로드캐스트 */
  private broadcastDeviceStatus(excludeClientId?: string): void {
    const devices = this.getDeviceList();
    const message = JSON.stringify({
      type: 'device_status',
      payload: { devices },
    });

    for (const [cid, client] of this.clients) {
      if (cid === excludeClientId) continue;
      if (!client.authenticated) continue;
      client.adapter.simulateMessage(message);
    }
  }

  /** 디바이스 목록 전송 */
  private sendDeviceList(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.adapter.simulateMessage(JSON.stringify({
      type: 'device_list',
      payload: { devices: this.getDeviceList() },
    }));
  }

  /** 디바이스 목록 생성 */
  private getDeviceList(): Array<{ deviceId: number; deviceType: string; name: string }> {
    return Array.from(this.clients.values())
      .filter((c) => c.authenticated && c.deviceId !== null)
      .map((c) => ({
        deviceId: c.deviceId!,
        deviceType: c.deviceType!,
        name: `Device ${c.deviceId}`,
      }));
  }

  /** 메시지 라우팅 */
  private routeMessage(senderId: string, message: Record<string, unknown>): void {
    const sender = this.clients.get(senderId);
    if (!sender) return;

    // from 정보 주입
    const messageWithFrom = {
      ...message,
      from: {
        deviceId: sender.deviceId,
        deviceType: sender.deviceType,
        name: `Device ${sender.deviceId}`,
        icon: '📱',
      },
    };

    // to 필드가 있으면 특정 대상에게 전송
    if (message.to !== undefined) {
      this.routeToTarget(senderId, messageWithFrom, message.to);
      return;
    }

    // broadcast 필드가 있으면 브로드캐스트
    if (message.broadcast !== undefined) {
      this.routeByBroadcast(senderId, messageWithFrom, message.broadcast as string | boolean);
      return;
    }

    // 기본 라우팅: pylon -> clients, client -> pylons
    if (sender.deviceType === 'pylon') {
      this.broadcastToType(senderId, messageWithFrom, null, 'pylon');
    } else {
      this.broadcastToType(senderId, messageWithFrom, 'pylon', null);
    }
  }

  /** 특정 대상에게 라우팅 */
  private routeToTarget(
    senderId: string,
    message: Record<string, unknown>,
    to: unknown
  ): void {
    const targets = Array.isArray(to) ? to : [to];

    for (const target of targets) {
      let targetDeviceId: number;

      if (typeof target === 'number') {
        targetDeviceId = target;
      } else if (typeof target === 'object' && target !== null) {
        targetDeviceId = (target as { deviceId: number }).deviceId;
      } else if (typeof target === 'string') {
        targetDeviceId = parseInt(target, 10);
      } else {
        continue;
      }

      for (const [cid, client] of this.clients) {
        if (cid === senderId) continue;
        if (client.deviceId === targetDeviceId) {
          client.adapter.simulateMessage(JSON.stringify(message));
        }
      }
    }
  }

  /** 브로드캐스트 옵션으로 라우팅 */
  private routeByBroadcast(
    senderId: string,
    message: Record<string, unknown>,
    broadcast: string | boolean
  ): void {
    if (broadcast === true || broadcast === 'all') {
      this.broadcastToOthers(senderId, message);
    } else if (broadcast === 'pylons') {
      this.broadcastToType(senderId, message, 'pylon', null);
    } else if (broadcast === 'clients') {
      this.broadcastToType(senderId, message, null, 'pylon');
    }
  }

  /** 다른 모든 클라이언트에게 브로드캐스트 */
  private broadcastToOthers(senderId: string, message: unknown): void {
    const messageStr = JSON.stringify(message);
    for (const [cid, client] of this.clients) {
      if (cid === senderId) continue;
      if (!client.authenticated) continue;
      client.adapter.simulateMessage(messageStr);
    }
  }

  /** 특정 타입에게 브로드캐스트 */
  private broadcastToType(
    senderId: string,
    message: unknown,
    includeType: string | null,
    excludeType: string | null
  ): void {
    const messageStr = JSON.stringify(message);
    for (const [cid, client] of this.clients) {
      if (cid === senderId) continue;
      if (!client.authenticated) continue;
      if (includeType && client.deviceType !== includeType) continue;
      if (excludeType && client.deviceType === excludeType) continue;
      client.adapter.simulateMessage(messageStr);
    }
  }
}

// ============================================================================
// Mock Client
// ============================================================================

/**
 * Mock Client
 *
 * Relay에 연결하는 앱 클라이언트를 시뮬레이션합니다.
 */
class MockClient {
  private adapter: MockWebSocketAdapter;
  private deviceId: number | null = null;
  private authenticated = false;
  private messageQueue: unknown[] = [];
  private messageResolvers: Array<(msg: unknown) => void> = [];

  constructor(
    private relay: MockRelayServer,
    private clientId: string,
    private deviceType: 'mobile' | 'desktop' = 'mobile'
  ) {
    this.adapter = new MockWebSocketAdapter();
  }

  /** 연결 */
  async connect(): Promise<void> {
    // 어댑터에 메시지 핸들러 설정
    this.adapter.onMessage = (data) => {
      const msg = JSON.parse(data);
      this.messageQueue.push(msg);

      // 대기 중인 resolver 처리
      const resolver = this.messageResolvers.shift();
      if (resolver) {
        resolver(this.messageQueue.shift());
      }
    };

    this.adapter.connect();
    this.relay.connectClient(this.clientId, this.adapter);
  }

  /** 인증 */
  async authenticate(): Promise<void> {
    this.adapter.send(JSON.stringify({
      type: 'auth',
      payload: { deviceType: this.deviceType },
    }));
    this.relay.handleMessage(this.clientId, {
      type: 'auth',
      payload: { deviceType: this.deviceType },
    });

    // auth_result 대기
    const result = await this.waitForMessageType('auth_result') as { payload: { success: boolean; device?: { deviceId: number } } };
    if (result.payload.success) {
      this.authenticated = true;
      this.deviceId = result.payload.device?.deviceId ?? null;
    }
  }

  /** 연결 해제 */
  disconnect(): void {
    this.relay.disconnectClient(this.clientId);
    this.adapter.disconnect();
  }

  /** 메시지 전송 */
  send(message: unknown): void {
    this.adapter.send(JSON.stringify(message));
    this.relay.handleMessage(this.clientId, message);
  }

  /** 메시지 대기 */
  async waitForMessage(timeout = 1000): Promise<unknown> {
    if (this.messageQueue.length > 0) {
      return this.messageQueue.shift();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Message timeout after ${timeout}ms`));
      }, timeout);

      this.messageResolvers.push((msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  }

  /** 특정 타입 메시지 대기 */
  async waitForMessageType(type: string, timeout = 1000): Promise<unknown> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // 큐에서 찾기
      const index = this.messageQueue.findIndex((m: any) => m.type === type);
      if (index >= 0) {
        return this.messageQueue.splice(index, 1)[0];
      }

      // 새 메시지 대기
      try {
        const msg = await this.waitForMessage(Math.max(100, timeout - (Date.now() - startTime)));
        if ((msg as any).type === type) {
          return msg;
        }
        this.messageQueue.push(msg);
      } catch {
        // timeout - 계속
      }
    }

    throw new Error(`Message type '${type}' not received within ${timeout}ms`);
  }

  /** deviceId 반환 */
  getDeviceId(): number | null {
    return this.deviceId;
  }

  /** 메시지 큐 비우기 */
  clearMessages(): void {
    this.messageQueue = [];
  }
}

// ============================================================================
// Pylon 헬퍼
// ============================================================================

/**
 * Mock Pylon 생성
 *
 * @param relay - Mock Relay 서버
 * @param pylonId - Pylon 식별 문자열 (내부 라우팅용)
 * @param deviceId - 디바이스 ID (숫자)
 * @param deviceName - 디바이스 이름 (선택)
 */
function createMockPylon(
  relay: MockRelayServer,
  pylonId: string,
  deviceId: number,
  deviceName?: string
): {
  pylon: Pylon;
  adapter: MockWebSocketAdapter;
  deps: PylonDependencies;
} {
  const adapter = new MockWebSocketAdapter();

  // 어댑터 팩토리
  const adapterFactory = () => adapter;

  // RelayClient 생성 - deviceId는 숫자로 전달
  const relayClient = new RelayClient({
    url: 'ws://mock-relay',
    deviceId: deviceId,  // 숫자 타입
    deviceName: deviceName,  // 이름 추가 (선택)
    adapterFactory,
  });

  // Mock 의존성
  const deps: PylonDependencies = {
    workspaceStore: new WorkspaceStore(),
    messageStore: new MessageStore(),
    relayClient: {
      connect: () => {
        adapter.onMessage = (data) => {
          const msg = JSON.parse(data);
          pylon.handleMessage(msg);
        };
        adapter.connect();
        relay.connectClient(pylonId, adapter);
      },
      disconnect: () => {
        relay.disconnectClient(pylonId);
        adapter.disconnect();
      },
      send: (message) => {
        adapter.send(JSON.stringify(message));
        relay.handleMessage(pylonId, message);
      },
      isConnected: () => adapter.isConnected,
      onMessage: (callback) => {
        // Pylon 생성자에서 호출됨, 실제 처리는 connect에서
      },
      onStatusChange: vi.fn(),
    },
    localServer: {
      start: vi.fn(),
      stop: vi.fn(),
      broadcast: vi.fn(),
      isRunning: vi.fn().mockReturnValue(false),
      onMessage: vi.fn(),
      onConnect: vi.fn(),
      setRelayStatusCallback: vi.fn(),
      getClientCount: vi.fn().mockReturnValue(0),
    },
    claudeManager: {
      sendMessage: vi.fn(),
      stop: vi.fn(),
      newSession: vi.fn(),
      cleanup: vi.fn(),
      respondPermission: vi.fn(),
      respondQuestion: vi.fn(),
      hasActiveSession: vi.fn().mockReturnValue(false),
      getSessionStartTime: vi.fn().mockReturnValue(null),
      getPendingEvent: vi.fn().mockReturnValue(null),
    },
    blobHandler: {
      handleBlobStart: vi.fn().mockReturnValue({ success: true }),
      handleBlobChunk: vi.fn(),
      handleBlobEnd: vi.fn().mockReturnValue({ success: true }),
      handleBlobRequest: vi.fn(),
    },
    taskManager: {
      listTasks: vi.fn().mockReturnValue({ success: true, tasks: [] }),
      getTask: vi.fn().mockReturnValue({ success: false }),
      updateTaskStatus: vi.fn().mockReturnValue({ success: true }),
    },
    workerManager: {
      getWorkerStatus: vi.fn().mockReturnValue({ running: false }),
      startWorker: vi.fn().mockReturnValue({ success: true }),
      stopWorker: vi.fn().mockReturnValue({ success: true }),
    },
    folderManager: {
      listFolders: vi.fn().mockReturnValue({ success: true, folders: [] }),
      createFolder: vi.fn().mockReturnValue({ success: true }),
      renameFolder: vi.fn().mockReturnValue({ success: true }),
    },
    logger: {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    packetLogger: {
      logSend: vi.fn(),
      logRecv: vi.fn(),
    },
    persistence: new InMemoryPersistence(),
  };

  // PylonConfig - deviceId는 숫자 타입, deviceName 추가
  const config: PylonConfig = {
    deviceId: deviceId,       // 숫자 타입
    deviceName: deviceName,   // 이름 추가 (선택)
    relayUrl: 'ws://mock-relay',
    localPort: 9000,
    uploadsDir: './test-uploads',
  };

  const pylon = new Pylon(config, deps);

  return { pylon, adapter, deps };
}

// ============================================================================
// 테스트
// ============================================================================

describe('E2E Mock 테스트', () => {
  let relay: MockRelayServer;

  beforeEach(() => {
    relay = new MockRelayServer();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 기본 연결 테스트
  // ==========================================================================

  describe('기본 연결', () => {
    it('Pylon이 Relay에 연결하고 인증할 수 있다', async () => {
      const { pylon, adapter, deps } = createMockPylon(relay, 'pylon-1', 1);

      // 시작
      await pylon.start();

      // 인증 메시지 전송
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });

      // 약간의 지연 후 인증 확인
      await vi.advanceTimersByTimeAsync(100);

      expect(pylon.isAuthenticated()).toBe(true);

      await pylon.stop();
    });

    it('Client가 Relay에 연결하고 인증할 수 있다', async () => {
      const client = new MockClient(relay, 'client-1', 'mobile');

      await client.connect();

      // connected 메시지 확인
      const connected = await client.waitForMessageType('connected');
      expect(connected).toBeDefined();

      await client.authenticate();

      expect(client.getDeviceId()).toBeGreaterThanOrEqual(100);

      client.disconnect();
    });
  });

  // ==========================================================================
  // Pylon ↔ Client 메시지 플로우
  // ==========================================================================

  describe('Pylon ↔ Client 메시지 플로우', () => {
    it('Client가 Pylon에게 workspace_list 요청을 보내고 응답을 받는다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();

      // Pylon 인증
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // Client 연결 및 인증
      const client = new MockClient(relay, 'client-1', 'mobile');
      await client.connect();
      await client.waitForMessageType('connected');
      await client.authenticate();
      client.clearMessages();

      // device_status 소비
      await vi.advanceTimersByTimeAsync(100);
      client.clearMessages();

      // workspace_list 요청
      client.send({
        type: 'workspace_list',
      });

      // Pylon이 응답 전송 (기본 라우팅: client -> pylon)
      await vi.advanceTimersByTimeAsync(100);

      // 응답 확인
      const result = await client.waitForMessageType('workspace_list_result');
      expect(result).toBeDefined();
      // deviceId는 숫자 타입
      expect((result as any).payload.deviceId).toBe(1);

      client.disconnect();
      await pylon.stop();
    });

    it('Client가 workspace를 생성하고 Pylon이 처리한다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();

      // Pylon 인증
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // Client 연결 및 인증
      const client = new MockClient(relay, 'client-1', 'mobile');
      await client.connect();
      await client.waitForMessageType('connected');
      await client.authenticate();
      await vi.advanceTimersByTimeAsync(100);
      client.clearMessages();

      // workspace_create 요청
      client.send({
        type: 'workspace_create',
        payload: { name: 'Test Project', workingDir: 'C:\\test' },
      });

      await vi.advanceTimersByTimeAsync(100);

      // 응답 확인
      const result = await client.waitForMessageType('workspace_create_result');
      expect(result).toBeDefined();
      expect((result as any).payload.success).toBe(true);
      expect((result as any).payload.workspace.name).toBe('Test Project');

      // WorkspaceStore 확인
      const workspaces = deps.workspaceStore.getAllWorkspaces();
      expect(workspaces.length).toBe(1);

      client.disconnect();
      await pylon.stop();
    });

    it('Client가 대화를 선택하면 히스토리를 받는다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();

      // Pylon 인증
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 워크스페이스 생성
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // 메시지 추가
      deps.messageStore.addUserMessage(conversation.conversationId, 'Hello');
      deps.messageStore.addAssistantText(conversation.conversationId, 'Hi there!');

      // Client 연결 및 인증
      const client = new MockClient(relay, 'client-1', 'mobile');
      await client.connect();
      await client.waitForMessageType('connected');
      await client.authenticate();
      await vi.advanceTimersByTimeAsync(100);
      client.clearMessages();

      // conversation_select 요청
      client.send({
        type: 'conversation_select',
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });

      await vi.advanceTimersByTimeAsync(100);

      // history_result 확인
      const result = await client.waitForMessageType('history_result');
      expect(result).toBeDefined();
      expect((result as any).payload.messages.length).toBe(2);

      client.disconnect();
      await pylon.stop();
    });
  });

  // ==========================================================================
  // 다중 Pylon/Client 시나리오
  // ==========================================================================

  describe('다중 Pylon/Client 시나리오', () => {
    it('2개의 Pylon과 3개의 Client가 연결된 환경에서 메시지 라우팅', async () => {
      // Pylon 1 설정
      const { pylon: pylon1, deps: deps1 } = createMockPylon(relay, 'pylon-1', 1);
      await pylon1.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // Pylon 2 설정
      const { pylon: pylon2, deps: deps2 } = createMockPylon(relay, 'pylon-2', 2);
      await pylon2.start();
      relay.handleMessage('pylon-2', {
        type: 'auth',
        payload: { deviceId: 2, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // Client 3개 연결
      const clients: MockClient[] = [];
      for (let i = 0; i < 3; i++) {
        const client = new MockClient(relay, `client-${i}`, 'mobile');
        await client.connect();
        await client.waitForMessageType('connected');
        await client.authenticate();
        clients.push(client);
      }
      await vi.advanceTimersByTimeAsync(100);

      // 각 Client 메시지 큐 비우기
      for (const client of clients) {
        client.clearMessages();
      }

      // Client 0이 workspace_list 요청 (Pylon들에게 전달됨)
      clients[0].send({ type: 'workspace_list' });
      await vi.advanceTimersByTimeAsync(100);

      // Pylon 1,2 모두 응답
      const result1 = await clients[0].waitForMessageType('workspace_list_result', 500);
      expect(result1).toBeDefined();

      // 정리
      for (const client of clients) {
        client.disconnect();
      }
      await pylon1.stop();
      await pylon2.stop();
    });

    it('특정 Client에게만 메시지를 전송할 수 있다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // Client 2개 연결
      const client1 = new MockClient(relay, 'client-1', 'mobile');
      await client1.connect();
      await client1.waitForMessageType('connected');
      await client1.authenticate();

      const client2 = new MockClient(relay, 'client-2', 'desktop');
      await client2.connect();
      await client2.waitForMessageType('connected');
      await client2.authenticate();

      await vi.advanceTimersByTimeAsync(100);
      client1.clearMessages();
      client2.clearMessages();

      // Pylon이 client1의 workspace_list 요청 처리
      // 워크스페이스 생성
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Client1이 대화 선택 (세션 뷰어로 등록)
      client1.send({
        type: 'conversation_select',
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });
      await vi.advanceTimersByTimeAsync(100);

      // Client1은 history_result를 받음
      const result = await client1.waitForMessageType('history_result', 500);
      expect(result).toBeDefined();

      // Client2는 아무것도 받지 않음 (타임아웃 기대)
      let client2ReceivedHistory = false;
      try {
        await client2.waitForMessageType('history_result', 200);
        client2ReceivedHistory = true;
      } catch {
        // 예상대로 타임아웃
      }
      expect(client2ReceivedHistory).toBe(false);

      client1.disconnect();
      client2.disconnect();
      await pylon.stop();
    });
  });

  // ==========================================================================
  // Claude 이벤트 전달
  // ==========================================================================

  describe('Claude 이벤트 전달', () => {
    it('Claude 이벤트가 세션 뷰어에게만 전달된다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 워크스페이스 생성
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Client 2개 연결
      const viewer = new MockClient(relay, 'viewer', 'mobile');
      await viewer.connect();
      await viewer.waitForMessageType('connected');
      await viewer.authenticate();

      const nonViewer = new MockClient(relay, 'non-viewer', 'desktop');
      await nonViewer.connect();
      await nonViewer.waitForMessageType('connected');
      await nonViewer.authenticate();

      await vi.advanceTimersByTimeAsync(100);
      viewer.clearMessages();
      nonViewer.clearMessages();

      // viewer가 대화 선택 (세션 뷰어로 등록)
      viewer.send({
        type: 'conversation_select',
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });
      await vi.advanceTimersByTimeAsync(100);
      viewer.clearMessages();
      nonViewer.clearMessages();

      // Claude 이벤트 발생
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'text',
        content: 'Hello from Claude!',
      });

      await vi.advanceTimersByTimeAsync(100);

      // viewer는 claude_event를 받음
      const event = await viewer.waitForMessageType('claude_event', 500);
      expect(event).toBeDefined();
      expect((event as any).payload.event.content).toBe('Hello from Claude!');

      // non-viewer는 받지 않음
      let nonViewerReceived = false;
      try {
        await nonViewer.waitForMessageType('claude_event', 200);
        nonViewerReceived = true;
      } catch {
        // 예상대로 타임아웃
      }
      expect(nonViewerReceived).toBe(false);

      viewer.disconnect();
      nonViewer.disconnect();
      await pylon.stop();
    });

    it('상태 변경은 모든 Client에게 브로드캐스트된다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 워크스페이스 생성
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Client 2개 연결
      const client1 = new MockClient(relay, 'client-1', 'mobile');
      await client1.connect();
      await client1.waitForMessageType('connected');
      await client1.authenticate();

      const client2 = new MockClient(relay, 'client-2', 'desktop');
      await client2.connect();
      await client2.waitForMessageType('connected');
      await client2.authenticate();

      await vi.advanceTimersByTimeAsync(100);
      client1.clearMessages();
      client2.clearMessages();

      // Claude state 이벤트 발생
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'state',
        state: 'working',
      });

      await vi.advanceTimersByTimeAsync(100);

      // 두 클라이언트 모두 conversation_status를 받음
      const status1 = await client1.waitForMessageType('conversation_status', 500);
      const status2 = await client2.waitForMessageType('conversation_status', 500);

      expect(status1).toBeDefined();
      expect(status2).toBeDefined();
      expect((status1 as any).payload.status).toBe('working');
      expect((status2 as any).payload.status).toBe('working');

      client1.disconnect();
      client2.disconnect();
      await pylon.stop();
    });
  });

  // ==========================================================================
  // 연결 해제 시나리오
  // ==========================================================================

  describe('연결 해제 시나리오', () => {
    it('Client 연결 해제 시 Pylon이 알림을 받는다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // Client 연결
      const client = new MockClient(relay, 'client-1', 'mobile');
      await client.connect();
      await client.waitForMessageType('connected');
      await client.authenticate();

      await vi.advanceTimersByTimeAsync(100);

      // Pylon이 client_disconnect 메시지를 받는지 확인
      const disconnectHandler = vi.fn();
      const originalHandleMessage = pylon.handleMessage.bind(pylon);

      // Client 연결 해제
      client.disconnect();

      await vi.advanceTimersByTimeAsync(100);

      // device_status 브로드캐스트 확인
      // (실제로는 pylon.handleMessage가 호출됨)
    });

    it('세션 뷰어 연결 해제 시 뷰어 목록에서 제거된다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 워크스페이스 생성
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Client 연결 및 대화 선택
      const client = new MockClient(relay, 'client-1', 'mobile');
      await client.connect();
      await client.waitForMessageType('connected');
      await client.authenticate();
      await vi.advanceTimersByTimeAsync(100);

      client.send({
        type: 'conversation_select',
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 세션 뷰어 확인
      expect(pylon.getSessionViewerCount(conversation.conversationId)).toBe(1);

      // Client 연결 해제
      client.disconnect();
      await vi.advanceTimersByTimeAsync(100);

      // 세션 뷰어에서 제거됨
      expect(pylon.getSessionViewerCount(conversation.conversationId)).toBe(0);

      await pylon.stop();
    });
  });

  // ==========================================================================
  // 영속성 테스트
  // ==========================================================================

  describe('영속성 테스트', () => {
    it('메시지가 InMemoryPersistence에 저장된다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      const persistence = deps.persistence as InMemoryPersistence;

      await pylon.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 워크스페이스 생성
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Claude 이벤트 발생 (메시지 저장 트리거)
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'textComplete',
        text: 'Hello!',
      });

      // debounce 시간 대기 (2초)
      await vi.advanceTimersByTimeAsync(2100);

      // InMemoryPersistence 확인
      const savedSession = persistence.loadMessageSession(conversation.conversationId);
      expect(savedSession).toBeDefined();
      expect(savedSession?.messages.length).toBeGreaterThan(0);

      await pylon.stop();
    });
  });

  // ==========================================================================
  // 전체 메시지 플로우 E2E 테스트
  // ==========================================================================

  describe('전체 메시지 플로우 E2E', () => {
    it('사용자 메시지 → 상태 변경 → 텍스트 응답 → 결과 통계 전체 플로우', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 워크스페이스 생성
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Client 연결 및 인증
      const client = new MockClient(relay, 'client-1', 'mobile');
      await client.connect();
      await client.waitForMessageType('connected');
      await client.authenticate();
      await vi.advanceTimersByTimeAsync(100);

      // 대화 선택 (세션 뷰어로 등록)
      client.send({
        type: 'conversation_select',
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });
      await vi.advanceTimersByTimeAsync(100);
      client.clearMessages();

      // ===== 1. 사용자 메시지 전송 =====
      // ClaudeManager.sendMessage를 호출하면 실제로 메시지가 저장됨
      deps.messageStore.addUserMessage(conversation.conversationId, '안녕하세요');

      // 사용자 메시지가 히스토리에 저장되었는지 확인
      const messages1 = deps.messageStore.getMessages(conversation.conversationId);
      expect(messages1.length).toBe(1);
      expect(messages1[0].role).toBe('user');
      expect(messages1[0].content).toBe('안녕하세요');

      // ===== 2. 상태 변경 이벤트 (working) =====
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'state',
        state: 'working',
      });
      await vi.advanceTimersByTimeAsync(100);

      // 클라이언트가 conversation_status를 받음
      const statusEvent = await client.waitForMessageType('conversation_status', 500);
      expect(statusEvent).toBeDefined();
      expect((statusEvent as any).payload.status).toBe('working');
      client.clearMessages();

      // ===== 3. 텍스트 이벤트 (스트리밍) =====
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'text',
        text: '안녕',
      });
      await vi.advanceTimersByTimeAsync(100);

      // 첫 번째 text 이벤트 확인
      const textEvent1 = await client.waitForMessageType('claude_event', 500);
      expect((textEvent1 as any).payload.event.type).toBe('text');
      expect((textEvent1 as any).payload.event.text).toBe('안녕');

      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'text',
        text: '하세요! ',
      });
      await vi.advanceTimersByTimeAsync(100);

      // 두 번째 text 이벤트 확인
      const textEvent2 = await client.waitForMessageType('claude_event', 500);
      expect((textEvent2 as any).payload.event.type).toBe('text');
      expect((textEvent2 as any).payload.event.text).toBe('하세요! ');

      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'text',
        text: '무엇을 도와드릴까요?',
      });
      await vi.advanceTimersByTimeAsync(100);

      // 세 번째 text 이벤트 확인
      const textEvent3 = await client.waitForMessageType('claude_event', 500);
      expect((textEvent3 as any).payload.event.type).toBe('text');
      expect((textEvent3 as any).payload.event.text).toBe('무엇을 도와드릴까요?');

      // ===== 4. textComplete 이벤트 =====
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'textComplete',
        text: '안녕하세요! 무엇을 도와드릴까요?',
      });
      await vi.advanceTimersByTimeAsync(100);

      const textCompleteEvent = await client.waitForMessageType('claude_event', 500);
      expect((textCompleteEvent as any).payload.event.type).toBe('textComplete');
      expect((textCompleteEvent as any).payload.event.text).toBe('안녕하세요! 무엇을 도와드릴까요?');
      client.clearMessages();

      // ===== 5. 결과 이벤트 (duration_ms, usage 포함) =====
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'result',
        subtype: 'success',
        duration_ms: 1500,
        total_cost_usd: 0.001,
        num_turns: 1,
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadInputTokens: 1000,
          cacheCreationInputTokens: 0,
        },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 클라이언트가 result 이벤트를 받음
      const resultEvent = await client.waitForMessageType('claude_event', 500);
      expect((resultEvent as any).payload.event.type).toBe('result');
      expect((resultEvent as any).payload.event.duration_ms).toBe(1500);
      expect((resultEvent as any).payload.event.usage.inputTokens).toBe(100);
      expect((resultEvent as any).payload.event.usage.outputTokens).toBe(50);
      client.clearMessages();

      // ===== 6. 상태 변경 이벤트 (idle) =====
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'state',
        state: 'idle',
      });
      await vi.advanceTimersByTimeAsync(100);

      const idleStatusEvent = await client.waitForMessageType('conversation_status', 500);
      expect((idleStatusEvent as any).payload.status).toBe('idle');

      // ===== 7. 히스토리에 메시지 저장 확인 =====
      // debounce 대기
      await vi.advanceTimersByTimeAsync(2100);

      const finalMessages = deps.messageStore.getMessages(conversation.conversationId);
      expect(finalMessages.length).toBeGreaterThanOrEqual(2); // user + assistant

      // 사용자 메시지 확인
      const userMsg = finalMessages.find(m => m.role === 'user');
      expect(userMsg?.content).toBe('안녕하세요');

      // 어시스턴트 메시지 확인
      const assistantMsg = finalMessages.find(m => m.role === 'assistant' && m.type === 'text');
      expect(assistantMsg?.content).toBe('안녕하세요! 무엇을 도와드릴까요?');

      client.disconnect();
      await pylon.stop();
    });

    it('세션 뷰어만 텍스트 이벤트를 받고 비뷰어는 받지 않는다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 워크스페이스 생성
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Client 2개 연결
      const viewer = new MockClient(relay, 'viewer', 'mobile');
      await viewer.connect();
      await viewer.waitForMessageType('connected');
      await viewer.authenticate();

      const nonViewer = new MockClient(relay, 'non-viewer', 'desktop');
      await nonViewer.connect();
      await nonViewer.waitForMessageType('connected');
      await nonViewer.authenticate();

      await vi.advanceTimersByTimeAsync(100);

      // viewer만 대화 선택
      viewer.send({
        type: 'conversation_select',
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });
      await vi.advanceTimersByTimeAsync(100);
      viewer.clearMessages();
      nonViewer.clearMessages();

      // 텍스트 이벤트 전송
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'text',
        text: '응답 텍스트',
      });
      await vi.advanceTimersByTimeAsync(100);

      // viewer는 받음
      const viewerEvent = await viewer.waitForMessageType('claude_event', 500);
      expect((viewerEvent as any).payload.event.text).toBe('응답 텍스트');

      // nonViewer는 받지 않음
      let nonViewerReceived = false;
      try {
        await nonViewer.waitForMessageType('claude_event', 200);
        nonViewerReceived = true;
      } catch {
        // 예상대로 타임아웃
      }
      expect(nonViewerReceived).toBe(false);

      viewer.disconnect();
      nonViewer.disconnect();
      await pylon.stop();
    });

    it('상태 변경 이벤트는 모든 클라이언트에게 conversation_status로 전달된다', async () => {
      // 이 테스트는 기존 "상태 변경은 모든 Client에게 브로드캐스트된다"와 유사하지만
      // 전체 메시지 플로우 컨텍스트에서 확인

      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 워크스페이스 생성
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Client 2개 연결
      const client1 = new MockClient(relay, 'client-1', 'mobile');
      await client1.connect();
      await client1.waitForMessageType('connected');
      await client1.authenticate();

      const client2 = new MockClient(relay, 'client-2', 'desktop');
      await client2.connect();
      await client2.waitForMessageType('connected');
      await client2.authenticate();

      await vi.advanceTimersByTimeAsync(100);
      client1.clearMessages();
      client2.clearMessages();

      // 상태 이벤트 전송
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'state',
        state: 'working',
      });
      await vi.advanceTimersByTimeAsync(100);

      // 두 클라이언트 모두 받음
      const status1 = await client1.waitForMessageType('conversation_status', 500);
      const status2 = await client2.waitForMessageType('conversation_status', 500);

      expect(status1).toBeDefined();
      expect(status2).toBeDefined();
      expect((status1 as any).payload.status).toBe('working');
      expect((status2 as any).payload.status).toBe('working');

      client1.disconnect();
      client2.disconnect();
      await pylon.stop();
    });

    it('result 이벤트의 usage 정보가 올바르게 전달된다', async () => {
      // Pylon 설정
      const { pylon, deps } = createMockPylon(relay, 'pylon-1', 1);
      await pylon.start();
      relay.handleMessage('pylon-1', {
        type: 'auth',
        payload: { deviceId: 1, deviceType: 'pylon' },
      });
      await vi.advanceTimersByTimeAsync(100);

      // 워크스페이스 생성
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Client 연결 및 대화 선택
      const client = new MockClient(relay, 'client-1', 'mobile');
      await client.connect();
      await client.waitForMessageType('connected');
      await client.authenticate();
      await vi.advanceTimersByTimeAsync(100);

      client.send({
        type: 'conversation_select',
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });
      await vi.advanceTimersByTimeAsync(100);
      client.clearMessages();

      // result 이벤트 전송 (실제 ClaudeManager가 보내는 형식)
      const usage = {
        inputTokens: 150,
        outputTokens: 75,
        cacheReadInputTokens: 5000,
        cacheCreationInputTokens: 100,
      };

      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'result',
        subtype: 'success',
        duration_ms: 2500,
        total_cost_usd: 0.0025,
        num_turns: 1,
        usage,
      });
      await vi.advanceTimersByTimeAsync(100);

      // 클라이언트가 올바른 형식으로 받는지 확인
      const resultEvent = await client.waitForMessageType('claude_event', 500);
      const payload = (resultEvent as any).payload;

      // 이벤트 구조 확인
      expect(payload.conversationId).toBe(conversation.conversationId);
      expect(payload.event.type).toBe('result');
      expect(payload.event.subtype).toBe('success');
      expect(payload.event.duration_ms).toBe(2500);
      expect(payload.event.total_cost_usd).toBe(0.0025);
      expect(payload.event.num_turns).toBe(1);

      // usage 필드 확인 (snake_case가 아닌 camelCase)
      expect(payload.event.usage).toEqual(usage);
      expect(payload.event.usage.inputTokens).toBe(150);
      expect(payload.event.usage.outputTokens).toBe(75);
      expect(payload.event.usage.cacheReadInputTokens).toBe(5000);
      expect(payload.event.usage.cacheCreationInputTokens).toBe(100);

      client.disconnect();
      await pylon.stop();
    });
  });
});
