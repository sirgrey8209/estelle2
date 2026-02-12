/**
 * @file pylon-mcp-server.test.ts
 * @description PylonMcpServer 테스트
 *
 * Pylon 내부에서 실행되는 TCP 서버.
 * MCP 도구가 WorkspaceStore에 접근할 수 있도록 중계한다.
 *
 * 프로토콜:
 * - 요청: { "action": "link", "conversationId": 2049, "path": "docs/spec.md" }
 * - 요청: { "action": "unlink", "conversationId": 2049, "path": "docs/spec.md" }
 * - 요청: { "action": "list", "conversationId": 2049 }
 * - 응답: { "success": true, "docs": [...] }
 * - 응답: { "success": false, "error": "..." }
 *
 * 테스트 케이스:
 * - 생성자: 기본값, 커스텀 옵션
 * - listen/close: TCP 서버 시작/종료
 * - link action: 문서 연결 (성공/실패)
 * - unlink action: 문서 연결 해제 (성공/실패)
 * - list action: 문서 목록 조회 (성공/빈 목록)
 * - 에러 처리: 잘못된 action, 빈 conversationId 등
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConnection } from 'net';
// 아직 구현되지 않은 모듈 - 테스트 실패 예상
import { PylonMcpServer } from '../../src/servers/pylon-mcp-server.js';
import { WorkspaceStore } from '../../src/stores/workspace-store.js';

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * TCP 클라이언트로 요청 전송 후 응답 수신
 */
async function sendRequest(port: number, request: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const client = createConnection({ port, host: '127.0.0.1' }, () => {
      client.write(JSON.stringify(request));
    });

    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
      // 완전한 JSON 수신 시 파싱
      try {
        const response = JSON.parse(data);
        client.end();
        resolve(response);
      } catch {
        // 아직 완전한 JSON이 아님, 계속 수신
      }
    });

    client.on('error', reject);
    client.on('close', () => {
      if (!data) {
        reject(new Error('Connection closed without response'));
      }
    });

    // 타임아웃
    setTimeout(() => {
      client.destroy();
      reject(new Error('Request timeout'));
    }, 5000);
  });
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

/**
 * 사용 가능한 랜덤 포트 반환
 */
function getRandomPort(): number {
  return 10000 + Math.floor(Math.random() * 50000);
}

