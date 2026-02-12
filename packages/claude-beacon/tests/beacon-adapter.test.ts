/**
 * @file beacon-adapter.test.ts
 * @description ClaudeBeaconAdapter 테스트
 *
 * Pylon이 ClaudeBeacon을 통해 SDK를 호출하기 위한 어댑터 테스트.
 * ClaudeAdapter 인터페이스를 구현하여 ClaudeManager에 주입 가능.
 *
 * 통신 프로토콜:
 * - 연결 시: { "action": "register", "pylonId": 65, "mcpHost": "127.0.0.1", "mcpPort": 9878, "env": "dev" }
 * - 쿼리 요청: { "action": "query", "conversationId": 2049, "options": { "prompt": "...", "cwd": "..." } }
 * - 이벤트 스트림: { "type": "event", "conversationId": 2049, "message": { ... } }
 *
 * 테스트 케이스:
 * - 생성자: ClaudeBeacon 연결 정보로 생성
 * - connect: ClaudeBeacon에 TCP 연결
 * - register: Pylon 주소 등록
 * - query: 쿼리 요청 전송 + 이벤트 스트림 수신 (AsyncIterable)
 * - disconnect: 연결 종료
 * - 에러: 연결 실패, 타임아웃 등
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server, type Socket } from 'net';
// 아직 구현되지 않은 모듈 - 테스트 실패 예상
import {
  ClaudeBeaconAdapter,
  type BeaconAdapterOptions,
} from '../src/beacon-adapter.js';

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 테스트용 Mock 서버 생성
 */
function createMockBeaconServer(
  port: number,
  handler: (socket: Socket, data: string) => void
): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        // 줄바꿈으로 구분된 JSON 메시지 처리
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) {
            handler(socket, line);
          }
        }
      });
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

/**
 * 서버 종료 헬퍼
 */
async function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

/**
 * 랜덤 포트 생성
 */
function getRandomPort(): number {
  return 20000 + Math.floor(Math.random() * 40000);
}

