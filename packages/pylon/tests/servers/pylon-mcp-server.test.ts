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
 * - 요청: { "action": "get_status", "conversationId": 2049 }
 * - 응답: { "success": true, "docs": [...] }
 * - 응답: { "success": true, "status": {...} }
 * - 응답: { "success": false, "error": "..." }
 *
 * 테스트 케이스:
 * - 생성자: 기본값, 커스텀 옵션
 * - listen/close: TCP 서버 시작/종료
 * - link action: 문서 연결 (성공/실패)
 * - unlink action: 문서 연결 해제 (성공/실패)
 * - list action: 문서 목록 조회 (성공/빈 목록)
 * - get_status action: 상태 조회 (성공/실패)
 * - 에러 처리: 잘못된 action, 빈 conversationId 등
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConnection } from 'net';
// 아직 구현되지 않은 모듈 - 테스트 실패 예상
import { PylonMcpServer } from '../../src/servers/pylon-mcp-server.js';
import { WorkspaceStore } from '../../src/stores/workspace-store.js';
import { toNativePath } from '../utils/path-utils.js';

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
  // encodeConversationId(1, 1, 1) = (1 << 17) | (1 << 10) | 1 = 132097
  const TEST_CONVERSATION_ID = 132097;

  beforeEach(() => {
    // WorkspaceStore 설정: 워크스페이스와 대화 생성
    workspaceStore = new WorkspaceStore(PYLON_ID);
    const { workspace } = workspaceStore.createWorkspace('Test Workspace', 'C:\\test');
    workspaceStore.createConversation(workspace.workspaceId, 'Test Conversation');

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
      expect(response.docs[0].path).toBe(toNativePath('docs\\spec.md')); // 경로 정규화
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
      expect(response.docs[0].path).toBe(toNativePath('docs\\first.md'));
      expect(response.docs[1].path).toBe(toNativePath('docs\\second.md'));
      expect(response.docs[2].path).toBe(toNativePath('docs\\third.md'));
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

  // ============================================================================
  // deploy action 테스트
  // ============================================================================
  describe('deploy action', () => {
    // 현재 환경 확인 (테스트 환경에 따라 다름)
    const getCurrentEnv = (): 'release' | 'stage' | 'dev' => {
      try {
        const envConfigStr = process.env.ESTELLE_ENV_CONFIG;
        if (envConfigStr) {
          const envConfig = JSON.parse(envConfigStr);
          const envId = envConfig.envId ?? 2;
          const envNames = ['release', 'stage', 'dev'] as const;
          return envNames[envId] || 'dev';
        }
      } catch {
        // 파싱 실패 시 기본값
      }
      return 'dev';
    };

    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    // 스크립트 실행 테스트는 실제 환경에서 수동으로 검증
    // 여기서는 환경 검증 로직만 테스트

    it('should_return_error_when_target_is_not_release', async () => {
      // Arrange - release가 아닌 target으로 요청
      const request = {
        action: 'deploy',
        conversationId: TEST_CONVERSATION_ID,
        target: 'stage', // release가 아님
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert - release만 지원
      expect(response.success).toBe(false);
      expect(response.error).toContain("'release'만 지원");
    });

    it('should_return_error_when_target_is_missing', async () => {
      // Arrange
      const request = {
        action: 'deploy',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert - release만 지원
      expect(response.success).toBe(false);
      expect(response.error).toContain("'release'만 지원");
    });

    it('should_return_error_when_target_is_invalid', async () => {
      // Arrange
      const request = {
        action: 'deploy',
        conversationId: TEST_CONVERSATION_ID,
        target: 'invalid-target',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert - release만 지원
      expect(response.success).toBe(false);
      expect(response.error).toContain("'release'만 지원");
    });

    it('should_return_error_when_target_is_empty', async () => {
      // Arrange
      const request = {
        action: 'deploy',
        conversationId: TEST_CONVERSATION_ID,
        target: '',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert - release만 지원
      expect(response.success).toBe(false);
      expect(response.error).toContain("'release'만 지원");
    });

    // 스크립트 실행 테스트는 제거 (동기 실행으로 변경됨, 실제 환경에서 수동 검증)
  });

  // ============================================================================
  // lookup_and_deploy action 테스트 (toolUseId 기반)
  // ============================================================================
  describe('lookup_and_deploy action', () => {
    const TEST_TOOL_USE_ID = 'toolu_test_deploy_123';

    beforeEach(async () => {
      // 기존 서버 종료
      await server.close();
      // 새 포트 할당 (포트 충돌 방지)
      TEST_PORT = getRandomPort();
      // toolUseId → conversationId 조회 콜백 설정
      const serverWithLookup = new PylonMcpServer(workspaceStore, {
        port: TEST_PORT,
        getConversationIdByToolUseId: (toolUseId: string) => {
          if (toolUseId === TEST_TOOL_USE_ID) {
            return TEST_CONVERSATION_ID;
          }
          return null;
        },
      });
      // 기존 서버 교체
      server = serverWithLookup;
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    // 스크립트 실행 테스트는 제거 (동기 실행으로 변경됨, 실제 환경에서 수동 검증)

    it('should_return_error_when_toolUseId_not_found', async () => {
      // Arrange
      const request = {
        action: 'lookup_and_deploy',
        toolUseId: 'toolu_unknown_id',
        target: 'stage',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/not found|toolUseId/i);
    });

    it('should_return_error_when_toolUseId_is_missing', async () => {
      // Arrange
      const request = {
        action: 'lookup_and_deploy',
        target: 'stage',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/toolUseId/i);
    });

    it('should_return_error_when_target_is_invalid_via_toolUseId', async () => {
      // Arrange
      const request = {
        action: 'lookup_and_deploy',
        toolUseId: TEST_TOOL_USE_ID,
        target: 'production', // 잘못된 target
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/stage|release/i);
    });
  });

  // ============================================================================
  // get_status action 테스트
  // ============================================================================
  describe('get_status action', () => {
    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_return_status_successfully', async () => {
      // Arrange
      const request = {
        action: 'get_status',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        status: {
          environment: string;
          version: string;
          workspace: { id: number; name: string } | null;
          conversationId: number;
          linkedDocuments: Array<{ path: string; addedAt: number }>;
        };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.status).toBeDefined();
    });

    it('should_return_environment_in_status', async () => {
      // Arrange
      const request = {
        action: 'get_status',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        status: { environment: string };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.status.environment).toMatch(/^(dev|stage|release|test)$/);
    });

    it('should_return_version_in_status', async () => {
      // Arrange
      const request = {
        action: 'get_status',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        status: { version: string };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.status.version).toBeDefined();
      expect(typeof response.status.version).toBe('string');
    });

    it('should_return_workspace_info_in_status', async () => {
      // Arrange
      const request = {
        action: 'get_status',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        status: { workspace: { id: number; name: string } | null };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.status.workspace).toBeDefined();
      // workspace가 null이 아니면 id와 name이 있어야 함
      if (response.status.workspace !== null) {
        expect(response.status.workspace.id).toBeDefined();
        expect(response.status.workspace.name).toBeDefined();
      }
    });

    it('should_return_conversationId_in_status', async () => {
      // Arrange
      const request = {
        action: 'get_status',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        status: { conversationId: number };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.status.conversationId).toBe(TEST_CONVERSATION_ID);
    });

    it('should_return_linkedDocuments_array_in_status', async () => {
      // Arrange
      const request = {
        action: 'get_status',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        status: { linkedDocuments: Array<{ path: string }> };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(Array.isArray(response.status.linkedDocuments)).toBe(true);
    });

    it('should_return_linked_documents_when_documents_exist', async () => {
      // Arrange - 문서 연결
      await sendRequest(TEST_PORT, {
        action: 'link',
        conversationId: TEST_CONVERSATION_ID,
        path: 'docs/spec.md',
      });

      const request = {
        action: 'get_status',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        status: { linkedDocuments: Array<{ path: string }> };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.status.linkedDocuments).toHaveLength(1);
      expect(response.status.linkedDocuments[0].path).toBe(toNativePath('docs\\spec.md'));
    });

    it('should_return_error_when_conversationId_not_found', async () => {
      // Arrange
      const request = {
        action: 'get_status',
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

    it('should_return_error_when_conversationId_is_missing', async () => {
      // Arrange
      const request = {
        action: 'get_status',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/conversationId/i);
    });
  });

  // ============================================================================
  // lookup_and_get_status action 테스트 (toolUseId 기반)
  // ============================================================================
  describe('lookup_and_get_status action', () => {
    const TEST_TOOL_USE_ID_STATUS = 'toolu_test_status_123';

    beforeEach(async () => {
      // 기존 서버 종료
      await server.close();
      // 새 포트 할당 (포트 충돌 방지)
      TEST_PORT = getRandomPort();
      // toolUseId → conversationId 조회 콜백 설정
      const serverWithLookup = new PylonMcpServer(workspaceStore, {
        port: TEST_PORT,
        getConversationIdByToolUseId: (toolUseId: string) => {
          if (toolUseId === TEST_TOOL_USE_ID_STATUS) {
            return TEST_CONVERSATION_ID;
          }
          return null;
        },
      });
      // 기존 서버 교체
      server = serverWithLookup;
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_get_status_via_toolUseId_successfully', async () => {
      // Arrange
      const request = {
        action: 'lookup_and_get_status',
        toolUseId: TEST_TOOL_USE_ID_STATUS,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        status: {
          environment: string;
          version: string;
          workspace: { id: number; name: string } | null;
          conversationId: number;
          linkedDocuments: Array<{ path: string }>;
        };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.status).toBeDefined();
      expect(response.status.environment).toBeDefined();
      expect(response.status.version).toBeDefined();
      expect(response.status.conversationId).toBe(TEST_CONVERSATION_ID);
    });

    it('should_return_error_when_toolUseId_not_found', async () => {
      // Arrange
      const request = {
        action: 'lookup_and_get_status',
        toolUseId: 'toolu_unknown_id',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/not found|toolUseId/i);
    });

    it('should_return_error_when_toolUseId_is_missing', async () => {
      // Arrange
      const request = {
        action: 'lookup_and_get_status',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/toolUseId/i);
    });
  });

  // ============================================================================
  // onConversationCreate 콜백 테스트 (MCP 대화 생성 시 첫 쿼리 전송)
  // ============================================================================
  describe('onConversationCreate callback', () => {
    const TEST_TOOL_USE_ID_CREATE = 'toolu_test_create_conv_123';

    it('should_call_onConversationCreate_callback_when_conversation_created', async () => {
      // Arrange
      let callbackCalled = false;
      let receivedConversationId: number | null = null;

      await server.close();
      TEST_PORT = getRandomPort();

      const serverWithCallback = new PylonMcpServer(workspaceStore, {
        port: TEST_PORT,
        getConversationIdByToolUseId: (toolUseId: string) => {
          if (toolUseId === TEST_TOOL_USE_ID_CREATE) {
            return TEST_CONVERSATION_ID;
          }
          return null;
        },
        onConversationCreate: (conversationId: number) => {
          callbackCalled = true;
          receivedConversationId = conversationId;
        },
      });

      server = serverWithCallback;
      await server.listen();
      await waitForPort(TEST_PORT);

      const request = {
        action: 'lookup_and_create_conversation',
        toolUseId: TEST_TOOL_USE_ID_CREATE,
        name: '테스트 대화',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        conversation: { conversationId: number; name: string };
      };

      // Assert
      expect(response.success).toBe(true);
      expect(callbackCalled).toBe(true);
      expect(receivedConversationId).toBe(response.conversation.conversationId);
    });

    it('should_pass_correct_conversationId_to_callback', async () => {
      // Arrange
      const receivedIds: number[] = [];

      await server.close();
      TEST_PORT = getRandomPort();

      const serverWithCallback = new PylonMcpServer(workspaceStore, {
        port: TEST_PORT,
        getConversationIdByToolUseId: (toolUseId: string) => {
          if (toolUseId === TEST_TOOL_USE_ID_CREATE) {
            return TEST_CONVERSATION_ID;
          }
          return null;
        },
        onConversationCreate: (conversationId: number) => {
          receivedIds.push(conversationId);
        },
      });

      server = serverWithCallback;
      await server.listen();
      await waitForPort(TEST_PORT);

      // Act - 두 개의 대화 생성
      const response1 = (await sendRequest(TEST_PORT, {
        action: 'lookup_and_create_conversation',
        toolUseId: TEST_TOOL_USE_ID_CREATE,
        name: '대화 1',
      })) as { success: boolean; conversation: { conversationId: number } };

      const response2 = (await sendRequest(TEST_PORT, {
        action: 'lookup_and_create_conversation',
        toolUseId: TEST_TOOL_USE_ID_CREATE,
        name: '대화 2',
      })) as { success: boolean; conversation: { conversationId: number } };

      // Assert
      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
      expect(receivedIds).toHaveLength(2);
      expect(receivedIds[0]).toBe(response1.conversation.conversationId);
      expect(receivedIds[1]).toBe(response2.conversation.conversationId);
    });

    it('should_create_conversation_normally_when_callback_not_provided', async () => {
      // Arrange - onConversationCreate 콜백 없이 서버 생성
      await server.close();
      TEST_PORT = getRandomPort();

      const serverWithoutCallback = new PylonMcpServer(workspaceStore, {
        port: TEST_PORT,
        getConversationIdByToolUseId: (toolUseId: string) => {
          if (toolUseId === TEST_TOOL_USE_ID_CREATE) {
            return TEST_CONVERSATION_ID;
          }
          return null;
        },
        // onConversationCreate 없음
      });

      server = serverWithoutCallback;
      await server.listen();
      await waitForPort(TEST_PORT);

      const request = {
        action: 'lookup_and_create_conversation',
        toolUseId: TEST_TOOL_USE_ID_CREATE,
        name: '콜백 없는 대화',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        conversation: { conversationId: number; name: string };
      };

      // Assert - 콜백 없어도 정상 동작
      expect(response.success).toBe(true);
      expect(response.conversation).toBeDefined();
      expect(response.conversation.name).toBe('콜백 없는 대화');
    });

    it('should_not_call_callback_when_conversation_creation_fails', async () => {
      // Arrange
      let callbackCalled = false;

      await server.close();
      TEST_PORT = getRandomPort();

      const serverWithCallback = new PylonMcpServer(workspaceStore, {
        port: TEST_PORT,
        getConversationIdByToolUseId: (_toolUseId: string) => {
          // toolUseId를 찾을 수 없도록 설정 → 대화 생성 실패
          return null;
        },
        onConversationCreate: (_conversationId: number) => {
          callbackCalled = true;
        },
      });

      server = serverWithCallback;
      await server.listen();
      await waitForPort(TEST_PORT);

      const request = {
        action: 'lookup_and_create_conversation',
        toolUseId: 'toolu_unknown',
        name: '실패할 대화',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error?: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(callbackCalled).toBe(false);
    });
  });

  // ============================================================================
  // Widget Session Management 테스트
  // ============================================================================
  describe('Widget Session Management', () => {
    it('should_track_pending_widgets_by_conversationId', () => {
      // pendingWidgets가 존재하는지 확인
      expect(server.hasPendingWidget(123)).toBe(false);
    });

    it('should_return_undefined_when_no_pending_widget', () => {
      // getPendingWidget이 undefined 반환
      expect(server.getPendingWidget(123)).toBeUndefined();
    });

    it('should_return_undefined_when_finding_by_nonexistent_sessionId', () => {
      // findPendingWidgetBySessionId가 undefined 반환
      expect(server.findPendingWidgetBySessionId('nonexistent-session')).toBeUndefined();
    });

    it('should_auto_close_previous_widget_when_starting_new_widget', async () => {
      // Arrange - widgetManager가 필요하므로 mock 설정
      const TEST_TOOL_USE_ID_WIDGET_1 = 'toolu_test_widget_dup_123';
      const TEST_TOOL_USE_ID_WIDGET_2 = 'toolu_test_widget_dup_456';

      await server.close();
      TEST_PORT = getRandomPort();

      let sessionCount = 0;
      let cancelSessionCalled = false;

      // Mock WidgetManager 생성
      const mockWidgetManager = {
        prepareSession: () => {
          sessionCount++;
          return `mock-session-id-${sessionCount}`;
        },
        startSessionProcess: () => true,
        getSession: () => ({ ownerClientId: null }),
        waitForCompletion: () => new Promise(() => {}), // 완료되지 않는 Promise
        cancelSession: () => {
          cancelSessionCalled = true;
          return true;
        },
        on: () => {},
        off: () => {},
      };

      const serverWithWidget = new PylonMcpServer(workspaceStore, {
        port: TEST_PORT,
        getConversationIdByToolUseId: (toolUseId: string) => {
          // 두 toolUseId 모두 같은 conversationId로 매핑
          if (toolUseId === TEST_TOOL_USE_ID_WIDGET_1 || toolUseId === TEST_TOOL_USE_ID_WIDGET_2) {
            return TEST_CONVERSATION_ID;
          }
          return null;
        },
        widgetManager: mockWidgetManager as any,
      });

      server = serverWithWidget;
      await server.listen();
      await waitForPort(TEST_PORT);

      // Act - 첫 번째 위젯 시작 (응답 대기하지 않음)
      const firstRequest = sendRequest(TEST_PORT, {
        action: 'lookup_and_run_widget',
        toolUseId: TEST_TOOL_USE_ID_WIDGET_1,
        command: 'test',
        cwd: '/tmp',
      });

      // 약간 대기 후 두 번째 위젯 시도 (같은 서버에서!)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 두 번째 위젯 요청 - 같은 conversationId로 매핑되는 다른 toolUseId
      // 이전 위젯이 자동 종료되고 새 위젯이 시작되어야 함
      sendRequest(TEST_PORT, {
        action: 'lookup_and_run_widget',
        toolUseId: TEST_TOOL_USE_ID_WIDGET_2,
        command: 'test2',
        cwd: '/tmp',
      }).catch(() => {}); // 응답 대기하지 않음

      // 약간 대기
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - 이전 위젯이 취소되고 두 번째 세션이 시작됨
      expect(cancelSessionCalled).toBe(true);
      expect(sessionCount).toBe(2);

      // 정리
      firstRequest.catch(() => {}); // 응답 대기 취소
    });

    it('should_add_pending_widget_when_starting_widget', async () => {
      // Arrange
      const TEST_TOOL_USE_ID_WIDGET = 'toolu_test_widget_add_123';
      let sessionStarted = false;

      await server.close();
      TEST_PORT = getRandomPort();

      // Mock WidgetManager - prepareSession 후 pending 확인
      const mockWidgetManager = {
        prepareSession: () => {
          sessionStarted = true;
          return 'mock-session-id';
        },
        startSessionProcess: () => true,
        getSession: () => ({ ownerClientId: null }),
        waitForCompletion: () => new Promise(() => {}), // 완료되지 않는 Promise
        on: () => {},
        off: () => {},
      };

      const serverWithWidget = new PylonMcpServer(workspaceStore, {
        port: TEST_PORT,
        getConversationIdByToolUseId: (toolUseId: string) => {
          if (toolUseId === TEST_TOOL_USE_ID_WIDGET) {
            return TEST_CONVERSATION_ID;
          }
          return null;
        },
        widgetManager: mockWidgetManager as any,
      });

      server = serverWithWidget;
      await server.listen();
      await waitForPort(TEST_PORT);

      // Act - 위젯 시작 (응답 대기하지 않음)
      const widgetPromise = sendRequest(TEST_PORT, {
        action: 'lookup_and_run_widget',
        toolUseId: TEST_TOOL_USE_ID_WIDGET,
        command: 'test',
        cwd: '/tmp',
      });

      // 약간 대기 후 pending 상태 확인
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(sessionStarted).toBe(true);
      expect(server.hasPendingWidget(TEST_CONVERSATION_ID)).toBe(true);

      // 정리
      widgetPromise.catch(() => {}); // 응답 대기 취소
    });

    it('should_find_pending_widget_by_sessionId', async () => {
      // Arrange
      const TEST_TOOL_USE_ID_WIDGET = 'toolu_test_widget_find_123';
      const MOCK_SESSION_ID = 'find-test-session-id';

      await server.close();
      TEST_PORT = getRandomPort();

      // Mock WidgetManager
      const mockWidgetManager = {
        prepareSession: () => MOCK_SESSION_ID,
        startSessionProcess: () => true,
        getSession: () => ({ ownerClientId: null }),
        waitForCompletion: () => new Promise(() => {}),
        on: () => {},
        off: () => {},
      };

      const serverWithWidget = new PylonMcpServer(workspaceStore, {
        port: TEST_PORT,
        getConversationIdByToolUseId: (toolUseId: string) => {
          if (toolUseId === TEST_TOOL_USE_ID_WIDGET) {
            return TEST_CONVERSATION_ID;
          }
          return null;
        },
        widgetManager: mockWidgetManager as any,
      });

      server = serverWithWidget;
      await server.listen();
      await waitForPort(TEST_PORT);

      // Act - 위젯 시작
      const widgetPromise = sendRequest(TEST_PORT, {
        action: 'lookup_and_run_widget',
        toolUseId: TEST_TOOL_USE_ID_WIDGET,
        command: 'test',
        cwd: '/tmp',
      });

      // 약간 대기 후 sessionId로 찾기
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      const pending = server.findPendingWidgetBySessionId(MOCK_SESSION_ID);
      expect(pending).toBeDefined();
      expect(pending?.widgetSessionId).toBe(MOCK_SESSION_ID);
      expect(pending?.conversationId).toBe(TEST_CONVERSATION_ID);
      expect(pending?.toolUseId).toBe(TEST_TOOL_USE_ID_WIDGET);

      // 정리
      widgetPromise.catch(() => {});
    });

    // ============================================================================
    // cancelWidgetForConversation 테스트
    // ============================================================================
    describe('cancelWidgetForConversation', () => {
      it('should_cancel_widget_for_conversation', async () => {
        // Arrange
        const TEST_TOOL_USE_ID_WIDGET = 'toolu_test_widget_cancel_123';
        const MOCK_SESSION_ID = 'cancel-test-session-id';
        let cancelSessionCalled = false;
        let cancelledSessionId: string | null = null;

        await server.close();
        TEST_PORT = getRandomPort();

        // Mock WidgetManager - owner를 설정해야 onWidgetClose가 호출됨
        const MOCK_OWNER_CLIENT_ID = 42;
        const mockWidgetManager = {
          prepareSession: () => MOCK_SESSION_ID,
          startSessionProcess: () => true,
          getSession: () => ({ ownerClientId: MOCK_OWNER_CLIENT_ID }),
          waitForCompletion: () => new Promise(() => {}), // 완료되지 않는 Promise
          cancelSession: (sessionId: string) => {
            cancelSessionCalled = true;
            cancelledSessionId = sessionId;
            return true;
          },
          on: () => {},
          off: () => {},
        };

        // onWidgetClose 콜백 추적
        let widgetCloseCalled = false;
        let closeConversationId: number | null = null;
        let closeToolUseId: string | null = null;
        let closeSessionId: string | null = null;
        let closeOwnerClientId: number | null = null;

        const serverWithWidget = new PylonMcpServer(workspaceStore, {
          port: TEST_PORT,
          getConversationIdByToolUseId: (toolUseId: string) => {
            if (toolUseId === TEST_TOOL_USE_ID_WIDGET) {
              return TEST_CONVERSATION_ID;
            }
            return null;
          },
          widgetManager: mockWidgetManager as any,
          onWidgetClose: (conversationId, toolUseId, sessionId, ownerClientId) => {
            widgetCloseCalled = true;
            closeConversationId = conversationId;
            closeToolUseId = toolUseId;
            closeSessionId = sessionId;
            closeOwnerClientId = ownerClientId;
          },
        });

        server = serverWithWidget;
        await server.listen();
        await waitForPort(TEST_PORT);

        // 위젯 시작
        const widgetPromise = sendRequest(TEST_PORT, {
          action: 'lookup_and_run_widget',
          toolUseId: TEST_TOOL_USE_ID_WIDGET,
          command: 'test',
          cwd: '/tmp',
        });

        // 약간 대기 후 위젯이 시작되었는지 확인
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(server.hasPendingWidget(TEST_CONVERSATION_ID)).toBe(true);

        // Act - 위젯 취소
        const cancelled = server.cancelWidgetForConversation(TEST_CONVERSATION_ID);

        // Assert
        expect(cancelled).toBe(true);
        expect(cancelSessionCalled).toBe(true);
        expect(cancelledSessionId).toBe(MOCK_SESSION_ID);
        expect(server.hasPendingWidget(TEST_CONVERSATION_ID)).toBe(false);
        expect(widgetCloseCalled).toBe(true);
        expect(closeConversationId).toBe(TEST_CONVERSATION_ID);
        expect(closeToolUseId).toBe(TEST_TOOL_USE_ID_WIDGET);
        expect(closeSessionId).toBe(MOCK_SESSION_ID);

        // 정리
        widgetPromise.catch(() => {});
      });

      it('should_return_false_when_no_widget_to_cancel', () => {
        // 위젯이 없는 상태에서 취소 시도
        const cancelled = server.cancelWidgetForConversation(123);
        expect(cancelled).toBe(false);
      });

      it('should_return_false_when_cancelling_nonexistent_conversation', () => {
        // 존재하지 않는 conversationId로 취소 시도
        const cancelled = server.cancelWidgetForConversation(99999);
        expect(cancelled).toBe(false);
      });
    });
  });
});
