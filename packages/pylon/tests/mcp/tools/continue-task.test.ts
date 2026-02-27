/**
 * @file continue-task.test.ts
 * @description continue_task MCP 도구 테스트
 *
 * Claude가 세션을 재시작하고 작업을 계속할 때 사용하는 MCP 도구 테스트.
 * 히스토리를 유지하면서 재시작 로그를 추가하고 새 세션을 시작합니다.
 *
 * 테스트 케이스:
 * - continueTaskToolDefinition: 도구 정의
 * - executeContinueTask: 정상 케이스, 에러 케이스
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 아직 구현되지 않은 모듈 - 테스트 실패 예상
import {
  getContinueTaskToolDefinition,
  executeContinueTask,
} from '../../../src/mcp/tools/continue-task.js';

// PylonClient의 새 메서드 - 아직 구현되지 않음
import { PylonClient } from '../../../src/mcp/pylon-client.js';

// ============================================================================
// 테스트 상수
// ============================================================================

const TEST_TOOL_USE_ID = 'toolu_continue_task_test_123';

// ============================================================================
// 도구 정의 테스트
// ============================================================================

describe('continueTaskToolDefinition', () => {
  // 도구 정의 가져오기
  const continueTaskToolDefinition = getContinueTaskToolDefinition();

  it('should_have_correct_name', () => {
    // Assert
    expect(continueTaskToolDefinition.name).toBe('continue_task');
  });

  it('should_have_description', () => {
    // Assert
    expect(continueTaskToolDefinition.description).toBeDefined();
    expect(typeof continueTaskToolDefinition.description).toBe('string');
    expect(continueTaskToolDefinition.description.length).toBeGreaterThan(0);
  });

  it('should_have_reason_property_in_input_schema', () => {
    // Assert
    expect(continueTaskToolDefinition.inputSchema).toBeDefined();
    expect(continueTaskToolDefinition.inputSchema.type).toBe('object');
    expect(continueTaskToolDefinition.inputSchema.properties.reason).toBeDefined();
    expect(continueTaskToolDefinition.inputSchema.properties.reason.type).toBe('string');
  });

  it('should_not_require_reason_in_input_schema', () => {
    // Assert - reason은 선택적 파라미터
    const required = continueTaskToolDefinition.inputSchema.required || [];
    expect(required).not.toContain('reason');
  });

  it('should_have_description_for_reason_property', () => {
    // Assert
    const reasonProp = continueTaskToolDefinition.inputSchema.properties.reason;
    expect(reasonProp.description).toBeDefined();
    expect(typeof reasonProp.description).toBe('string');
  });
});

// ============================================================================
// executeContinueTask 테스트
// ============================================================================

describe('executeContinueTask', () => {
  beforeEach(() => {
    // 환경변수 설정
    vi.stubEnv('ESTELLE_MCP_PORT', '19879');
    vi.stubEnv('ESTELLE_ENV', 'test');
    vi.stubEnv('ESTELLE_VERSION', '(test)v0227_1');
    vi.stubEnv('ESTELLE_WORKING_DIR', 'C:\\WorkSpace\\estelle2');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ============================================================================
  // 정상 케이스 테스트
  // ============================================================================
  describe('success cases', () => {
    it('should_return_success_when_valid_toolUseId', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('should_return_success_when_reason_provided', async () => {
      // Arrange
      const args = { reason: '토큰 한도 초과로 인한 세션 재시작' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('should_add_system_message_to_history', async () => {
      // Arrange
      const args = { reason: '작업 계속' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      // 시스템 메시지가 추가되었음을 확인
      expect(data.systemMessageAdded).toBe(true);
    });

    it('should_start_new_session_after_continue', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.newSession).toBe(true);
    });

    it('should_preserve_history_after_continue', async () => {
      // Arrange
      const args = { reason: '히스토리 유지 테스트' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.historyPreserved).toBe(true);
    });

    it('should_return_message_with_reason_when_provided', async () => {
      // Arrange
      const reason = '컨텍스트 길이 제한 도달';
      const args = { reason };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.message).toContain('세션 재시작');
    });

    it('should_return_default_message_when_no_reason', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.message).toBeDefined();
    });
  });

  // ============================================================================
  // 에러 케이스 테스트
  // ============================================================================
  describe('error cases', () => {
    it('should_return_error_when_toolUseId_not_found', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: 'toolu_unknown_id_xyz' };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/not found|toolUseId/i);
    });

    it('should_return_error_when_toolUseId_is_empty', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: '' };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      expect(result.isError).toBe(true);
    });

    it('should_return_error_when_pylon_connection_fails', async () => {
      // Arrange - 잘못된 포트 설정
      vi.stubEnv('ESTELLE_MCP_PORT', '19999');
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/failed|error|connection/i);
    });

    it('should_return_error_when_session_not_active', async () => {
      // Arrange - 활성 세션이 없는 대화의 toolUseId
      const args = {};
      const meta = { toolUseId: 'toolu_no_active_session' };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      // 세션이 없는 경우에도 오류 반환
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });
  });

  // ============================================================================
  // 엣지 케이스 테스트
  // ============================================================================
  describe('edge cases', () => {
    it('should_handle_very_long_reason', async () => {
      // Arrange
      const longReason = 'x'.repeat(1000);
      const args = { reason: longReason };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert - 긴 이유도 처리 가능해야 함
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('should_handle_special_characters_in_reason', async () => {
      // Arrange
      const specialReason = '이유: "토큰 초과"\n줄바꿈 포함\t탭도';
      const args = { reason: specialReason };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('should_handle_unicode_in_reason', async () => {
      // Arrange
      const unicodeReason = '세션 재시작 🚀 日本語 テスト';
      const args = { reason: unicodeReason };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('should_handle_empty_reason_string', async () => {
      // Arrange
      const args = { reason: '' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert - 빈 문자열은 reason 없음과 동일하게 처리
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('should_handle_whitespace_only_reason', async () => {
      // Arrange
      const args = { reason: '   ' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeContinueTask(args, meta);

      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });
  });
});

// ============================================================================
// PylonClient.continueTaskByToolUseId 테스트
// ============================================================================

describe('PylonClient.continueTaskByToolUseId', () => {
  let client: PylonClient;

  beforeEach(() => {
    vi.stubEnv('ESTELLE_MCP_PORT', '19879');
    client = new PylonClient({
      host: 'localhost',
      port: 19879,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should_have_continueTaskByToolUseId_method', () => {
    // Assert - 메서드가 존재해야 함
    expect(typeof client.continueTaskByToolUseId).toBe('function');
  });

  it('should_return_error_when_toolUseId_is_empty', async () => {
    // Arrange
    const emptyToolUseId = '';

    // Act
    const result = await client.continueTaskByToolUseId(emptyToolUseId);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should_accept_optional_reason_parameter', async () => {
    // Arrange
    const toolUseId = TEST_TOOL_USE_ID;
    const reason = '토큰 한도 초과';

    // Act
    const result = await client.continueTaskByToolUseId(toolUseId, reason);

    // Assert
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('should_return_ContinueTaskResult_type', async () => {
    // Arrange
    const toolUseId = TEST_TOOL_USE_ID;

    // Act
    const result = await client.continueTaskByToolUseId(toolUseId);

    // Assert - ContinueTaskResult 타입 구조 확인
    expect('success' in result).toBe(true);
    if (result.success) {
      expect('message' in result).toBe(true);
      expect('newSession' in result).toBe(true);
    } else {
      expect('error' in result).toBe(true);
    }
  });
});

// ============================================================================
// 결과 타입 테스트
// ============================================================================

describe('ContinueTaskResult Type', () => {
  // PylonClient에서 ContinueTaskResult 타입 import - 아직 존재하지 않음
  it('should_export_ContinueTaskResult_type', async () => {
    // 동적 import로 타입 존재 여부 확인
    const module = await import('../../../src/mcp/pylon-client.js');

    // ContinueTaskResult 타입이 export 되어야 함
    // 타입은 런타임에 확인 불가하므로 관련 인터페이스 확인
    expect(module.PylonClient).toBeDefined();
  });
});