describe('PylonMcpServer', () => {
  let server: PylonMcpServer;
  let workspaceStore: WorkspaceStore;
  let TEST_PORT: number;

  // 테스트용 상수
  const PYLON_ID = 1;
  const WORKSPACE_ID = 1;
  // encodeConversationId(1, 1, 1) = (1 << 17) | (1 << 10) | 1 = 132097
  const TEST_CONVERSATION_ID = 132097;

  beforeEach(() => {
    // WorkspaceStore 설정: 워크스페이스와 대화 생성
    workspaceStore = new WorkspaceStore(PYLON_ID);
    workspaceStore.createWorkspace('Test Workspace', 'C:\\test');
    workspaceStore.createConversation(WORKSPACE_ID, 'Test Conversation');

    TEST_PORT = getRandomPort();
    server = new PylonMcpServer(workspaceStore, { port: TEST_PORT });
  });

  afterEach(async () => {
    await server.close();
  });

  // ============================================================================
  // 생성자 테스트
  // ============================================================================
  describe('constructor', () => {
    it('should_create_server_with_workspace_store', () => {
      // Assert
      expect(server).toBeDefined();
      expect(server.isListening).toBe(false);
    });

    it('should_use_default_port_when_not_specified', () => {
      // Arrange
      const defaultServer = new PylonMcpServer(workspaceStore);

      // Assert
      expect(defaultServer.port).toBe(9880);
    });

    it('should_use_custom_port_when_specified', () => {
      // Arrange
      const customServer = new PylonMcpServer(workspaceStore, { port: 9999 });

      // Assert
      expect(customServer.port).toBe(9999);
    });
  });

  // ============================================================================
  // listen 테스트
  // ============================================================================
  describe('listen', () => {
    it('should_start_tcp_server_on_specified_port', async () => {
      // Act
      await server.listen();

      // Assert
      expect(server.isListening).toBe(true);
      await waitForPort(TEST_PORT);
    });

    it('should_reject_when_port_already_in_use', async () => {
      // Arrange - 첫 번째 서버 시작
      await server.listen();

      // 같은 포트로 두 번째 서버 시작 시도
      const server2 = new PylonMcpServer(workspaceStore, { port: TEST_PORT });

      // Act & Assert
      await expect(server2.listen()).rejects.toThrow();

      await server2.close();
    });
  });

  // ============================================================================
  // close 테스트
  // ============================================================================
  describe('close', () => {
    it('should_stop_tcp_server', async () => {
      // Arrange
      await server.listen();
      expect(server.isListening).toBe(true);

      // Act
      await server.close();

      // Assert
      expect(server.isListening).toBe(false);
    });

    it('should_not_throw_when_server_not_started', async () => {
      // Act & Assert - 시작하지 않은 서버 종료 시 에러 없음
      await expect(server.close()).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // link action 테스트
  // ============================================================================
  describe('link action', () => {
    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_link_document_successfully', async () => {
      // Arrange
      const request = {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/spec.md',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        docs: Array<{ path: string; addedAt: number }>;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.docs).toHaveLength(1);
      expect(response.docs[0].path).toBe('docs\\spec.md'); // 경로 정규화
    });

    it('should_link_multiple_documents', async () => {
      // Arrange & Act
      await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/spec.md',
      });
      await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/readme.md',
      });

      const listResponse = (await sendRequest(TEST_PORT, {
        action: 'list',
        conversationId: TEST_CONVERSATION_ID,
      })) as { success: boolean; docs: Array<{ path: string }> };

      // Assert
      expect(listResponse.success).toBe(true);
      expect(listResponse.docs).toHaveLength(2);
    });

    it('should_return_error_when_linking_duplicate_document', async () => {
      // Arrange - 같은 문서를 두 번 연결 시도
      await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/spec.md',
      });

      // Act
      const response = (await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/spec.md',
      })) as { success: boolean; error: string };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/duplicate|already|exists/i);
    });

    it('should_return_error_when_conversation_id_not_found', async () => {
      // Arrange
      const request = {
        action: 'link',
        conversationId: 99999, // 존재하지 않는 conversationId
        path: 'docs/spec.md',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/not found|invalid/i);
    });

    it('should_return_error_when_path_is_empty', async () => {
      // Arrange
      const request = {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: '',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/path/i);
    });
  });

  // ============================================================================
  // unlink action 테스트
  // ============================================================================
  describe('unlink action', () => {
    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);

      // 테스트용 문서 연결
      await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/spec.md',
      });
    });

    it('should_unlink_document_successfully', async () => {
      // Arrange
      const request = {
        action: 'unlink',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/spec.md',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        docs: Array<{ path: string }>;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.docs).toHaveLength(0);
    });

    it('should_return_error_when_unlinking_non_existent_document', async () => {
      // Arrange
      const request = {
        action: 'unlink',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/not-exist.md',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/not found|not linked/i);
    });

    it('should_return_error_when_conversation_id_not_found', async () => {
      // Arrange
      const request = {
        action: 'unlink',
        conversationId: 99999, // 존재하지 않는 conversationId
        path: 'docs/spec.md',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/not found|invalid/i);
    });

    it('should_return_error_when_path_is_empty', async () => {
      // Arrange
      const request = {
        action: 'unlink',
        conversationId: TEST_CONVERSATION_ID,
        path: '',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/path/i);
    });
  });

  // ============================================================================
  // list action 테스트
  // ============================================================================
  describe('list action', () => {
    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_return_empty_list_when_no_documents_linked', async () => {
      // Arrange
      const request = {
        action: 'list',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        docs: Array<{ path: string; addedAt: number }>;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.docs).toEqual([]);
    });

    it('should_return_linked_documents_in_order', async () => {
      // Arrange - 문서 3개 연결
      await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/first.md',
      });
      await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/second.md',
      });
      await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/third.md',
      });

      // Act
      const response = (await sendRequest(TEST_PORT, {
        action: 'list',
        conversationId: TEST_CONVERSATION_ID,
      })) as {
        success: boolean;
        docs: Array<{ path: string; addedAt: number }>;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.docs).toHaveLength(3);
      // 추가 순서대로 반환
      expect(response.docs[0].path).toBe('docs\\first.md');
      expect(response.docs[1].path).toBe('docs\\second.md');
      expect(response.docs[2].path).toBe('docs\\third.md');
    });

    it('should_return_error_when_conversation_id_not_found', async () => {
      // Arrange
      const request = {
        action: 'list',
        conversationId: 99999, // 존재하지 않는 conversationId
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/not found|invalid/i);
    });
  });

  // ============================================================================
  // 에러 케이스 테스트
  // ============================================================================
  describe('error cases', () => {
    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_return_error_when_action_is_missing', async () => {
      // Act
      const response = (await sendRequest(TEST_PORT, {
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/spec.md',
      })) as { success: boolean; error: string };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/action/i);
    });

    it('should_return_error_when_action_is_unknown', async () => {
      // Act
      const response = (await sendRequest(TEST_PORT, {
        action: 'unknown_action',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/spec.md',
      })) as { success: boolean; error: string };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/unknown action/i);
    });

    it('should_return_error_when_conversation_id_is_missing', async () => {
      // Act
      const response = (await sendRequest(TEST_PORT, {
        action: 'link',
        path: 'docs/spec.md',
      })) as { success: boolean; error: string };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/conversationId/i);
    });

    it('should_return_error_when_conversation_id_is_not_a_number', async () => {
      // Act
      const response = (await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: 'not-a-number',
        path: 'docs/spec.md',
      })) as { success: boolean; error: string };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/conversationId|invalid/i);
    });

    it('should_return_error_when_path_is_missing_for_link', async () => {
      // Act
      const response = (await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
      })) as { success: boolean; error: string };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/path/i);
    });

    it('should_return_error_when_path_is_missing_for_unlink', async () => {
      // Act
      const response = (await sendRequest(TEST_PORT, {
        action: 'unlink',
        conversationId: TEST_CONVERSATION_ID,
      })) as { success: boolean; error: string };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/path/i);
    });

    it('should_return_error_when_request_is_invalid_json', async () => {
      // Arrange
      const response = await new Promise<object>((resolve, reject) => {
        const client = createConnection({ port: TEST_PORT, host: '127.0.0.1' }, () => {
          client.write('invalid json {{{');
        });

        let data = '';
        client.on('data', (chunk) => {
          data += chunk.toString();
          try {
            const parsed = JSON.parse(data);
            client.end();
            resolve(parsed);
          } catch {
            // 계속 수신
          }
        });

        client.on('error', reject);
        setTimeout(() => {
          client.destroy();
          reject(new Error('Timeout'));
        }, 5000);
      });

      // Assert
      const errorResponse = response as { success: boolean; error: string };
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toMatch(/json/i);
    });
  });

  // ============================================================================
  // 동시 연결 테스트
  // ============================================================================
  describe('concurrent connections', () => {
    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_handle_multiple_concurrent_requests', async () => {
      // Act - 동시에 여러 요청
      const results = await Promise.all([
        sendRequest(TEST_PORT, { action: 'list', conversationId: TEST_CONVERSATION_ID }),
        sendRequest(TEST_PORT, { action: 'link', conversationId: TEST_CONVERSATION_ID, path: 'docs/a.md' }),
        sendRequest(TEST_PORT, { action: 'link', conversationId: TEST_CONVERSATION_ID, path: 'docs/b.md' }),
      ]);

      // Assert
      const r1 = results[0] as { success: boolean };
      const r2 = results[1] as { success: boolean };
      const r3 = results[2] as { success: boolean };

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r3.success).toBe(true);
    });

    it('should_handle_sequential_requests', async () => {
      // Act
      const result1 = await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/first.md',
      });
      const result2 = await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/second.md',
      });
      const result3 = await sendRequest(TEST_PORT, {
        action: 'list',
        conversationId: TEST_CONVERSATION_ID,
      });

      // Assert
      const r1 = result1 as { success: boolean };
      const r2 = result2 as { success: boolean };
      const r3 = result3 as { success: boolean; docs: Array<{ path: string }> };

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r3.success).toBe(true);
      expect(r3.docs).toHaveLength(2);
    });
  });

  // ============================================================================
  // send_file action 테스트
  // ============================================================================
  describe('send_file action', () => {
    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_send_file_successfully_when_file_exists', async () => {
      // Arrange
      const request = {
        action: 'send_file',
        conversationId: TEST_CONVERSATION_ID,
        path: 'C:\\test\\file.txt', // 테스트용 경로
        description: '테스트 파일입니다',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        file: {
          filename: string;
          mimeType: string;
          size: number;
          path: string;
          description: string | null;
        };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.file).toBeDefined();
      expect(response.file.filename).toBe('file.txt');
      expect(response.file.path).toBe('C:\\test\\file.txt');
      expect(response.file.description).toBe('테스트 파일입니다');
    });

    it('should_send_file_without_description', async () => {
      // Arrange
      const request = {
        action: 'send_file',
        conversationId: TEST_CONVERSATION_ID,
        path: 'C:\\test\\image.png',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        file: {
          filename: string;
          mimeType: string;
          description: string | null;
        };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.file.description).toBeNull();
    });

    it('should_return_error_when_file_not_found', async () => {
      // Arrange
      const request = {
        action: 'send_file',
        conversationId: TEST_CONVERSATION_ID,
        path: 'C:\\nonexistent\\file.txt',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/not found|찾을 수 없/i);
    });

    it('should_return_error_when_path_is_missing', async () => {
      // Arrange
      const request = {
        action: 'send_file',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/path/i);
    });

    it('should_return_error_when_path_is_empty', async () => {
      // Arrange
      const request = {
        action: 'send_file',
        conversationId: TEST_CONVERSATION_ID,
        path: '',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/path/i);
    });

    it('should_return_error_when_conversationId_not_found', async () => {
      // Arrange
      const request = {
        action: 'send_file',
        conversationId: 99999, // 존재하지 않는 conversationId
        path: 'C:\\test\\file.txt',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/not found|invalid/i);
    });

    it('should_detect_mime_type_from_file_extension', async () => {
      // Arrange
      const request = {
        action: 'send_file',
        conversationId: TEST_CONVERSATION_ID,
        path: 'C:\\test\\image.png',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        file: { mimeType: string };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.file.mimeType).toBe('image/png');
    });

    it('should_broadcast_file_attachment_event_to_clients', async () => {
      // Arrange
      const request = {
        action: 'send_file',
        conversationId: TEST_CONVERSATION_ID,
        path: 'C:\\test\\file.txt',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        file: { filename: string };
      };

      // Assert
      // 성공 시 브로드캐스트가 호출되어야 함
      // (실제 브로드캐스트 검증은 통합 테스트에서 수행)
      expect(response.success).toBe(true);
    });
  });
});
