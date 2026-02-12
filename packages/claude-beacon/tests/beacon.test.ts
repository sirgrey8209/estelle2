/**
 * @file beacon.test.ts
 * @description ClaudeBeacon 메인 클래스 테스트
 *
 * ClaudeBeacon은 단일 SDK 인스턴스로 여러 Pylon(dev/stage/release)을 서비스.
 * Pylon 등록/해제, 쿼리 처리, 이벤트 스트림 전달을 담당.
 *
 * 아키텍처:
 * - BeaconServer: TCP 서버 (lookup 요청 처리)
 * - ToolContextMap: toolUseId -> PylonInfo 매핑
 * - ClaudeAdapter: SDK 어댑터 (주입 가능)
 *
 * 통신 프로토콜:
 * - Pylon → Beacon (register): { "action": "register", "pylonId": 65, "mcpHost": "127.0.0.1", "mcpPort": 9878, "env": "dev" }
 * - Pylon → Beacon (query): { "action": "query", "conversationId": 2049, "options": { ... } }
 * - Beacon → Pylon (event): { "type": "event", "conversationId": 2049, "message": { ... } }
 *
 * 테스트 케이스:
 * - 생성자: SDK 어댑터 + ToolContextMap + BeaconServer
 * - registerPylon: Pylon 등록
 * - handleQuery: 쿼리 처리 + SDK 호출 + 이벤트 스트림 전달
 * - content_block_start 시 ToolContextMap 등록
 * - 다중 Pylon: dev/stage/release 동시 관리
 * - unregisterPylon: Pylon 제거
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createConnection, type Socket } from 'net';
// 아직 구현되지 않은 모듈 - 테스트 실패 예상
import { ClaudeBeacon, type ClaudeBeaconOptions } from '../src/beacon.js';
import { ToolContextMap } from '../src/tool-context-map.js';
import { MockSDK } from '../src/mock-sdk.js';

// ============================================================================
// Mock ClaudeAdapter
// ============================================================================

/**
 * 테스트용 Mock ClaudeAdapter
 */
class MockClaudeAdapter {
  private _messages: Array<{ type: string; [key: string]: unknown }> = [];
  private _delay: number = 0;

  constructor(messages?: Array<{ type: string; [key: string]: unknown }>) {
    this._messages = messages || [];
  }

  setMessages(messages: Array<{ type: string; [key: string]: unknown }>): void {
    this._messages = messages;
  }

  setDelay(ms: number): void {
    this._delay = ms;
  }

  async *query(
    _options: unknown
  ): AsyncIterable<{ type: string; [key: string]: unknown }> {
    for (const msg of this._messages) {
      if (this._delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this._delay));
      }
      yield msg;
    }
  }
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * TCP 연결하여 메시지 송수신
 */
async function sendMessage(
  port: number,
  message: unknown
): Promise<Array<unknown>> {
  return new Promise((resolve, reject) => {
    const responses: unknown[] = [];
    const client = createConnection({ port, host: '127.0.0.1' }, () => {
      client.write(JSON.stringify(message) + '\n');
    });

    let buffer = '';
    client.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          try {
            responses.push(JSON.parse(line));
          } catch {
            // 무시
          }
        }
      }
    });

    client.on('error', reject);

    // 1초 후 종료
    setTimeout(() => {
      client.end();
      resolve(responses);
    }, 1000);
  });
}

/**
 * 랜덤 포트 생성
 */
function getRandomPort(): number {
  return 30000 + Math.floor(Math.random() * 30000);
}

/**
 * 포트가 열릴 때까지 대기
 */
async function waitForPort(port: number, maxRetries = 10): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const client = createConnection({ port, host: '127.0.0.1' }, () => {
          client.end();
          resolve();
        });
        client.on('error', reject);
        setTimeout(() => {
          client.destroy();
          reject(new Error('Connection timeout'));
        }, 100);
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error(`Port ${port} not available after ${maxRetries} retries`);
}

