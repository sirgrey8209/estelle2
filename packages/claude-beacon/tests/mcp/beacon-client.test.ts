/**
 * @file beacon-client.test.ts
 * @description BeaconClient 테스트
 *
 * MCP 서버에서 BeaconServer로 toolUseId lookup 요청을 보내는 TCP 클라이언트.
 *
 * 프로토콜:
 * - 요청: { "action": "lookup", "toolUseId": "toolu_xxx" }
 * - 응답: { "success": true, "conversationId": 123, "mcpHost": "127.0.0.1", "mcpPort": 9878, "raw": {...} }
 *
 * 테스트 케이스:
 * - 생성자: 기본값, 커스텀 옵션
 * - lookup: toolUseId로 ToolContext 조회
 * - 에러 처리: 연결 실패, 타임아웃, 잘못된 응답
 * - 싱글턴: getInstance, resetInstance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import net from 'net';
import { BeaconClient } from '../../src/mcp/beacon-client.js';
import type { LookupResult } from '../../src/mcp/beacon-client.js';

// ============================================================================
// 테스트용 Mock BeaconServer
// ============================================================================

/**
 * 테스트용 간단한 BeaconServer
 * 실제 BeaconServer와 동일한 프로토콜 사용
 */
class MockBeaconServer {
  private _server: net.Server | null = null;
  private _port: number;
  private _responses: Map<string, object> = new Map();

  constructor(port: number) {
    this._port = port;
  }

  /**
   * 특정 toolUseId에 대한 응답 설정
   */
  setResponse(toolUseId: string, response: object): void {
    this._responses.set(toolUseId, response);
  }

  /**
   * 서버 시작
   */
  listen(): Promise<void> {
    return new Promise((resolve) => {
      this._server = net.createServer((socket) => {
        let buffer = '';

        socket.on('data', (data) => {
          buffer += data.toString();

          try {
            const request = JSON.parse(buffer);
            buffer = '';

            // toolUseId로 응답 조회
            const toolUseId = request.toolUseId as string;
            let response = this._responses.get(toolUseId);

            if (!response) {
              response = { success: false, error: 'Tool use ID not found' };
            }

            socket.write(JSON.stringify(response));
            socket.end();
          } catch {
            // 아직 완전한 JSON이 아님
          }
        });
      });

      this._server.listen(this._port, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  /**
   * 서버 종료
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this._server) {
        resolve();
        return;
      }
      this._server.close(() => {
        this._server = null;
        resolve();
      });
    });
  }
}

/**
 * 응답하지 않는 서버 (타임아웃 테스트용)
 */
class SilentMockServer {
  private _server: net.Server | null = null;
  private _sockets: Set<net.Socket> = new Set();
  private _port: number;

  constructor(port: number) {
    this._port = port;
  }

  listen(): Promise<void> {
    return new Promise((resolve) => {
      this._server = net.createServer((socket) => {
        this._sockets.add(socket);
        socket.on('close', () => this._sockets.delete(socket));
        // 요청을 받지만 응답하지 않음
      });
      this._server.listen(this._port, '127.0.0.1', () => resolve());
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      // 모든 소켓 종료
      for (const socket of this._sockets) {
        socket.destroy();
      }
      this._sockets.clear();

      if (!this._server) {
        resolve();
        return;
      }
      this._server.close(() => {
        this._server = null;
        resolve();
      });
    });
  }
}

describe('BeaconClient', () => {
  let client: BeaconClient;
  let mockServer: MockBeaconServer;
  let TEST_PORT: number;

  // 사용 가능한 랜덤 포트 찾기
  function getRandomPort(): number {
    return 10000 + Math.floor(Math.random() * 50000);
  }

  beforeEach(() => {
    TEST_PORT = getRandomPort();
    client = new BeaconClient({ port: TEST_PORT, timeout: 3000 });
  });

  afterEach(async () => {
    BeaconClient.resetInstance();
    if (mockServer) {
      await mockServer.close();
    }
  });

  // ============================================================================
  // 생성자 테스트
  // ============================================================================
  describe('constructor', () => {
    it('should_create_instance_with_default_options', () => {
      // Act
      const defaultClient = new BeaconClient();

      // Assert
      expect(defaultClient).toBeInstanceOf(BeaconClient);
      expect(defaultClient.port).toBe(9875);
      expect(defaultClient.timeout).toBe(5000);
    });

    it('should_create_instance_with_custom_port', () => {
      // Act
      const customClient = new BeaconClient({ port: 9999 });

      // Assert
      expect(customClient.port).toBe(9999);
    });

    it('should_create_instance_with_custom_timeout', () => {
      // Act
      const customClient = new BeaconClient({ timeout: 10000 });

      // Assert
      expect(customClient.timeout).toBe(10000);
    });

    it('should_create_instance_with_all_custom_options', () => {
      // Act
      const customClient = new BeaconClient({ port: 8888, timeout: 15000 });

      // Assert
      expect(customClient.port).toBe(8888);
      expect(customClient.timeout).toBe(15000);
    });
  });

  // ============================================================================
  // 싱글턴 테스트
  // ============================================================================
  describe('singleton', () => {
    it('should_return_same_instance_from_getInstance', () => {
      // Act
      const instance1 = BeaconClient.getInstance();
      const instance2 = BeaconClient.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });

    it('should_create_new_instance_after_resetInstance', () => {
      // Arrange
      const instance1 = BeaconClient.getInstance();

      // Act
      BeaconClient.resetInstance();
      const instance2 = BeaconClient.getInstance();

      // Assert
      expect(instance1).not.toBe(instance2);
    });

    it('should_not_throw_when_resetInstance_called_without_instance', () => {
      // Arrange - 인스턴스 없는 상태에서 reset 호출

      // Act & Assert
      expect(() => BeaconClient.resetInstance()).not.toThrow();
    });
  });

  // ============================================================================
  // lookup 테스트 - 정상 케이스 (새로운 응답 형식: mcpHost, mcpPort)
  // ============================================================================
  describe('lookup - happy path', () => {
    beforeEach(async () => {
      mockServer = new MockBeaconServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_return_success_result_with_mcpHost_and_mcpPort', async () => {
      // Arrange
      const toolUseId = 'toolu_01ABC123';
      mockServer.setResponse(toolUseId, {
        success: true,
        conversationId: 2049,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        raw: { type: 'tool_use', id: toolUseId, name: 'Read', input: { file_path: '/test.ts' } },
      });

      // Act
      const result = await client.lookup(toolUseId);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.mcpHost).toBe('127.0.0.1');
        expect(result.mcpPort).toBe(9878);
        expect(result.conversationId).toBe(2049);
        expect(result.raw.name).toBe('Read');
      }
    });

    it('should_return_full_tool_context_with_raw_data', async () => {
      // Arrange
      const toolUseId = 'toolu_02DEF456';
      const rawData = {
        type: 'tool_use' as const,
        id: toolUseId,
        name: 'Write',
        input: { file_path: '/src/app.ts', content: 'hello' },
      };
      mockServer.setResponse(toolUseId, {
        success: true,
        conversationId: 1025,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        raw: rawData,
      });

      // Act
      const result = await client.lookup(toolUseId);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.raw.type).toBe('tool_use');
        expect(result.raw.id).toBe(toolUseId);
        expect(result.raw.name).toBe('Write');
        expect(result.raw.input).toEqual({ file_path: '/src/app.ts', content: 'hello' });
      }
    });

    it('should_handle_different_mcp_ports', async () => {
      // Arrange - dev, stage, release 각각 다른 포트
      mockServer.setResponse('toolu_dev', {
        success: true,
        conversationId: 1001,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,  // dev
        raw: { type: 'tool_use', id: 'toolu_dev', name: 'Read', input: {} },
      });

      // Act
      const result = await client.lookup('toolu_dev');

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.mcpPort).toBe(9878);
      }
    });
  });

