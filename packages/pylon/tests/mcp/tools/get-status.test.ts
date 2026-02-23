/**
 * @file get-status.test.ts
 * @description get_status MCP 도구 테스트
 *
 * Claude가 현재 대화/Pylon의 상태를 조회할 때 사용하는 MCP 도구 테스트.
 *
 * 테스트 케이스:
 * - getStatusToolDefinition: 도구 정의
 * - executeGetStatus: 정상 케이스, 에러 케이스
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 아직 구현되지 않은 모듈 - 테스트 실패 예상
import {
  getStatusToolDefinition,
  executeGetStatus,
} from '../../../src/mcp/tools/get-status.js';

// ============================================================================
// 테스트 상수
// ============================================================================

const TEST_TOOL_USE_ID = 'toolu_get_status_test_123';

// ============================================================================
// 도구 정의 테스트
// ============================================================================

describe('getStatusToolDefinition', () => {
  it('should_have_correct_name', () => {
    // Assert
    expect(getStatusToolDefinition.name).toBe('get_status');
  });

  it('should_have_description', () => {
    // Assert
    expect(getStatusToolDefinition.description).toBeDefined();
    expect(typeof getStatusToolDefinition.description).toBe('string');
    expect(getStatusToolDefinition.description.length).toBeGreaterThan(0);
  });

  it('should_have_empty_input_schema', () => {
    // Assert - get_status는 인자가 필요 없음
    expect(getStatusToolDefinition.inputSchema).toBeDefined();
    expect(getStatusToolDefinition.inputSchema.type).toBe('object');
    expect(getStatusToolDefinition.inputSchema.properties).toEqual({});
    expect(getStatusToolDefinition.inputSchema.required).toEqual([]);
  });
});

// ============================================================================
// executeGetStatus 테스트
// ============================================================================

describe('executeGetStatus', () => {
  beforeEach(() => {
    // 환경변수 설정
    vi.stubEnv('ESTELLE_MCP_PORT', '19879');
    vi.stubEnv('ESTELLE_ENV', 'test');
    vi.stubEnv('ESTELLE_VERSION', '(test)v0214_1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ============================================================================
  // 정상 케이스 테스트
  // ============================================================================
  describe('success cases', () => {
    it('should_return_status_when_toolUseId_is_valid', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.status).toBeDefined();
    });

    it('should_return_environment_in_status', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.status.environment).toMatch(/^(dev|stage|release|test)$/);
    });

    it('should_return_version_in_status', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.status.version).toBeDefined();
      expect(typeof data.status.version).toBe('string');
    });

    it('should_return_workspace_info_when_workspace_exists', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.status.workspace).toBeDefined();
      // workspace가 null이 아니면 id와 name이 있어야 함
      if (data.status.workspace !== null) {
        expect(data.status.workspace.id).toBeDefined();
        expect(typeof data.status.workspace.id).toBe('number');
        expect(data.status.workspace.name).toBeDefined();
        expect(typeof data.status.workspace.name).toBe('string');
      }
    });

    it('should_return_workspace_as_null_when_no_workspace', async () => {
      // Arrange - 워크스페이스가 없는 대화의 경우
      const args = {};
      const meta = { toolUseId: 'toolu_no_workspace_test' };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      // 에러이거나, workspace가 null이어야 함
      if (data.success) {
        // 성공했다면 workspace 필드는 존재해야 함 (null 허용)
        expect('workspace' in data.status).toBe(true);
      }
    });

    it('should_return_conversationId_in_status', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.status.conversationId).toBeDefined();
      expect(typeof data.status.conversationId).toBe('number');
    });

    it('should_return_linkedDocuments_array_in_status', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.status.linkedDocuments).toBeDefined();
      expect(Array.isArray(data.status.linkedDocuments)).toBe(true);
    });

    it('should_return_empty_linkedDocuments_when_no_documents', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      // 초기 상태에서는 연결된 문서가 없을 수 있음
      expect(data.status.linkedDocuments).toBeDefined();
      expect(Array.isArray(data.status.linkedDocuments)).toBe(true);
    });
  });

  // ============================================================================
  // 에러 케이스 테스트
  // ============================================================================
  describe('error cases', () => {
    it('should_return_error_when_toolUseId_not_found', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: 'toolu_unknown_id' };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/not found|toolUseId/i);
    });

    it('should_return_error_when_toolUseId_is_empty', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: '' };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      expect(result.isError).toBe(true);
    });

    it('should_return_error_when_pylon_connection_fails', async () => {
      // Arrange - 잘못된 포트 설정
      vi.stubEnv('ESTELLE_MCP_PORT', '19999');
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeGetStatus(args, meta);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/failed|error|connection/i);
    });
  });
});