describe('ClaudeBeacon', () => {
  let beacon: ClaudeBeacon;
  let mockAdapter: MockClaudeAdapter;
  let TEST_PORT: number;

  beforeEach(() => {
    TEST_PORT = getRandomPort();
    mockAdapter = new MockClaudeAdapter();
  });

  afterEach(async () => {
    if (beacon) {
      await beacon.stop();
    }
  });

  // ============================================================================
  // 생성자 테스트
  // ============================================================================
  describe('constructor', () => {
    it('should_create_beacon_with_adapter', () => {
      // Arrange
      const options: ClaudeBeaconOptions = {
        adapter: mockAdapter,
        port: TEST_PORT,
      };

      // Act
      beacon = new ClaudeBeacon(options);

      // Assert
      expect(beacon).toBeDefined();
      expect(beacon.port).toBe(TEST_PORT);
    });

    it('should_use_default_port_when_not_specified', () => {
      // Arrange
      const options: ClaudeBeaconOptions = {
        adapter: mockAdapter,
      };

      // Act
      beacon = new ClaudeBeacon(options);

      // Assert
      expect(beacon.port).toBe(9877);
    });

    it('should_create_internal_tool_context_map', () => {
      // Arrange & Act
      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });

      // Assert
      expect(beacon.toolContextMap).toBeInstanceOf(ToolContextMap);
    });

    it('should_use_provided_tool_context_map', () => {
      // Arrange
      const customContextMap = new ToolContextMap();

      // Act
      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
        toolContextMap: customContextMap,
      });

      // Assert
      expect(beacon.toolContextMap).toBe(customContextMap);
    });
  });

  // ============================================================================
  // start/stop 테스트
  // ============================================================================
  describe('start/stop', () => {
    it('should_start_tcp_server', async () => {
      // Arrange
      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });

      // Act
      await beacon.start();

      // Assert
      expect(beacon.isRunning).toBe(true);
      await waitForPort(TEST_PORT);
    });

    it('should_stop_tcp_server', async () => {
      // Arrange
      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });
      await beacon.start();

      // Act
      await beacon.stop();

      // Assert
      expect(beacon.isRunning).toBe(false);
    });

    it('should_not_throw_when_stopping_not_started_beacon', async () => {
      // Arrange
      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });

      // Act & Assert
      await expect(beacon.stop()).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // registerPylon 테스트
  // ============================================================================
  describe('registerPylon', () => {
    beforeEach(async () => {
      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });
      await beacon.start();
      await waitForPort(TEST_PORT);
    });

    it('should_register_pylon_with_address_and_env', async () => {
      // Arrange & Act
      const responses = await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });

      // Assert
      expect(responses[0]).toEqual({ success: true });
      expect(beacon.getPylons()).toContainEqual({
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
    });

    it('should_register_multiple_pylons', async () => {
      // Arrange & Act
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        env: 'dev',
      });
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 33,
        mcpHost: '127.0.0.1',
        mcpPort: 9877,
        env: 'stage',
      });
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 1,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        env: 'release',
      });

      // Assert
      const pylons = beacon.getPylons();
      expect(pylons).toHaveLength(3);
      expect(pylons.map((p) => p.env)).toEqual(['dev', 'stage', 'release']);
    });

    it('should_reject_duplicate_pylon_registration', async () => {
      // Arrange
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });

      // Act
      const responses = await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });

      // Assert
      expect(responses[0]).toEqual({
        success: false,
        error: expect.stringMatching(/already registered/i),
      });
    });

    it('should_update_pylon_if_env_changes', async () => {
      // Arrange
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });

      // Act - 같은 pylonId, 다른 mcpPort로 재등록
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9999,
        env: 'dev',
        force: true,
      });

      // Assert
      const pylons = beacon.getPylons();
      expect(pylons).toHaveLength(1);
      expect(pylons[0].mcpPort).toBe(9999);
    });
  });

  // ============================================================================
  // unregisterPylon 테스트
  // ============================================================================
  describe('unregisterPylon', () => {
    beforeEach(async () => {
      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });
      await beacon.start();
      await waitForPort(TEST_PORT);

      // Pylon 등록
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
    });

    it('should_unregister_pylon', async () => {
      // Act
      const responses = await sendMessage(TEST_PORT, {
        action: 'unregister',
        pylonId: 65,
      });

      // Assert
      expect(responses[0]).toEqual({ success: true });
      expect(beacon.getPylons()).toHaveLength(0);
    });

    it('should_return_error_when_pylon_not_found', async () => {
      // Act
      const responses = await sendMessage(TEST_PORT, {
        action: 'unregister',
        pylonId: 999,
      });

      // Assert
      expect(responses[0]).toEqual({
        success: false,
        error: expect.stringMatching(/not found/i),
      });
    });
  });

  // ============================================================================
  // handleQuery 테스트
  // ============================================================================
  describe('handleQuery', () => {
    beforeEach(async () => {
      // 기본 응답 설정
      mockAdapter.setMessages([
        { type: 'system', subtype: 'init', session_id: 'sess-123' },
        { type: 'result', subtype: 'success' },
      ]);

      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });
      await beacon.start();
      await waitForPort(TEST_PORT);

      // Pylon 등록
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
    });

    it('should_forward_query_to_sdk_adapter', async () => {
      // Act
      const responses = await sendMessage(TEST_PORT, {
        action: 'query',
        conversationId: 2049,
        options: {
          prompt: 'Hello, Claude!',
          cwd: 'C:\\WorkSpace\\project',
        },
      });

      // Assert - 이벤트들이 전달되어야 함
      const events = responses.filter((r: unknown) => (r as { type?: string }).type === 'event');
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it('should_send_events_with_correct_conversation_id', async () => {
      // Act
      const responses = await sendMessage(TEST_PORT, {
        action: 'query',
        conversationId: 2049,
        options: {
          prompt: 'Test',
          cwd: '/test',
        },
      });

      // Assert
      const events = responses.filter((r: unknown) => (r as { type?: string }).type === 'event') as Array<{ conversationId: number }>;
      for (const event of events) {
        expect(event.conversationId).toBe(2049);
      }
    });

    it('should_return_error_when_pylon_not_registered', async () => {
      // 이 테스트는 등록된 Pylon이 전혀 없는 상태에서 쿼리를 시도해야 함
      // beforeEach에서 등록된 Pylon을 삭제
      await sendMessage(TEST_PORT, {
        action: 'unregister',
        pylonId: 65,
      });

      // Act - 등록되지 않은 Pylon 주소로 쿼리
      const client = createConnection({ port: TEST_PORT, host: '127.0.0.1' });
      await new Promise<void>((resolve) => client.on('connect', resolve));

      // 등록하지 않고 바로 쿼리 시도
      client.write(
        JSON.stringify({
          action: 'query',
          conversationId: 9999,
          options: { prompt: 'Test', cwd: '/test' },
        }) + '\n'
      );

      const responses: unknown[] = [];
      await new Promise<void>((resolve) => {
        let buffer = '';
        client.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.trim()) {
              responses.push(JSON.parse(line));
            }
          }
        });
        setTimeout(() => {
          client.end();
          resolve();
        }, 500);
      });

      // Assert
      expect(responses[0]).toEqual({
        success: false,
        error: expect.stringMatching(/not registered/i),
      });
    });

    it('should_handle_multiple_concurrent_queries', async () => {
      // Arrange - 두 번째 Pylon 등록
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 33,
        mcpHost: '127.0.0.1',
        mcpPort: 9877,
        env: 'stage',
      });

      // Act - 동시에 쿼리
      const [responses1, responses2] = await Promise.all([
        sendMessage(TEST_PORT, {
          action: 'query',
          conversationId: 2049,
          options: { prompt: 'Query 1', cwd: '/test1' },
        }),
        sendMessage(TEST_PORT, {
          action: 'query',
          conversationId: 3073,
          options: { prompt: 'Query 2', cwd: '/test2' },
        }),
      ]);

      // Assert - 각각 이벤트 수신
      const events1 = responses1.filter((r: unknown) => (r as { type?: string }).type === 'event');
      const events2 = responses2.filter((r: unknown) => (r as { type?: string }).type === 'event');
      expect(events1.length).toBeGreaterThan(0);
      expect(events2.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // ToolContextMap 연동 테스트
  // ============================================================================
  describe('ToolContextMap integration', () => {
    beforeEach(async () => {
      // tool_use가 포함된 응답 설정
      mockAdapter.setMessages([
        { type: 'system', subtype: 'init', session_id: 'sess-123' },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              id: 'toolu_01ABC123',
              name: 'Read',
            },
          },
        },
        { type: 'result', subtype: 'success' },
      ]);

      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });
      await beacon.start();
      await waitForPort(TEST_PORT);

      // Pylon 등록
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
    });

    it('should_register_tool_use_to_context_map_on_content_block_start', async () => {
      // Act
      await sendMessage(TEST_PORT, {
        action: 'query',
        conversationId: 2049,
        options: { prompt: 'Test', cwd: '/test' },
      });

      // Assert - pylonAddress 제거됨, conversationId만 확인
      const context = beacon.toolContextMap.get('toolu_01ABC123');
      expect(context).toBeDefined();
      expect(context?.conversationId).toBe(2049);
    });

    it('should_store_tool_raw_info_in_context_map', async () => {
      // Act
      await sendMessage(TEST_PORT, {
        action: 'query',
        conversationId: 2049,
        options: { prompt: 'Test', cwd: '/test' },
      });

      // Assert
      const info = beacon.toolContextMap.get('toolu_01ABC123');
      expect(info?.raw).toEqual({
        type: 'tool_use',
        id: 'toolu_01ABC123',
        name: 'Read',
        input: expect.any(Object),
      });
    });

    it('should_handle_multiple_tool_uses_in_sequence', async () => {
      // Arrange
      mockAdapter.setMessages([
        { type: 'system', subtype: 'init' },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            content_block: { type: 'tool_use', id: 'toolu_001', name: 'Read' },
          },
        },
        {
          type: 'stream_event',
          event: { type: 'content_block_stop' },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            content_block: { type: 'tool_use', id: 'toolu_002', name: 'Write' },
          },
        },
        { type: 'result' },
      ]);

      // Act
      await sendMessage(TEST_PORT, {
        action: 'query',
        conversationId: 2049,
        options: { prompt: 'Test', cwd: '/test' },
      });

      // Assert
      expect(beacon.toolContextMap.get('toolu_001')).toBeDefined();
      expect(beacon.toolContextMap.get('toolu_002')).toBeDefined();
    });
  });

  // ============================================================================
  // 다중 Pylon 환경 테스트
  // ============================================================================
  describe('multi-pylon environment', () => {
    beforeEach(async () => {
      mockAdapter.setMessages([
        { type: 'system', subtype: 'init' },
        { type: 'result' },
      ]);

      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });
      await beacon.start();
      await waitForPort(TEST_PORT);
    });

    it('should_maintain_separate_sessions_for_different_pylons', async () => {
      // Arrange - 3개 Pylon 등록
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        env: 'dev',
      });
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 33,
        mcpHost: '127.0.0.1',
        mcpPort: 9877,
        env: 'stage',
      });
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 1,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        env: 'release',
      });

      // Assert
      expect(beacon.getPylons()).toHaveLength(3);
    });

    it('should_route_events_to_correct_pylon_by_conversation_id', async () => {
      // Arrange
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        env: 'dev',
      });
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 33,
        mcpHost: '127.0.0.1',
        mcpPort: 9877,
        env: 'stage',
      });

      // Act - 각 Pylon에서 쿼리
      const devResponses = await sendMessage(TEST_PORT, {
        action: 'query',
        conversationId: 1025,
        options: { prompt: 'Dev query', cwd: '/dev' },
      });
      const stageResponses = await sendMessage(TEST_PORT, {
        action: 'query',
        conversationId: 2049,
        options: { prompt: 'Stage query', cwd: '/stage' },
      });

      // Assert - 각 응답에 올바른 conversationId
      const devEvents = devResponses.filter((r: unknown) => (r as { type?: string }).type === 'event') as Array<{ conversationId: number }>;
      const stageEvents = stageResponses.filter((r: unknown) => (r as { type?: string }).type === 'event') as Array<{ conversationId: number }>;

      devEvents.forEach((e) => expect(e.conversationId).toBe(1025));
      stageEvents.forEach((e) => expect(e.conversationId).toBe(2049));
    });
  });

  // ============================================================================
  // 에러 처리 테스트
  // ============================================================================
  describe('error handling', () => {
    beforeEach(async () => {
      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });
      await beacon.start();
      await waitForPort(TEST_PORT);

      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });
    });

    it('should_handle_adapter_error', async () => {
      // Arrange - 에러를 던지는 어댑터
      const errorAdapter = {
        async *query(): AsyncIterable<unknown> {
          throw new Error('SDK connection failed');
        },
      };
      await beacon.stop();
      beacon = new ClaudeBeacon({
        adapter: errorAdapter,
        port: TEST_PORT,
      });
      await beacon.start();
      await waitForPort(TEST_PORT);
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });

      // Act
      const responses = await sendMessage(TEST_PORT, {
        action: 'query',
        conversationId: 2049,
        options: { prompt: 'Test', cwd: '/test' },
      });

      // Assert
      const errorResponse = responses.find(
        (r: unknown) => (r as { type?: string }).type === 'error'
      );
      expect(errorResponse).toBeDefined();
      expect((errorResponse as { error?: string }).error).toMatch(/SDK connection failed/i);
    });

    it('should_handle_invalid_action', async () => {
      // Act
      const responses = await sendMessage(TEST_PORT, {
        action: 'invalid_action',
      });

      // Assert
      expect(responses[0]).toEqual({
        success: false,
        error: expect.stringMatching(/unknown action/i),
      });
    });

    it('should_handle_missing_required_fields', async () => {
      // Act - query without conversationId
      const responses = await sendMessage(TEST_PORT, {
        action: 'query',
        options: { prompt: 'Test', cwd: '/test' },
      });

      // Assert
      expect(responses[0]).toEqual({
        success: false,
        error: expect.stringMatching(/conversationId/i),
      });
    });
  });

  // ============================================================================
  // 연결 관리 테스트
  // ============================================================================
  describe('connection management', () => {
    beforeEach(async () => {
      beacon = new ClaudeBeacon({
        adapter: mockAdapter,
        port: TEST_PORT,
      });
      await beacon.start();
      await waitForPort(TEST_PORT);
    });

    it('should_track_connected_pylons', async () => {
      // Act
      await sendMessage(TEST_PORT, {
        action: 'register',
        pylonId: 65,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        env: 'dev',
      });

      // Assert
      expect(beacon.getConnectedPylonCount()).toBe(1);
    });

    it('should_clean_up_when_pylon_disconnects', async () => {
      // Arrange
      const client = createConnection({ port: TEST_PORT, host: '127.0.0.1' });
      await new Promise<void>((resolve) => client.on('connect', resolve));

      client.write(
        JSON.stringify({
          action: 'register',
          pylonId: 65,
          mcpHost: '127.0.0.1',
          mcpPort: 9878,
          env: 'dev',
        }) + '\n'
      );

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(beacon.getConnectedPylonCount()).toBe(1);

      // Act - 연결 종료
      client.destroy();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(beacon.getConnectedPylonCount()).toBe(0);
    });
  });
});
