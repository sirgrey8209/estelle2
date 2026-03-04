/**
 * @file pylon-client.test.ts
 * @description PylonClient 테스트
 *
 * MCP 도구에서 PylonMcpServer로 요청을 보내는 TCP 클라이언트 테스트.
 *
 * 테스트 케이스:
 * - 생성자: 기본 옵션, 커스텀 옵션
 * - getStatusByToolUseId: toolUseId 기반 상태 조회
 * - getStatus (레거시): conversationId 기반 상태 조회
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PylonClient } from '../../src/mcp/pylon-client.js';
import { PylonMcpServer } from '../../src/servers/pylon-mcp-server.js';
import { WorkspaceStore } from '../../src/stores/workspace-store.js';

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 사용 가능한 랜덤 포트 반환
 */
function getRandomPort(): number {
  return 10000 + Math.floor(Math.random() * 50000);
}

/**
 * 포트가 열릴 때까지 대기
 */
async function waitForPort(port: number, maxRetries = 10): Promise<void> {
  const { createConnection } = await import('net');
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

describe('PylonClient', () => {
  let client: PylonClient;
  let server: PylonMcpServer;
  let workspaceStore: WorkspaceStore;
  let TEST_PORT: number;

  // 테스트용 상수
  const PYLON_ID = 1;
  // encodeConversationId(1, 1, 1) = (1 << 17) | (1 << 10) | 1 = 132097
  const TEST_CONVERSATION_ID = 132097;
  const TEST_TOOL_USE_ID = 'toolu_test_deploy_456';

  beforeEach(async () => {
    TEST_PORT = getRandomPort();

    // WorkspaceStore 설정
    workspaceStore = new WorkspaceStore(PYLON_ID);
    const { workspace } = workspaceStore.createWorkspace('Test Workspace', 'C:\\test');
    workspaceStore.createConversation(workspace.workspaceId, 'Test Conversation');

    // PylonMcpServer 시작 (toolUseId 조회 콜백 포함)
    server = new PylonMcpServer(workspaceStore, {
      port: TEST_PORT,
      getConversationIdByToolUseId: (toolUseId: string) => {
        if (toolUseId === TEST_TOOL_USE_ID) {
          return TEST_CONVERSATION_ID;
        }
        return null;
      },
    });
    await server.listen();
    await waitForPort(TEST_PORT);

    // PylonClient 생성
    client = new PylonClient({
      host: '127.0.0.1',
      port: TEST_PORT,
    });
  });

  afterEach(async () => {
    await server.close();
  });

  // ============================================================================
  // 생성자 테스트
  // ============================================================================
  describe('constructor', () => {
    it('should_create_client_with_host_and_port', () => {
      // Assert
      expect(client.host).toBe('127.0.0.1');
      expect(client.port).toBe(TEST_PORT);
    });

    it('should_use_default_timeout_when_not_specified', () => {
      // Assert
      expect(client.timeout).toBe(5000);
    });

    it('should_use_custom_timeout_when_specified', () => {
      // Arrange
      const customClient = new PylonClient({
        host: '127.0.0.1',
        port: TEST_PORT,
        timeout: 10000,
      });

      // Assert
      expect(customClient.timeout).toBe(10000);
    });
  });

  // ============================================================================
  // deploy 테스트 (미구현 - 추후 구현 시 활성화)
  // ============================================================================
  // TODO: deployByToolUseId, deploy 메서드 구현 후 테스트 활성화

  // ============================================================================
  // getStatusByToolUseId 테스트
  // ============================================================================
  describe('getStatusByToolUseId', () => {
    it('should_get_status_via_toolUseId_successfully', async () => {
      // Act
      const result = await client.getStatusByToolUseId(TEST_TOOL_USE_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBeDefined();
      expect(result.status?.environment).toBeDefined();
      expect(result.status?.version).toBeDefined();
      expect(result.status?.conversationId).toBeDefined();
      expect(result.status?.linkedDocuments).toBeDefined();
    });

    it('should_return_workspace_info_in_status', async () => {
      // Act
      const result = await client.getStatusByToolUseId(TEST_TOOL_USE_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.status?.workspace).toBeDefined();
      // workspace가 null이 아니면 id와 name이 있어야 함
      if (result.status?.workspace !== null) {
        expect(result.status?.workspace?.id).toBeDefined();
        expect(result.status?.workspace?.name).toBeDefined();
      }
    });

    it('should_return_linkedDocuments_array', async () => {
      // Act
      const result = await client.getStatusByToolUseId(TEST_TOOL_USE_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.status?.linkedDocuments)).toBe(true);
    });

    it('should_return_error_when_toolUseId_not_found', async () => {
      // Act
      const result = await client.getStatusByToolUseId('toolu_unknown');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found|toolUseId/i);
    });

    it('should_return_error_when_toolUseId_is_empty', async () => {
      // Act
      const result = await client.getStatusByToolUseId('');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/toolUseId/i);
    });
  });

  // ============================================================================
  // getStatus (레거시 conversationId 기반) 테스트
  // ============================================================================
  describe('getStatus', () => {
    it('should_get_status_via_conversationId_successfully', async () => {
      // Act
      const result = await client.getStatus(TEST_CONVERSATION_ID);

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBeDefined();
      expect(result.status?.environment).toBeDefined();
      expect(result.status?.version).toBeDefined();
      expect(result.status?.conversationId).toBe(TEST_CONVERSATION_ID);
    });

    it('should_return_error_when_conversationId_not_found', async () => {
      // Act
      const result = await client.getStatus(99999);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found|invalid/i);
    });
  });
});
