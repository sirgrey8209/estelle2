/**
 * @file system-prompt.test.ts
 * @description add_prompt MCP 도구 테스트
 *
 * Claude가 파일에서 시스템 프롬프트를 로드하여 새 세션을 시작할 때 사용하는 MCP 도구.
 *
 * 테스트 케이스:
 * - addPromptToolDefinition: 도구 정의
 * - executeAddPrompt: 정상 케이스, 에러 케이스
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  executeAddPrompt,
  getAddPromptToolDefinition,
} from '../../../src/mcp/tools/system-prompt.js';

// 도구 정의 가져오기
const addPromptToolDefinition = getAddPromptToolDefinition();

// ============================================================================
// 테스트 상수
// ============================================================================

const TEST_TOOL_USE_ID = 'toolu_add_prompt_test_123';

// ============================================================================
// 도구 정의 테스트
// ============================================================================

describe('addPromptToolDefinition', () => {
  it('should_have_correct_name', () => {
    // Assert
    expect(addPromptToolDefinition.name).toBe('add_prompt');
  });

  it('should_have_description', () => {
    // Assert
    expect(addPromptToolDefinition.description).toBeDefined();
    expect(typeof addPromptToolDefinition.description).toBe('string');
    expect(addPromptToolDefinition.description.length).toBeGreaterThan(0);
  });

  it('should_have_path_property_in_input_schema', () => {
    // Assert
    expect(addPromptToolDefinition.inputSchema).toBeDefined();
    expect(addPromptToolDefinition.inputSchema.type).toBe('object');
    expect(addPromptToolDefinition.inputSchema.properties.path).toBeDefined();
    expect(addPromptToolDefinition.inputSchema.properties.path.type).toBe('string');
  });

  it('should_require_path_in_input_schema', () => {
    // Assert
    expect(addPromptToolDefinition.inputSchema.required).toContain('path');
  });
});

// ============================================================================
// executeAddPrompt 테스트
// ============================================================================

describe('executeAddPrompt', () => {
  beforeEach(() => {
    // 환경변수 설정
    vi.stubEnv('ESTELLE_MCP_PORT', '19879');
    vi.stubEnv('ESTELLE_ENV', 'test');
    vi.stubEnv('ESTELLE_WORKING_DIR', 'C:\\WorkSpace\\estelle2');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ============================================================================
  // 정상 케이스 테스트
  // ============================================================================
  describe('success cases', () => {
    it('should_return_success_when_valid_file_path', async () => {
      // Arrange
      const args = { path: 'doc/project-overview.md' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert
      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('should_read_file_content_and_set_prompt', async () => {
      // Arrange
      const args = { path: 'doc/project-overview.md' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      // 한국어 메시지: "커스텀 시스템 프롬프트가 설정되었습니다"
      expect(data.message).toMatch(/프롬프트|prompt|loaded|set/i);
    });

    it('should_start_new_session_after_setting_prompt', async () => {
      // Arrange
      const args = { path: 'doc/project-overview.md' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      // 프롬프트 설정 후 기존 세션 abort → 새 세션 시작
      expect(data.newSession).toBe(true);
    });

    it('should_handle_absolute_file_path', async () => {
      // Arrange
      const args = { path: 'C:\\WorkSpace\\estelle2\\doc\\project-overview.md' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert
      expect(result.content[0].type).toBe('text');
      // 절대 경로도 처리 가능해야 함 (파일 존재 여부에 따라 결과 다름)
    });
  });

  // ============================================================================
  // 에러 케이스 테스트
  // ============================================================================
  describe('error cases', () => {
    it('should_return_error_when_file_not_found', async () => {
      // Arrange
      const args = { path: 'non-existent-file.md' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/not found|does not exist|cannot read/i);
    });

    it('should_return_error_when_path_not_provided', async () => {
      // Arrange
      const args = {};
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args as { path?: string }, meta);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/path.*required/i);
    });

    it('should_return_error_when_path_is_empty', async () => {
      // Arrange
      const args = { path: '' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/path.*required/i);
    });

    it('should_return_error_when_toolUseId_is_empty', async () => {
      // Arrange
      const args = { path: 'doc/project-overview.md' };
      const meta = { toolUseId: '' };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert
      expect(result.isError).toBe(true);
    });

    it('should_return_error_when_pylon_connection_fails', async () => {
      // Arrange - 잘못된 포트 설정
      vi.stubEnv('ESTELLE_MCP_PORT', '19999');
      const args = { path: 'doc/project-overview.md' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/failed|error|connection/i);
    });

    it('should_return_error_when_file_is_directory', async () => {
      // Arrange
      const args = { path: 'doc/' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/directory|not a file|invalid/i);
    });
  });

  // ============================================================================
  // 엣지 케이스 테스트
  // ============================================================================
  describe('edge cases', () => {
    it('should_handle_file_with_special_characters_in_name', async () => {
      // Arrange
      const args = { path: 'doc/test-file [1].md' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert - 파일 존재 여부와 관계없이 유효한 응답 형식이어야 함
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('should_handle_very_large_file', async () => {
      // Arrange - 큰 파일 경로 (실제 테스트에서는 파일 존재 확인 필요)
      const args = { path: 'doc/large-file.md' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert - 유효한 응답 형식이어야 함
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('should_handle_empty_file', async () => {
      // Arrange - 빈 파일
      const args = { path: 'doc/empty.md' };
      const meta = { toolUseId: TEST_TOOL_USE_ID };

      // Act
      const result = await executeAddPrompt(args, meta);

      // Assert - 빈 파일도 처리 가능해야 함
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });
  });
});