  // ============================================================================
  // lookup 테스트 - 에러 케이스
  // ============================================================================
  describe('lookup - error cases', () => {
    beforeEach(async () => {
      mockServer = new MockBeaconServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_return_failure_when_tool_use_id_not_found', async () => {
      // Arrange - mockServer에 해당 toolUseId 응답 없음

      // Act
      const result = await client.lookup('nonexistent_toolu');

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/not found/i);
      }
    });

    it('should_reject_when_connection_fails', async () => {
      // Arrange - 다른 포트로 연결 시도 (서버 없음)
      const clientWithWrongPort = new BeaconClient({ port: TEST_PORT + 1000, timeout: 1000 });

      // Act & Assert
      await expect(clientWithWrongPort.lookup('toolu_01')).rejects.toThrow();
    });

    it('should_reject_when_empty_tool_use_id', async () => {
      // Act & Assert
      await expect(client.lookup('')).rejects.toThrow(/toolUseId/i);
    });
  });

  // ============================================================================
  // lookup 테스트 - 엣지 케이스
  // ============================================================================
  describe('lookup - edge cases', () => {
    beforeEach(async () => {
      mockServer = new MockBeaconServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_handle_special_characters_in_tool_use_id', async () => {
      // Arrange
      const toolUseId = 'toolu_01-ABC_123';
      mockServer.setResponse(toolUseId, {
        success: true,
        conversationId: 1001,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        raw: { type: 'tool_use', id: toolUseId, name: 'Bash', input: {} },
      });

      // Act
      const result = await client.lookup(toolUseId);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should_handle_very_long_tool_use_id', async () => {
      // Arrange
      const toolUseId = 'toolu_' + 'A'.repeat(100);
      mockServer.setResponse(toolUseId, {
        success: true,
        conversationId: 1001,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        raw: { type: 'tool_use', id: toolUseId, name: 'Read', input: {} },
      });

      // Act
      const result = await client.lookup(toolUseId);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should_handle_large_raw_input_data', async () => {
      // Arrange
      const toolUseId = 'toolu_large';
      const largeInput = { content: 'x'.repeat(10000), file_path: '/large.ts' };
      mockServer.setResponse(toolUseId, {
        success: true,
        conversationId: 1001,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        raw: { type: 'tool_use', id: toolUseId, name: 'Write', input: largeInput },
      });

      // Act
      const result = await client.lookup(toolUseId);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.raw.input as { content: string }).content.length).toBe(10000);
      }
    });
  });

  // ============================================================================
  // 타임아웃 테스트
  // ============================================================================
  describe('timeout', () => {
    let silentServer: SilentMockServer;

    afterEach(async () => {
      if (silentServer) {
        await silentServer.close();
      }
    });

    it('should_reject_when_server_does_not_respond', async () => {
      // Arrange
      silentServer = new SilentMockServer(TEST_PORT);
      await silentServer.listen();

      // 짧은 타임아웃으로 클라이언트 생성
      const shortTimeoutClient = new BeaconClient({ port: TEST_PORT, timeout: 100 });

      // Act & Assert
      await expect(shortTimeoutClient.lookup('toolu_01')).rejects.toThrow(/timeout/i);
    });

    it('should_use_custom_timeout_value', async () => {
      // Arrange
      silentServer = new SilentMockServer(TEST_PORT);
      await silentServer.listen();

      const customTimeoutClient = new BeaconClient({ port: TEST_PORT, timeout: 50 });

      // Act
      const startTime = Date.now();
      try {
        await customTimeoutClient.lookup('toolu_01');
      } catch {
        // expected
      }
      const elapsed = Date.now() - startTime;

      // Assert - 타임아웃이 50ms에서 150ms 사이여야 함
      expect(elapsed).toBeGreaterThanOrEqual(40); // 약간의 오차 허용
      expect(elapsed).toBeLessThan(200);
    });
  });

  // ============================================================================
  // 연결 동작 테스트
  // ============================================================================
  describe('connection behavior', () => {
    beforeEach(async () => {
      mockServer = new MockBeaconServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_create_new_connection_for_each_lookup', async () => {
      // Arrange
      mockServer.setResponse('toolu_01', {
        success: true,
        conversationId: 1001,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        raw: { type: 'tool_use', id: 'toolu_01', name: 'Read', input: {} },
      });
      mockServer.setResponse('toolu_02', {
        success: true,
        conversationId: 2001,
        mcpHost: '127.0.0.1',
        mcpPort: 9877,
        raw: { type: 'tool_use', id: 'toolu_02', name: 'Write', input: {} },
      });

      // Act - 두 번 호출 (각각 새 연결)
      const result1 = await client.lookup('toolu_01');
      const result2 = await client.lookup('toolu_02');

      // Assert - 둘 다 성공해야 함
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should_handle_sequential_lookups', async () => {
      // Arrange
      for (let i = 0; i < 5; i++) {
        mockServer.setResponse(`toolu_0${i}`, {
          success: true,
          conversationId: 1000 + i,
          mcpHost: '127.0.0.1',
          mcpPort: 9870 + i,
          raw: { type: 'tool_use', id: `toolu_0${i}`, name: 'Read', input: {} },
        });
      }

      // Act
      const results: LookupResult[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(await client.lookup(`toolu_0${i}`));
      }

      // Assert
      for (let i = 0; i < 5; i++) {
        expect(results[i].success).toBe(true);
      }
    });

    it('should_handle_concurrent_lookups', async () => {
      // Arrange
      mockServer.setResponse('toolu_a', {
        success: true,
        conversationId: 1001,
        mcpHost: '127.0.0.1',
        mcpPort: 9876,
        raw: { type: 'tool_use', id: 'toolu_a', name: 'Read', input: {} },
      });
      mockServer.setResponse('toolu_b', {
        success: true,
        conversationId: 2001,
        mcpHost: '127.0.0.1',
        mcpPort: 9877,
        raw: { type: 'tool_use', id: 'toolu_b', name: 'Write', input: {} },
      });
      mockServer.setResponse('toolu_c', {
        success: true,
        conversationId: 3001,
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
        raw: { type: 'tool_use', id: 'toolu_c', name: 'Edit', input: {} },
      });

      // Act - 동시에 여러 요청
      const results = await Promise.all([
        client.lookup('toolu_a'),
        client.lookup('toolu_b'),
        client.lookup('toolu_c'),
      ]);

      // Assert
      expect(results.every((r) => r.success)).toBe(true);
    });
  });
});
