/**
 * @file pylon-client.test.ts
 * @description PylonClient 테스트
 *
 * MCP 도구에서 PylonMcpServer로 요청을 보내는 TCP 클라이언트.
 * 싱글턴 제거: 동적 host:port 지원
 *
 * 프로토콜:
 * - 요청: { "action": "link", "conversationId": 2049, "path": "docs/spec.md" }
 * - 요청: { "action": "unlink", "conversationId": 2049, "path": "docs/spec.md" }
 * - 요청: { "action": "list", "conversationId": 2049 }
 * - 응답: { "success": true, "docs": [...] }
 * - 응답: { "success": false, "error": "..." }
 *
 * 테스트 케이스:
 * - 생성자: host, port, timeout 옵션
 * - link: 문서 연결 (성공, conversationId 없음, 빈 path)
 * - unlink: 문서 연결 해제 (성공, 문서 없음)
 * - list: 문서 목록 조회 (성공, 빈 목록)
 * - 에러 처리: 연결 실패, 타임아웃
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import net from 'net';
import { PylonClient } from '../../src/mcp/pylon-client.js';

// ============================================================================
// 테스트용 Mock PylonMcpServer
// ============================================================================

/**
 * 테스트용 간단한 PylonMcpServer
 * 실제 PylonMcpServer와 동일한 프로토콜 사용
 */
class MockPylonServer {
  private _server: net.Server | null = null;
  private _port: number;
  private _linkedDocs: Map<number, Array<{ path: string; addedAt: number }>> = new Map();

  constructor(port: number) {
    this._port = port;
  }

