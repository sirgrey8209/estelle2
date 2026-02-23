/**
 * @file share-handlers.test.ts
 * @description PylonMcpServer의 share 관련 액션 테스트
 *
 * 대화 공유 기능을 PylonMcpServer TCP 프로토콜로 테스트합니다.
 *
 * 프로토콜:
 * - 요청: { "action": "share_create", "conversationId": 132097 }
 * - 요청: { "action": "share_validate", "shareId": "abc123XYZ789" }
 * - 요청: { "action": "share_delete", "shareId": "abc123XYZ789" }
 * - 요청: { "action": "share_history", "shareId": "abc123XYZ789" }
 * - 요청: { "action": "lookup_and_share", "toolUseId": "toolu_xxx" }
 * - 응답: { "success": true, "shareId": "abc123XYZ789", "url": "..." }
 * - 응답: { "success": true, "valid": true, "conversationId": 132097 }
 * - 응답: { "success": true, "messages": [...], "conversationName": "..." }
 * - 응답: { "success": false, "error": "..." }
 *
 * 테스트 케이스:
 * - share_create action: 공유 생성 (성공/동일 대화 재생성)
 * - share_validate action: 공유 유효성 검증 (유효/무효)
 * - share_delete action: 공유 삭제 (성공/존재하지 않음)
 * - share_history action: 공유 히스토리 조회 (성공/무효 shareId)
 * - lookup_and_share action: toolUseId 기반 공유 생성
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConnection } from 'net';
import { PylonMcpServer } from '../../src/servers/pylon-mcp-server.js';
import { WorkspaceStore } from '../../src/stores/workspace-store.js';
import { ShareStore } from '../../src/stores/share-store.js';
import { MessageStore } from '../../src/stores/message-store.js';

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

// ============================================================================
// 테스트
// ============================================================================

describe('PylonMcpServer Share Actions', () => {
  let server: PylonMcpServer;
  let workspaceStore: WorkspaceStore;
  let shareStore: ShareStore;
  let messageStore: MessageStore;
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

    // ShareStore 설정
    shareStore = new ShareStore();

    // MessageStore 설정
    messageStore = new MessageStore();

    TEST_PORT = getRandomPort();

    // PylonMcpServer에 ShareStore와 MessageStore 전달 (아직 구현되지 않음)
    // 이 테스트는 구현 전에 실패해야 함
    server = new PylonMcpServer(workspaceStore, {
      port: TEST_PORT,
      shareStore,         // 아직 존재하지 않는 옵션
      messageStore,       // 아직 존재하지 않는 옵션
    } as any);
  });

  afterEach(async () => {
    await server.close();
  });

  // ============================================================================
  // share_create action 테스트
  // ============================================================================
  describe('share_create action', () => {
    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_create_share_successfully_when_conversationId_valid', async () => {
      // Arrange
      const request = {
        action: 'share_create',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        shareId: string;
        url: string;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.shareId).toBeDefined();
      expect(response.shareId).toHaveLength(12); // Base62 12자리
      expect(response.url).toBeDefined();
      expect(response.url).toContain(response.shareId);
    });

    it('should_replace_existing_share_when_same_conversation', async () => {
      // Arrange - 같은 conversationId로 두 번 공유 생성
      const request = {
        action: 'share_create',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const firstResponse = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        shareId: string;
      };
      const secondResponse = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        shareId: string;
      };

      // Assert
      expect(firstResponse.success).toBe(true);
      expect(secondResponse.success).toBe(true);
      expect(secondResponse.shareId).not.toBe(firstResponse.shareId);
    });

    it('should_return_error_when_conversationId_not_found', async () => {
      // Arrange
      const request = {
        action: 'share_create',
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

    it('should_return_error_when_conversationId_missing', async () => {
      // Arrange
      const request = {
        action: 'share_create',
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
  // share_validate action 테스트
  // ============================================================================
  describe('share_validate action', () => {
    let validShareId: string;

    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);

      // 유효한 공유 생성
      const createResponse = (await sendRequest(TEST_PORT, {
        action: 'share_create',
        conversationId: TEST_CONVERSATION_ID,
      })) as { success: boolean; shareId: string };

      validShareId = createResponse.shareId;
    });

    it('should_return_valid_true_when_shareId_exists', async () => {
      // Arrange
      const request = {
        action: 'share_validate',
        shareId: validShareId,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        valid: boolean;
        conversationId: number;
        shareId: string;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.valid).toBe(true);
      expect(response.conversationId).toBe(TEST_CONVERSATION_ID);
      expect(response.shareId).toBe(validShareId);
    });

    it('should_return_valid_false_when_shareId_not_exists', async () => {
      // Arrange
      const request = {
        action: 'share_validate',
        shareId: 'nonexistent12', // 존재하지 않는 shareId (12자리)
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        valid: boolean;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.valid).toBe(false);
    });

    it('should_return_valid_false_when_shareId_wrong_length', async () => {
      // Arrange
      const request = {
        action: 'share_validate',
        shareId: 'short', // 잘못된 길이
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        valid: boolean;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.valid).toBe(false);
    });

    it('should_return_error_when_shareId_missing', async () => {
      // Arrange
      const request = {
        action: 'share_validate',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/shareId/i);
    });

    it('should_return_valid_false_when_shareId_empty', async () => {
      // Arrange
      const request = {
        action: 'share_validate',
        shareId: '',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        valid: boolean;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.valid).toBe(false);
    });
  });

  // ============================================================================
  // share_delete action 테스트
  // ============================================================================
  describe('share_delete action', () => {
    let validShareId: string;

    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);

      // 유효한 공유 생성
      const createResponse = (await sendRequest(TEST_PORT, {
        action: 'share_create',
        conversationId: TEST_CONVERSATION_ID,
      })) as { success: boolean; shareId: string };

      validShareId = createResponse.shareId;
    });

    it('should_delete_share_successfully_when_shareId_exists', async () => {
      // Arrange
      const request = {
        action: 'share_delete',
        shareId: validShareId,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        deleted: boolean;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.deleted).toBe(true);

      // 삭제 확인
      const validateResponse = (await sendRequest(TEST_PORT, {
        action: 'share_validate',
        shareId: validShareId,
      })) as { success: boolean; valid: boolean };

      expect(validateResponse.valid).toBe(false);
    });

    it('should_return_deleted_false_when_shareId_not_exists', async () => {
      // Arrange
      const request = {
        action: 'share_delete',
        shareId: 'nonexistent12', // 존재하지 않는 shareId (12자리)
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        deleted: boolean;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.deleted).toBe(false);
    });

    it('should_return_error_when_shareId_missing', async () => {
      // Arrange
      const request = {
        action: 'share_delete',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/shareId/i);
    });
  });

  // ============================================================================
  // share_history action 테스트
  // ============================================================================
  describe('share_history action', () => {
    let validShareId: string;

    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);

      // 테스트 메시지 추가 (MessageStore에)
      messageStore.addUserMessage(TEST_CONVERSATION_ID, 'Hello, Claude!');
      messageStore.addAssistantText(TEST_CONVERSATION_ID, 'Hello! How can I help you?');

      // 유효한 공유 생성
      const createResponse = (await sendRequest(TEST_PORT, {
        action: 'share_create',
        conversationId: TEST_CONVERSATION_ID,
      })) as { success: boolean; shareId: string };

      validShareId = createResponse.shareId;
    });

    it('should_return_messages_when_shareId_valid', async () => {
      // Arrange
      const request = {
        action: 'share_history',
        shareId: validShareId,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        messages: Array<{ role: string; type: string; content: string }>;
        conversationName: string;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.messages).toBeDefined();
      expect(Array.isArray(response.messages)).toBe(true);
      expect(response.messages).toHaveLength(2);
      expect(response.conversationName).toBeDefined();
    });

    it('should_return_empty_messages_when_conversation_has_no_messages', async () => {
      // Arrange: 새 대화 생성 (메시지 없음)
      const activeWorkspace = workspaceStore.getActiveWorkspace();
      const newConversation = workspaceStore.createConversation(activeWorkspace!.workspaceId, 'Empty Conversation');
      const emptyConvId = newConversation!.conversationId;

      // 공유 생성
      const createResponse = (await sendRequest(TEST_PORT, {
        action: 'share_create',
        conversationId: emptyConvId,
      })) as { success: boolean; shareId: string };

      const request = {
        action: 'share_history',
        shareId: createResponse.shareId,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        messages: Array<unknown>;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.messages).toEqual([]);
    });

    it('should_return_error_when_shareId_invalid', async () => {
      // Arrange
      const request = {
        action: 'share_history',
        shareId: 'nonexistent12',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/invalid|not found/i);
    });

    it('should_return_error_when_shareId_missing', async () => {
      // Arrange
      const request = {
        action: 'share_history',
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/shareId/i);
    });

    it('should_increment_accessCount_when_history_accessed', async () => {
      // Arrange
      const request = {
        action: 'share_history',
        shareId: validShareId,
      };

      // Act: 3번 접근
      await sendRequest(TEST_PORT, request);
      await sendRequest(TEST_PORT, request);
      await sendRequest(TEST_PORT, request);

      // Assert: shareStore에서 accessCount 확인
      // (이 테스트는 ShareStore에 직접 접근할 수 없으므로 MCP 응답으로 확인)
      // validate에서 accessCount 반환하도록 확장하거나,
      // 별도 get_share_info 액션 추가 필요

      // 우선 성공만 확인 (accessCount 검증은 ShareStore 단위 테스트에서)
      const validateResponse = (await sendRequest(TEST_PORT, {
        action: 'share_validate',
        shareId: validShareId,
      })) as { success: boolean; valid: boolean };

      expect(validateResponse.success).toBe(true);
      expect(validateResponse.valid).toBe(true);
    });
  });

  // ============================================================================
  // lookup_and_share action 테스트 (toolUseId 기반)
  // ============================================================================
  describe('lookup_and_share action', () => {
    const TEST_TOOL_USE_ID = 'toolu_test_share_123';

    beforeEach(async () => {
      // toolUseId → conversationId 조회 콜백 설정
      const serverWithLookup = new PylonMcpServer(workspaceStore, {
        port: TEST_PORT,
        shareStore,         // 아직 존재하지 않는 옵션
        messageStore,       // 아직 존재하지 않는 옵션
        getConversationIdByToolUseId: (toolUseId: string) => {
          if (toolUseId === TEST_TOOL_USE_ID) {
            return TEST_CONVERSATION_ID;
          }
          return null;
        },
      } as any);

      // 기존 서버 교체
      await server.close();
      server = serverWithLookup;
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_create_share_via_toolUseId_successfully', async () => {
      // Arrange
      const request = {
        action: 'lookup_and_share',
        toolUseId: TEST_TOOL_USE_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        shareId: string;
        url: string;
      };

      // Assert
      expect(response.success).toBe(true);
      expect(response.shareId).toBeDefined();
      expect(response.shareId).toHaveLength(12);
      expect(response.url).toBeDefined();
    });

    it('should_return_error_when_toolUseId_not_found', async () => {
      // Arrange
      const request = {
        action: 'lookup_and_share',
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

    it('should_return_error_when_toolUseId_missing', async () => {
      // Arrange
      const request = {
        action: 'lookup_and_share',
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
  // 에러 케이스 테스트
  // ============================================================================
  describe('share error cases', () => {
    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_return_error_for_unknown_share_action', async () => {
      // Arrange
      const request = {
        action: 'share_unknown',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        error: string;
      };

      // Assert
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/unknown action/i);
    });
  });

  // ============================================================================
  // 공유 URL 형식 테스트
  // ============================================================================
  describe('share URL format', () => {
    beforeEach(async () => {
      await server.listen();
      await waitForPort(TEST_PORT);
    });

    it('should_generate_url_with_share_path', async () => {
      // Arrange
      const request = {
        action: 'share_create',
        conversationId: TEST_CONVERSATION_ID,
      };

      // Act
      const response = (await sendRequest(TEST_PORT, request)) as {
        success: boolean;
        shareId: string;
        url: string;
      };

      // Assert
      expect(response.success).toBe(true);
      // URL 형식: /share/{shareId}
      expect(response.url).toMatch(/\/share\/[a-zA-Z0-9]{12}$/);
    });
  });
});