describe('ClaudeBeaconAdapter', () => {
  let adapter: ClaudeBeaconAdapter;
  let mockServer: Server;
  let TEST_PORT: number;

  beforeEach(() => {
    TEST_PORT = getRandomPort();
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.disconnect?.();
    }
    if (mockServer) {
      await closeServer(mockServer);
    }
  });

  // ============================================================================
  // 생성자 테스트
  // ============================================================================
  describe('constructor', () => {
    it('should_create_adapter_with_host_and_port', () => {
      // Arrange
      const options: BeaconAdapterOptions = {
        host: '127.0.0.1',
        port: 9877,
      };

      // Act
      adapter = new ClaudeBeaconAdapter(options);

      // Assert
      expect(adapter).toBeDefined();
      expect(adapter.host).toBe('127.0.0.1');
      expect(adapter.port).toBe(9877);
    });

    it('should_use_default_host_when_not_specified', () => {
      // Arrange
      const options: BeaconAdapterOptions = {
        port: 9877,
      };

      // Act
      adapter = new ClaudeBeaconAdapter(options);

      // Assert
      expect(adapter.host).toBe('127.0.0.1');
    });

    it('should_use_default_port_when_not_specified', () => {
      // Arrange
      const options: BeaconAdapterOptions = {};

      // Act
      adapter = new ClaudeBeaconAdapter(options);

      // Assert
      expect(adapter.port).toBe(9877);
    });

    it('should_store_pylon_info_for_registration', () => {
      // Arrange
      const options: BeaconAdapterOptions = {
        pylonId: 33,
        mcpHost: '127.0.0.1',
        mcpPort: 9877,
        env: 'stage',
      };

      // Act
      adapter = new ClaudeBeaconAdapter(options);

      // Assert
      expect(adapter.pylonId).toBe(33);
      expect(adapter.mcpHost).toBe('127.0.0.1');
      expect(adapter.mcpPort).toBe(9877);
      expect(adapter.env).toBe('stage');
    });
  });

  // ============================================================================
  // connect 테스트
  // ============================================================================
  describe('connect', () => {
    it('should_connect_to_beacon_server', async () => {
      // Arrange
      mockServer = await createMockBeaconServer(TEST_PORT, () => {});
      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });

      // Act
      await adapter.connect();

      // Assert
      expect(adapter.isConnected).toBe(true);
    });

    it('should_reject_when_server_not_available', async () => {
      // Arrange - 서버 없이 연결 시도
      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });

      // Act & Assert
      await expect(adapter.connect()).rejects.toThrow(/connect|ECONNREFUSED/i);
    });

    it('should_reject_when_already_connected', async () => {
      // Arrange
      mockServer = await createMockBeaconServer(TEST_PORT, () => {});
      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();

      // Act & Assert
      await expect(adapter.connect()).rejects.toThrow(/already connected/i);
    });

    /**
     * 이 테스트는 스킵합니다.
     *
     * 이유: TCP 연결 타임아웃을 테스트하려면 실제로 연결이 지연되어야 하는데,
     * 로컬 서버는 핸들러가 아무것도 안 해도 TCP 연결 자체는 즉시 성공합니다.
     * 네트워크 환경에 의존적인 시나리오는 단위 테스트에서 신뢰성 있게 테스트하기 어렵습니다.
     *
     * 연결 타임아웃은 실제 환경에서 통합 테스트로 검증하는 것이 적절합니다.
     */
    it.skip('should_timeout_when_connection_takes_too_long', async () => {
      // Arrange - 응답하지 않는 서버
      const hangingServer = createServer(() => {
        // 의도적으로 아무것도 하지 않음
      });
      await new Promise<void>((resolve) => {
        hangingServer.listen(TEST_PORT, '127.0.0.1', () => resolve());
      });

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
        connectTimeout: 100, // 100ms 타임아웃
      });

      // Act & Assert
      try {
        await expect(adapter.connect()).rejects.toThrow(/timeout/i);
      } finally {
        hangingServer.close();
      }
    });
  });

  // ============================================================================
  // register 테스트
  // ============================================================================
  describe('register', () => {
    it('should_send_register_message_on_connect', async () => {
      // Arrange
      let receivedData: unknown = null;
      mockServer = await createMockBeaconServer(TEST_PORT, (_socket, data) => {
        receivedData = JSON.parse(data);
      });

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 33,
        mcpHost: '127.0.0.1',
        mcpPort: 9877,
        env: 'stage',
      });

      // Act
      await adapter.connect();
      // 잠시 대기 (메시지 전송 시간)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert
      expect(receivedData).toEqual({
        action: 'register',
        pylonId: 33,
        mcpHost: '127.0.0.1',
        mcpPort: 9877,
        env: 'stage',
      });
    });

    it('should_send_register_for_dev_environment', async () => {
      // Arrange
      let receivedData: unknown = null;
      mockServer = await createMockBeaconServer(TEST_PORT, (_socket, data) => {
        receivedData = JSON.parse(data);
      });

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        env: 'dev',
      });

      // Act
      await adapter.connect();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert
      expect(receivedData).toEqual({
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        env: 'dev',
      });
    });

    it('should_send_register_for_release_environment', async () => {
      // Arrange
      let receivedData: unknown = null;
      mockServer = await createMockBeaconServer(TEST_PORT, (_socket, data) => {
        receivedData = JSON.parse(data);
      });

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 1,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        env: 'release',
      });

      // Act
      await adapter.connect();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert
      expect(receivedData).toEqual({
        action: 'register',
        pylonId: 1,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        env: 'release',
      });
    });
  });

  // ============================================================================
  // query 테스트
  // ============================================================================
  describe('query', () => {
    it('should_send_query_request_to_beacon', async () => {
      // Arrange
      let receivedQuery: unknown = null;
      mockServer = await createMockBeaconServer(TEST_PORT, (socket, data) => {
        const parsed = JSON.parse(data);
        if (parsed.action === 'register') {
          // register 응답
          socket.write(JSON.stringify({ success: true }) + '\n');
        } else if (parsed.action === 'query') {
          receivedQuery = parsed;
          // 쿼리 완료 응답
          socket.write(
            JSON.stringify({
              type: 'event',
              conversationId: parsed.conversationId,
              message: { type: 'result', subtype: 'success' },
            }) + '\n'
          );
        }
      });

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();

      // Act
      const queryOptions = {
        prompt: 'Hello, Claude!',
        cwd: 'C:\\WorkSpace\\project',
        abortController: new AbortController(),
        conversationId: 2049,
      };

      // AsyncIterable을 소비해야 쿼리가 전송됨
      const messages = [];
      for await (const msg of adapter.query(queryOptions)) {
        messages.push(msg);
      }

      // Assert
      expect(receivedQuery).toMatchObject({
        action: 'query',
        options: {
          prompt: 'Hello, Claude!',
          cwd: 'C:\\WorkSpace\\project',
        },
      });
    });

    it('should_return_async_iterable_of_messages', async () => {
      // Arrange
      mockServer = await createMockBeaconServer(TEST_PORT, (socket, data) => {
        const parsed = JSON.parse(data);
        if (parsed.action === 'register') {
          socket.write(JSON.stringify({ success: true }) + '\n');
        } else if (parsed.action === 'query') {
          // 여러 이벤트 전송
          socket.write(
            JSON.stringify({
              type: 'event',
              conversationId: parsed.conversationId,
              message: { type: 'system', subtype: 'init', session_id: 'sess-123' },
            }) + '\n'
          );
          socket.write(
            JSON.stringify({
              type: 'event',
              conversationId: parsed.conversationId,
              message: { type: 'stream_event', event: { type: 'content_block_start' } },
            }) + '\n'
          );
          socket.write(
            JSON.stringify({
              type: 'event',
              conversationId: parsed.conversationId,
              message: { type: 'result', subtype: 'success' },
            }) + '\n'
          );
        }
      });

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();

      // Act
      const messages = [];
      for await (const msg of adapter.query({
        prompt: 'Test',
        cwd: '/test',
        abortController: new AbortController(),
        conversationId: 2049,
      })) {
        messages.push(msg);
      }

      // Assert
      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('system');
      expect(messages[1].type).toBe('stream_event');
      expect(messages[2].type).toBe('result');
    });

    it('should_include_conversation_id_in_query_request', async () => {
      // Arrange
      let receivedConversationId: number | undefined;
      mockServer = await createMockBeaconServer(TEST_PORT, (socket, data) => {
        const parsed = JSON.parse(data);
        if (parsed.action === 'register') {
          socket.write(JSON.stringify({ success: true }) + '\n');
        } else if (parsed.action === 'query') {
          receivedConversationId = parsed.conversationId;
          socket.write(
            JSON.stringify({
              type: 'event',
              conversationId: parsed.conversationId,
              message: { type: 'result' },
            }) + '\n'
          );
        }
      });

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
        conversationId: 2049,
      });
      await adapter.connect();

      // Act
      for await (const _ of adapter.query({
        prompt: 'Test',
        cwd: '/test',
        abortController: new AbortController(),
      })) {
        // consume
      }

      // Assert
      expect(receivedConversationId).toBe(2049);
    });

    it('should_throw_when_not_connected', async () => {
      // Arrange
      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });

      // Act & Assert
      const queryFn = async () => {
        for await (const _ of adapter.query({
          prompt: 'Test',
          cwd: '/test',
          abortController: new AbortController(),
        })) {
          // consume
        }
      };

      await expect(queryFn()).rejects.toThrow(/not connected/i);
    });

    it('should_stop_iteration_when_abort_controller_aborts', async () => {
      // Arrange
      mockServer = await createMockBeaconServer(TEST_PORT, (socket, data) => {
        const parsed = JSON.parse(data);
        if (parsed.action === 'register') {
          socket.write(JSON.stringify({ success: true }) + '\n');
        } else if (parsed.action === 'query') {
          // 첫 번째 이벤트만 전송하고 대기
          socket.write(
            JSON.stringify({
              type: 'event',
              conversationId: parsed.conversationId,
              message: { type: 'stream_event' },
            }) + '\n'
          );
          // 더 이상 이벤트를 보내지 않음 (중단 대기)
        }
      });

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();

      const abortController = new AbortController();
      const messages = [];

      // Act
      const queryPromise = (async () => {
        for await (const msg of adapter.query({
          prompt: 'Test',
          cwd: '/test',
          abortController,
          conversationId: 2049,
        })) {
          messages.push(msg);
          // 첫 메시지 후 abort
          abortController.abort();
        }
      })();

      await queryPromise;

      // Assert
      expect(messages).toHaveLength(1);
    });

    it('should_forward_mcp_servers_option', async () => {
      // Arrange
      let receivedMcpServers: unknown;
      mockServer = await createMockBeaconServer(TEST_PORT, (socket, data) => {
        const parsed = JSON.parse(data);
        if (parsed.action === 'register') {
          socket.write(JSON.stringify({ success: true }) + '\n');
        } else if (parsed.action === 'query') {
          receivedMcpServers = parsed.options.mcpServers;
          socket.write(
            JSON.stringify({
              type: 'event',
              conversationId: parsed.conversationId,
              message: { type: 'result' },
            }) + '\n'
          );
        }
      });

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();

      // Act
      for await (const _ of adapter.query({
        prompt: 'Test',
        cwd: '/test',
        abortController: new AbortController(),
        conversationId: 2049,
        mcpServers: {
          myServer: { command: 'node', args: ['server.js'] },
        },
      })) {
        // consume
      }

      // Assert
      expect(receivedMcpServers).toEqual({
        myServer: { command: 'node', args: ['server.js'] },
      });
    });

    it('should_handle_error_event_from_beacon', async () => {
      // Arrange
      mockServer = await createMockBeaconServer(TEST_PORT, (socket, data) => {
        const parsed = JSON.parse(data);
        if (parsed.action === 'register') {
          socket.write(JSON.stringify({ success: true }) + '\n');
        } else if (parsed.action === 'query') {
          socket.write(
            JSON.stringify({
              type: 'error',
              conversationId: parsed.conversationId,
              error: 'SDK connection failed',
            }) + '\n'
          );
        }
      });

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();

      // Act & Assert
      const queryFn = async () => {
        for await (const _ of adapter.query({
          prompt: 'Test',
          cwd: '/test',
          abortController: new AbortController(),
          conversationId: 2049,
        })) {
          // consume
        }
      };

      await expect(queryFn()).rejects.toThrow(/SDK connection failed/i);
    });
  });

  // ============================================================================
  // disconnect 테스트
  // ============================================================================
  describe('disconnect', () => {
    it('should_close_connection', async () => {
      // Arrange
      mockServer = await createMockBeaconServer(TEST_PORT, () => {});
      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();
      expect(adapter.isConnected).toBe(true);

      // Act
      await adapter.disconnect();

      // Assert
      expect(adapter.isConnected).toBe(false);
    });

    it('should_not_throw_when_not_connected', async () => {
      // Arrange
      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });

      // Act & Assert
      await expect(adapter.disconnect()).resolves.not.toThrow();
    });

    it('should_allow_reconnect_after_disconnect', async () => {
      // Arrange
      mockServer = await createMockBeaconServer(TEST_PORT, () => {});
      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();
      await adapter.disconnect();

      // Act
      await adapter.connect();

      // Assert
      expect(adapter.isConnected).toBe(true);
    });
  });

  // ============================================================================
  // 재연결 테스트
  // ============================================================================
  describe('reconnection', () => {
    it('should_detect_connection_loss', async () => {
      // Arrange - 연결 즉시 소켓을 캡처하는 서버
      let clientSocket: Socket | null = null;
      const server = createServer((socket) => {
        clientSocket = socket;
      });
      await new Promise<void>((resolve) => {
        server.listen(TEST_PORT, '127.0.0.1', () => resolve());
      });
      mockServer = server;

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();
      expect(adapter.isConnected).toBe(true);

      // 소켓이 캡처될 때까지 대기
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(clientSocket).not.toBeNull();

      // Act - 서버가 연결 종료
      clientSocket?.destroy();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert
      expect(adapter.isConnected).toBe(false);
    });

    it('should_emit_disconnect_event', async () => {
      // Arrange - 연결 즉시 소켓을 캡처하는 서버
      let clientSocket: Socket | null = null;
      const server = createServer((socket) => {
        clientSocket = socket;
      });
      await new Promise<void>((resolve) => {
        server.listen(TEST_PORT, '127.0.0.1', () => resolve());
      });
      mockServer = server;

      let disconnectCalled = false;
      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
        onDisconnect: () => {
          disconnectCalled = true;
        },
      });
      await adapter.connect();

      // 소켓이 캡처될 때까지 대기
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(clientSocket).not.toBeNull();

      // Act
      clientSocket?.destroy();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert
      expect(disconnectCalled).toBe(true);
    });
  });

  // ============================================================================
  // 자동 재연결 테스트 (기본 동작만)
  // ============================================================================
  describe('auto reconnection', () => {
    it('should_auto_reconnect_when_connection_lost', async () => {
      // Arrange: 항상 재연결 시도
      let clientSocket: Socket | null = null;
      const server = createServer((socket) => {
        clientSocket = socket;
      });
      await new Promise<void>((resolve) => {
        server.listen(TEST_PORT, '127.0.0.1', () => resolve());
      });
      mockServer = server;

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();
      expect(adapter.isConnected).toBe(true);

      // 소켓이 캡처될 때까지 대기
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(clientSocket).not.toBeNull();

      // Act: 서버가 연결 종료
      clientSocket?.destroy();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: 재연결 시도 중
      expect(adapter.isConnected).toBe(false);
      expect(adapter.isReconnecting).toBe(true);
    });

    it('should_have_isReconnecting_property', () => {
      // Arrange & Act
      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
      });

      // Assert: isReconnecting 속성 존재
      expect(adapter.isReconnecting).toBe(false);
    });

    it('should_accept_ping_options', () => {
      // Arrange & Act
      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pingInterval: 5000,
        pingTimeout: 15000,
        onReconnect: () => {},
      });

      // Assert: 생성 성공 (옵션이 유효함)
      expect(adapter).toBeDefined();
    });
  });

  // ============================================================================
  // canUseTool 콜백 전달 테스트
  // ============================================================================
  describe('canUseTool callback', () => {
    it('should_forward_permission_request_to_callback', async () => {
      // Arrange
      mockServer = await createMockBeaconServer(TEST_PORT, (socket, data) => {
        const parsed = JSON.parse(data);
        if (parsed.action === 'register') {
          socket.write(JSON.stringify({ success: true }) + '\n');
        } else if (parsed.action === 'query') {
          // 권한 요청 이벤트 전송
          socket.write(
            JSON.stringify({
              type: 'permission_request',
              conversationId: parsed.conversationId,
              toolName: 'Bash',
              input: { command: 'rm -rf /' },
            }) + '\n'
          );
        } else if (parsed.action === 'permission_response') {
          // 권한 응답 후 결과 전송 (응답에 포함된 conversationId 사용)
          socket.write(
            JSON.stringify({
              type: 'event',
              conversationId: parsed.conversationId,
              message: { type: 'result' },
            }) + '\n'
          );
        }
      });

      let permissionCallback: ((
        toolName: string,
        input: Record<string, unknown>
      ) => Promise<{ behavior: 'allow' | 'deny' }>) | undefined;

      adapter = new ClaudeBeaconAdapter({
        port: TEST_PORT,
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
      await adapter.connect();

      // Act
      let callbackCalled = false;
      let receivedToolName = '';
      let receivedInput: Record<string, unknown> = {};

      for await (const _ of adapter.query({
        prompt: 'Test',
        cwd: '/test',
        abortController: new AbortController(),
        conversationId: 2049,
        canUseTool: async (toolName, input) => {
          callbackCalled = true;
          receivedToolName = toolName;
          receivedInput = input;
          return { behavior: 'deny', message: 'Dangerous command' };
        },
      })) {
        // consume
      }

      // Assert
      expect(callbackCalled).toBe(true);
      expect(receivedToolName).toBe('Bash');
      expect(receivedInput).toEqual({ command: 'rm -rf /' });
    });
  });
});