  /**
   * 특정 conversationId에 문서 미리 연결 (테스트 셋업용)
   */
  setLinkedDocs(conversationId: number, docs: Array<{ path: string; addedAt: number }>): void {
    this._linkedDocs.set(conversationId, docs);
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

            const response = this._handleRequest(request);
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
   * 요청 처리
   */
  private _handleRequest(request: {
    action?: string;
    conversationId?: number;
    path?: string;
    description?: string;
  }): {
    success: boolean;
    docs?: Array<{ path: string; addedAt: number }>;
    file?: { filename: string; mimeType: string; size: number; path: string; description: string | null };
    error?: string;
  } {
    const { action, conversationId, path, description } = request;

    // conversationId 검증
    if (conversationId === undefined || typeof conversationId !== 'number') {
      return { success: false, error: 'conversationId is required and must be a number' };
    }

    switch (action) {
      case 'link': {
        if (!path || path.trim() === '') {
          return { success: false, error: 'path is required' };
        }

        // conversationId 유효성 검증 (간단히 0보다 큰 숫자인지 확인)
        if (conversationId <= 0) {
          return { success: false, error: 'conversationId not found' };
        }

        const docs = this._linkedDocs.get(conversationId) || [];
        const normalizedPath = path.replace(/\//g, '\\');

        // 중복 확인
        if (docs.some((d) => d.path === normalizedPath)) {
          return { success: false, error: 'Document already linked' };
        }

        docs.push({ path: normalizedPath, addedAt: Date.now() });
        this._linkedDocs.set(conversationId, docs);
        return { success: true, docs };
      }

      case 'unlink': {
        if (!path || path.trim() === '') {
          return { success: false, error: 'path is required' };
        }

        // conversationId 유효성 검증
        if (conversationId <= 0) {
          return { success: false, error: 'conversationId not found' };
        }

        const docs = this._linkedDocs.get(conversationId) || [];
        const normalizedPath = path.replace(/\//g, '\\');
        const index = docs.findIndex((d) => d.path === normalizedPath);

        if (index === -1) {
          return { success: false, error: 'Document not found' };
        }

        docs.splice(index, 1);
        this._linkedDocs.set(conversationId, docs);
        return { success: true, docs };
      }

      case 'list': {
        // conversationId 유효성 검증
        if (conversationId <= 0) {
          return { success: false, error: 'conversationId not found' };
        }

        const docs = this._linkedDocs.get(conversationId) || [];
        return { success: true, docs };
      }

      case 'send_file': {
        if (!path || path.trim() === '') {
          return { success: false, error: 'path is required' };
        }

        // conversationId 유효성 검증
        if (conversationId <= 0) {
          return { success: false, error: 'conversationId not found' };
        }

        // 파일 존재 확인 (간단히 'nonexistent'가 포함된 경로는 존재하지 않는 것으로 처리)
        if (path.includes('nonexistent')) {
          return { success: false, error: '파일을 찾을 수 없습니다' };
        }

        // MIME 타입 판별 (간단한 확장자 매핑)
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const mimeTypes: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          txt: 'text/plain',
          md: 'text/markdown',
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // 파일명 추출
        const filename = path.split('\\').pop() || path.split('/').pop() || path;

        return {
          success: true,
          file: {
            filename,
            mimeType,
            size: 1024, // 테스트용 고정값
            path,
            description: description ?? null,
          },
        };
      }

      default:
        return { success: false, error: 'Unknown action' };
    }
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

describe('PylonClient', () => {
  let client: PylonClient;
  let mockServer: MockPylonServer;
  let TEST_PORT: number;

  // 테스트용 상수
  const TEST_CONVERSATION_ID = 132097; // encodeConversationId(1, 1, 1)

  // 사용 가능한 랜덤 포트 찾기
  function getRandomPort(): number {
    return 10000 + Math.floor(Math.random() * 50000);
  }

  beforeEach(() => {
    TEST_PORT = getRandomPort();
    // 새로운 구조: host와 port 필수 지정
    client = new PylonClient({ host: '127.0.0.1', port: TEST_PORT, timeout: 3000 });
  });

  afterEach(async () => {
    if (mockServer) {
      await mockServer.close();
    }
  });

  // ============================================================================
  // 생성자 테스트
  // ============================================================================
  describe('constructor', () => {
    it('should_create_instance_with_host_and_port', () => {
      // Act
      const client = new PylonClient({ host: '127.0.0.1', port: 9878 });

      // Assert
      expect(client).toBeInstanceOf(PylonClient);
      expect(client.host).toBe('127.0.0.1');
      expect(client.port).toBe(9878);
      expect(client.timeout).toBe(5000); // 기본값
    });

    it('should_create_instance_with_custom_timeout', () => {
      // Act
      const client = new PylonClient({ host: '127.0.0.1', port: 9878, timeout: 10000 });

      // Assert
      expect(client.timeout).toBe(10000);
    });
  });

  // ============================================================================
  // link 테스트 - 정상 케이스
  // ============================================================================
  describe('link - happy path', () => {
    beforeEach(async () => {
      mockServer = new MockPylonServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_return_success_when_document_linked', async () => {
      // Arrange
      const path = 'docs/spec.md';

      // Act
      const result = await client.link(TEST_CONVERSATION_ID, path);

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs).toBeDefined();
      expect(result.docs).toHaveLength(1);
      expect(result.docs![0].path).toBe('docs\\spec.md');
    });

    it('should_link_multiple_documents_sequentially', async () => {
      // Arrange & Act
      await client.link(TEST_CONVERSATION_ID, 'docs/first.md');
      await client.link(TEST_CONVERSATION_ID, 'docs/second.md');
      const result = await client.link(TEST_CONVERSATION_ID, 'docs/third.md');

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs).toHaveLength(3);
    });

    it('should_return_docs_with_addedAt_timestamp', async () => {
      // Arrange
      const beforeTime = Date.now();

      // Act
      const result = await client.link(TEST_CONVERSATION_ID, 'docs/spec.md');

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs![0].addedAt).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  // ============================================================================
  // link 테스트 - 에러 케이스
  // ============================================================================
  describe('link - error cases', () => {
    beforeEach(async () => {
      mockServer = new MockPylonServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_return_failure_when_conversationId_not_found', async () => {
      // Arrange - 유효하지 않은 conversationId (0 이하)
      const invalidConversationId = 0;

      // Act
      const result = await client.link(invalidConversationId, 'docs/spec.md');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('should_return_failure_when_path_is_empty', async () => {
      // Act
      const result = await client.link(TEST_CONVERSATION_ID, '');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/path/i);
    });

    it('should_return_failure_when_linking_duplicate_document', async () => {
      // Arrange - 같은 문서 먼저 연결
      await client.link(TEST_CONVERSATION_ID, 'docs/spec.md');

      // Act - 같은 문서 다시 연결 시도
      const result = await client.link(TEST_CONVERSATION_ID, 'docs/spec.md');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already/i);
    });
  });

  // ============================================================================
  // unlink 테스트 - 정상 케이스
  // ============================================================================
  describe('unlink - happy path', () => {
    beforeEach(async () => {
      mockServer = new MockPylonServer(TEST_PORT);
      await mockServer.listen();

      // 테스트용 문서 미리 연결
      await client.link(TEST_CONVERSATION_ID, 'docs/spec.md');
    });

    it('should_return_success_when_document_unlinked', async () => {
      // Act
      const result = await client.unlink(TEST_CONVERSATION_ID, 'docs/spec.md');

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs).toHaveLength(0);
    });

    it('should_return_remaining_docs_after_unlink', async () => {
      // Arrange - 추가 문서 연결
      await client.link(TEST_CONVERSATION_ID, 'docs/readme.md');

      // Act
      const result = await client.unlink(TEST_CONVERSATION_ID, 'docs/spec.md');

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs).toHaveLength(1);
      expect(result.docs![0].path).toBe('docs\\readme.md');
    });
  });

  // ============================================================================
  // unlink 테스트 - 에러 케이스
  // ============================================================================
  describe('unlink - error cases', () => {
    beforeEach(async () => {
      mockServer = new MockPylonServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_return_failure_when_document_not_found', async () => {
      // Act - 연결되지 않은 문서 해제 시도
      const result = await client.unlink(TEST_CONVERSATION_ID, 'docs/nonexistent.md');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('should_return_failure_when_conversationId_not_found', async () => {
      // Arrange
      const invalidConversationId = 0;

      // Act
      const result = await client.unlink(invalidConversationId, 'docs/spec.md');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('should_return_failure_when_path_is_empty', async () => {
      // Act
      const result = await client.unlink(TEST_CONVERSATION_ID, '');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/path/i);
    });
  });

  // ============================================================================
  // list 테스트 - 정상 케이스
  // ============================================================================
  describe('list - happy path', () => {
    beforeEach(async () => {
      mockServer = new MockPylonServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_return_empty_list_when_no_documents_linked', async () => {
      // Act
      const result = await client.list(TEST_CONVERSATION_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs).toEqual([]);
    });

    it('should_return_linked_documents', async () => {
      // Arrange
      await client.link(TEST_CONVERSATION_ID, 'docs/first.md');
      await client.link(TEST_CONVERSATION_ID, 'docs/second.md');

      // Act
      const result = await client.list(TEST_CONVERSATION_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs).toHaveLength(2);
      expect(result.docs![0].path).toBe('docs\\first.md');
      expect(result.docs![1].path).toBe('docs\\second.md');
    });

    it('should_return_documents_with_addedAt_timestamp', async () => {
      // Arrange
      await client.link(TEST_CONVERSATION_ID, 'docs/spec.md');

      // Act
      const result = await client.list(TEST_CONVERSATION_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs![0].addedAt).toBeDefined();
      expect(typeof result.docs![0].addedAt).toBe('number');
    });
  });

  // ============================================================================
  // list 테스트 - 에러 케이스
  // ============================================================================
  describe('list - error cases', () => {
    beforeEach(async () => {
      mockServer = new MockPylonServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_return_failure_when_conversationId_not_found', async () => {
      // Arrange
      const invalidConversationId = 0;

      // Act
      const result = await client.list(invalidConversationId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  // ============================================================================
  // 연결 실패 테스트
  // ============================================================================
  describe('connection failure', () => {
    it('should_reject_link_when_connection_fails', async () => {
      // Arrange - 서버 없이 연결 시도 (잘못된 포트)
      const clientWithWrongPort = new PylonClient({ host: '127.0.0.1', port: TEST_PORT + 1000, timeout: 1000 });

      // Act & Assert
      await expect(clientWithWrongPort.link(TEST_CONVERSATION_ID, 'docs/spec.md')).rejects.toThrow();
    });

    it('should_reject_unlink_when_connection_fails', async () => {
      // Arrange
      const clientWithWrongPort = new PylonClient({ host: '127.0.0.1', port: TEST_PORT + 1000, timeout: 1000 });

      // Act & Assert
      await expect(clientWithWrongPort.unlink(TEST_CONVERSATION_ID, 'docs/spec.md')).rejects.toThrow();
    });

    it('should_reject_list_when_connection_fails', async () => {
      // Arrange
      const clientWithWrongPort = new PylonClient({ host: '127.0.0.1', port: TEST_PORT + 1000, timeout: 1000 });

      // Act & Assert
      await expect(clientWithWrongPort.list(TEST_CONVERSATION_ID)).rejects.toThrow();
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

    it('should_reject_link_when_server_does_not_respond', async () => {
      // Arrange
      silentServer = new SilentMockServer(TEST_PORT);
      await silentServer.listen();

      const shortTimeoutClient = new PylonClient({ host: '127.0.0.1', port: TEST_PORT, timeout: 100 });

      // Act & Assert
      await expect(shortTimeoutClient.link(TEST_CONVERSATION_ID, 'docs/spec.md')).rejects.toThrow(
        /timeout/i,
      );
    });

    it('should_reject_unlink_when_server_does_not_respond', async () => {
      // Arrange
      silentServer = new SilentMockServer(TEST_PORT);
      await silentServer.listen();

      const shortTimeoutClient = new PylonClient({ host: '127.0.0.1', port: TEST_PORT, timeout: 100 });

      // Act & Assert
      await expect(shortTimeoutClient.unlink(TEST_CONVERSATION_ID, 'docs/spec.md')).rejects.toThrow(
        /timeout/i,
      );
    });

    it('should_reject_list_when_server_does_not_respond', async () => {
      // Arrange
      silentServer = new SilentMockServer(TEST_PORT);
      await silentServer.listen();

      const shortTimeoutClient = new PylonClient({ host: '127.0.0.1', port: TEST_PORT, timeout: 100 });

      // Act & Assert
      await expect(shortTimeoutClient.list(TEST_CONVERSATION_ID)).rejects.toThrow(/timeout/i);
    });

    it('should_use_custom_timeout_value', async () => {
      // Arrange
      silentServer = new SilentMockServer(TEST_PORT);
      await silentServer.listen();

      const customTimeoutClient = new PylonClient({ host: '127.0.0.1', port: TEST_PORT, timeout: 50 });

      // Act
      const startTime = Date.now();
      try {
        await customTimeoutClient.link(TEST_CONVERSATION_ID, 'docs/spec.md');
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
      mockServer = new MockPylonServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_create_new_connection_for_each_request', async () => {
      // Act - 여러 번 호출
      const result1 = await client.link(TEST_CONVERSATION_ID, 'docs/a.md');
      const result2 = await client.link(TEST_CONVERSATION_ID, 'docs/b.md');
      const result3 = await client.list(TEST_CONVERSATION_ID);

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      expect(result3.docs).toHaveLength(2);
    });

    it('should_handle_sequential_operations', async () => {
      // Act
      await client.link(TEST_CONVERSATION_ID, 'docs/spec.md');
      await client.link(TEST_CONVERSATION_ID, 'docs/readme.md');
      await client.unlink(TEST_CONVERSATION_ID, 'docs/spec.md');
      const result = await client.list(TEST_CONVERSATION_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs).toHaveLength(1);
      expect(result.docs![0].path).toBe('docs\\readme.md');
    });

    it('should_handle_concurrent_operations', async () => {
      // Act - 동시에 여러 요청
      const results = await Promise.all([
        client.link(TEST_CONVERSATION_ID, 'docs/a.md'),
        client.link(TEST_CONVERSATION_ID, 'docs/b.md'),
        client.link(TEST_CONVERSATION_ID, 'docs/c.md'),
      ]);

      // Assert
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  // ============================================================================
  // 엣지 케이스 테스트
  // ============================================================================
  describe('edge cases', () => {
    beforeEach(async () => {
      mockServer = new MockPylonServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_handle_path_with_special_characters', async () => {
      // Arrange
      const path = 'docs/my-file_v2.0.md';

      // Act
      const result = await client.link(TEST_CONVERSATION_ID, path);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should_handle_deeply_nested_path', async () => {
      // Arrange
      const path = 'src/components/ui/buttons/primary/index.ts';

      // Act
      const result = await client.link(TEST_CONVERSATION_ID, path);

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs![0].path).toBe('src\\components\\ui\\buttons\\primary\\index.ts');
    });

    it('should_normalize_forward_slashes_to_backslashes', async () => {
      // Arrange
      const path = 'docs/api/spec.md';

      // Act
      const result = await client.link(TEST_CONVERSATION_ID, path);

      // Assert
      expect(result.success).toBe(true);
      expect(result.docs![0].path).toBe('docs\\api\\spec.md');
    });

    it('should_handle_whitespace_in_path', async () => {
      // Arrange
      const path = '   docs/spec.md   '; // 앞뒤 공백은 trim 되지 않음

      // Act
      const result = await client.link(TEST_CONVERSATION_ID, path);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // sendFile 테스트 - 정상 케이스
  // ============================================================================
  describe('sendFile - happy path', () => {
    beforeEach(async () => {
      mockServer = new MockPylonServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_return_success_when_file_sent', async () => {
      // Arrange
      const filePath = 'C:\\test\\file.txt';

      // Act
      const result = await client.sendFile(TEST_CONVERSATION_ID, filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(result.file).toBeDefined();
      expect(result.file!.path).toBe(filePath);
    });

    it('should_include_description_when_provided', async () => {
      // Arrange
      const filePath = 'C:\\test\\file.txt';
      const description = '테스트 파일입니다';

      // Act
      const result = await client.sendFile(TEST_CONVERSATION_ID, filePath, description);

      // Assert
      expect(result.success).toBe(true);
      expect(result.file!.description).toBe(description);
    });

    it('should_return_file_info_with_mime_type', async () => {
      // Arrange
      const filePath = 'C:\\test\\image.png';

      // Act
      const result = await client.sendFile(TEST_CONVERSATION_ID, filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(result.file!.mimeType).toBe('image/png');
    });

    it('should_return_file_info_with_filename', async () => {
      // Arrange
      const filePath = 'C:\\test\\image.png';

      // Act
      const result = await client.sendFile(TEST_CONVERSATION_ID, filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(result.file!.filename).toBe('image.png');
    });
  });

  // ============================================================================
  // sendFile 테스트 - 에러 케이스
  // ============================================================================
  describe('sendFile - error cases', () => {
    beforeEach(async () => {
      mockServer = new MockPylonServer(TEST_PORT);
      await mockServer.listen();
    });

    it('should_return_failure_when_conversationId_not_found', async () => {
      // Arrange
      const invalidConversationId = 0;

      // Act
      const result = await client.sendFile(invalidConversationId, 'C:\\test\\file.txt');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('should_return_failure_when_path_is_empty', async () => {
      // Act
      const result = await client.sendFile(TEST_CONVERSATION_ID, '');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/path/i);
    });

    it('should_return_failure_when_file_not_found', async () => {
      // Act
      const result = await client.sendFile(TEST_CONVERSATION_ID, 'C:\\nonexistent\\file.txt');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found|찾을 수 없/i);
    });
  });

  // ============================================================================
  // sendFile 테스트 - 연결 실패
  // ============================================================================
  describe('sendFile - connection failure', () => {
    it('should_reject_when_connection_fails', async () => {
      // Arrange - 서버 없이 연결 시도
      const clientWithWrongPort = new PylonClient({ host: '127.0.0.1', port: TEST_PORT + 1000, timeout: 1000 });

      // Act & Assert
      await expect(clientWithWrongPort.sendFile(TEST_CONVERSATION_ID, 'C:\\test\\file.txt')).rejects.toThrow();
    });
  });

  // ============================================================================
  // sendFile 테스트 - 타임아웃
  // ============================================================================
  describe('sendFile - timeout', () => {
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

      const shortTimeoutClient = new PylonClient({ host: '127.0.0.1', port: TEST_PORT, timeout: 100 });

      // Act & Assert
      await expect(shortTimeoutClient.sendFile(TEST_CONVERSATION_ID, 'C:\\test\\file.txt')).rejects.toThrow(
        /timeout/i,
      );
    });
  });

  // ============================================================================
  // 동적 host:port 테스트
  // ============================================================================
  describe('dynamic host:port', () => {
    let server1: MockPylonServer;
    let server2: MockPylonServer;
    let PORT1: number;
    let PORT2: number;

    beforeEach(async () => {
      PORT1 = getRandomPort();
      PORT2 = getRandomPort();
      server1 = new MockPylonServer(PORT1);
      server2 = new MockPylonServer(PORT2);
      await server1.listen();
      await server2.listen();
    });

    afterEach(async () => {
      await server1.close();
      await server2.close();
    });

    it('should_connect_to_different_servers_dynamically', async () => {
      // Arrange - 두 개의 서로 다른 PylonClient 생성
      const client1 = new PylonClient({ host: '127.0.0.1', port: PORT1 });
      const client2 = new PylonClient({ host: '127.0.0.1', port: PORT2 });

      // Act
      const result1 = await client1.link(TEST_CONVERSATION_ID, 'docs/server1.md');
      const result2 = await client2.link(TEST_CONVERSATION_ID, 'docs/server2.md');

      // Assert - 각각 독립적으로 연결됨
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // 각 서버에 하나씩만 연결됨
      const list1 = await client1.list(TEST_CONVERSATION_ID);
      const list2 = await client2.list(TEST_CONVERSATION_ID);

      expect(list1.docs).toHaveLength(1);
      expect(list2.docs).toHaveLength(1);
    });
  });
});
