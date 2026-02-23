/**
 * @file pylon-client.test.ts
 * @description PylonClient 테스트
 *
 * MCP 도구에서 PylonMcpServer로 요청을 보내는 TCP 클라이언트 테스트.
 *
 * 테스트 케이스:
 * - 생성자: 기본 옵션, 커스텀 옵션
 * - deployByToolUseId: toolUseId 기반 배포 요청
 * - deploy (레거시): conversationId 기반 배포 요청
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
  // deployByToolUseId 테스트
  // ============================================================================
  describe('deployByToolUseId', () => {
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

    // 스크립트 실행 테스트는 제거 (동기 실행, 실제 환경에서 수동 검증)

    it('should_reject_deploy_to_same_environment_via_toolUseId', async () => {
      // Arrange - 현재 환경과 같은 환경으로 배포 시도
      const currentEnv = getCurrentEnv();

      // dev 환경에서는 자기 자신 배포 테스트 불가 (dev는 배포 대상이 아님)
      if (currentEnv === 'dev') {
        return; // skip
      }

      // Act
      const result = await client.deployByToolUseId(TEST_TOOL_USE_ID, currentEnv);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/자기 자신 환경/);
    });

    it('should_return_error_when_toolUseId_not_found', async () => {
      // Act
      const result = await client.deployByToolUseId('toolu_unknown', 'stage');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found|toolUseId/i);
    });

    it('should_return_error_when_target_is_invalid', async () => {
      // Act
      const result = await client.deployByToolUseId(TEST_TOOL_USE_ID, 'production');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/stage.*release.*promote/i);
    });
  });

  // ============================================================================
  // deploy (레거시 conversationId 기반) 테스트
  // ============================================================================
  describe('deploy', () => {
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

    // 스크립트 실행 테스트는 제거 (동기 실행, 실제 환경에서 수동 검증)

    it('should_reject_deploy_to_same_environment_via_conversationId', async () => {
      // Arrange - 현재 환경과 같은 환경으로 배포 시도
      const currentEnv = getCurrentEnv();

      // dev 환경에서는 자기 자신 배포 테스트 불가
      if (currentEnv === 'dev') {
        return;
      }

      // Act
      const result = await client.deploy(TEST_CONVERSATION_ID, currentEnv);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/자기 자신 환경/);
    });

    it('should_return_error_when_conversationId_not_found', async () => {
      // Act
      const result = await client.deploy(99999, 'stage');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found|invalid/i);
    });

    it('should_return_error_when_target_is_missing', async () => {
      // Act
      // @ts-expect-error - 의도적으로 target 누락
      const result = await client.deploy(TEST_CONVERSATION_ID);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/target/i);
    });

    it('should_return_error_when_target_is_empty', async () => {
      // Act
      const result = await client.deploy(TEST_CONVERSATION_ID, '');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/target/i);
    });
  });

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
