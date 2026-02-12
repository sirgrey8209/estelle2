/**
 * @file tool-context-map.test.ts
 * @description ClaudeBeacon의 ToolContextMap 테스트
 *
 * ToolContextMap은 toolUseId → { conversationId, raw } 매핑을 관리한다.
 * pylonId는 conversationId에서 비트 추출로 획득 (conversationId >> 17).
 *
 * MCP에서 toolUseId로 조회하면 해당 도구 호출이 어느 대화에서
 * 발생했는지 알 수 있다.
 *
 * 테스트 케이스:
 * - set: toolUseId → ToolContext 저장
 * - get: toolUseId → ToolContext 조회
 * - delete: toolUseId 삭제
 * - cleanup: 오래된 항목 자동 정리
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolContextMap, type ToolContext } from '../src/tool-context-map.js';

describe('ToolContextMap', () => {
  let contextMap: ToolContextMap;

  beforeEach(() => {
    contextMap = new ToolContextMap();
  });

  // ============================================================================
  // set 테스트
  // ============================================================================
  describe('set', () => {
    // 정상 케이스
    it('should_store_context_when_tool_use_id_provided', () => {
      // Arrange
      const toolUseId = 'toolu_01ABC123';
      const context: ToolContext = {
        conversationId: 2049,
        raw: { type: 'tool_use', id: toolUseId, name: 'Read', input: {} },
      };

      // Act
      contextMap.set(toolUseId, context);

      // Assert
      const result = contextMap.get(toolUseId);
      expect(result).toBeDefined();
      expect(result?.conversationId).toBe(2049);
      expect(result?.raw.name).toBe('Read');
    });

    it('should_overwrite_existing_mapping_when_same_tool_use_id', () => {
      // Arrange
      const toolUseId = 'toolu_01ABC123';
      const context1: ToolContext = {
        conversationId: 2049,
        raw: { type: 'tool_use', id: toolUseId, name: 'Read', input: {} },
      };
      const context2: ToolContext = {
        conversationId: 3073,
        raw: { type: 'tool_use', id: toolUseId, name: 'Write', input: {} },
      };
      contextMap.set(toolUseId, context1);

      // Act
      contextMap.set(toolUseId, context2);

      // Assert
      const result = contextMap.get(toolUseId);
      expect(result?.conversationId).toBe(3073);
      expect(result?.raw.name).toBe('Write');
    });

    it('should_store_multiple_mappings_for_different_conversations', () => {
      // Arrange & Act - 3개의 대화에서 도구 호출
      contextMap.set('toolu_conv_01', {
        conversationId: 1025,
        raw: { type: 'tool_use', id: 'toolu_conv_01', name: 'Read', input: {} },
      });
      contextMap.set('toolu_conv_02', {
        conversationId: 2049,
        raw: { type: 'tool_use', id: 'toolu_conv_02', name: 'Write', input: {} },
      });
      contextMap.set('toolu_conv_03', {
        conversationId: 3073,
        raw: { type: 'tool_use', id: 'toolu_conv_03', name: 'Edit', input: {} },
      });

      // Assert
      expect(contextMap.get('toolu_conv_01')?.conversationId).toBe(1025);
      expect(contextMap.get('toolu_conv_02')?.conversationId).toBe(2049);
      expect(contextMap.get('toolu_conv_03')?.conversationId).toBe(3073);
    });

    // 엣지 케이스
    it('should_not_store_when_tool_use_id_is_empty', () => {
      // Arrange
      const context: ToolContext = {
        conversationId: 2049,
        raw: { type: 'tool_use', id: '', name: 'Read', input: {} },
      };

      // Act
      contextMap.set('', context);

      // Assert
      expect(contextMap.get('')).toBeUndefined();
      expect(contextMap.size).toBe(0);
    });

    it('should_store_context_with_complex_raw_input', () => {
      // Arrange - 실제 도구 호출처럼 복잡한 input 포함
      const toolUseId = 'toolu_complex';
      const context: ToolContext = {
        conversationId: 2049,
        raw: {
          type: 'tool_use',
          id: toolUseId,
          name: 'Edit',
          input: {
            file_path: '/path/to/file.ts',
            old_string: 'const x = 1;',
            new_string: 'const x = 2;',
          },
        },
      };

      // Act
      contextMap.set(toolUseId, context);

      // Assert
      const result = contextMap.get(toolUseId);
      expect(result?.raw.input).toEqual({
        file_path: '/path/to/file.ts',
        old_string: 'const x = 1;',
        new_string: 'const x = 2;',
      });
    });
  });

  // ============================================================================
  // get 테스트
  // ============================================================================
  describe('get', () => {
    // 정상 케이스
    it('should_return_context_when_tool_use_id_exists', () => {
      // Arrange
      const toolUseId = 'toolu_01ABC123';
      const context: ToolContext = {
        conversationId: 2049,
        raw: { type: 'tool_use', id: toolUseId, name: 'Read', input: {} },
      };
      contextMap.set(toolUseId, context);

      // Act
      const result = contextMap.get(toolUseId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.conversationId).toBe(2049);
    });

    // 에러 케이스
    it('should_return_undefined_when_tool_use_id_not_found', () => {
      // Act
      const result = contextMap.get('nonexistent_toolu_id');

      // Assert
      expect(result).toBeUndefined();
    });

    // 엣지 케이스
    it('should_return_undefined_when_tool_use_id_is_empty', () => {
      // Act
      const result = contextMap.get('');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  // ============================================================================
  // delete 테스트
  // ============================================================================
  describe('delete', () => {
    // 정상 케이스
    it('should_remove_mapping_when_tool_use_id_exists', () => {
      // Arrange
      const toolUseId = 'toolu_01ABC123';
      contextMap.set(toolUseId, {
        conversationId: 2049,
        raw: { type: 'tool_use', id: toolUseId, name: 'Read', input: {} },
      });

      // Act
      const deleted = contextMap.delete(toolUseId);

      // Assert
      expect(deleted).toBe(true);
      expect(contextMap.get(toolUseId)).toBeUndefined();
    });

    // 에러 케이스
    it('should_return_false_when_tool_use_id_not_found', () => {
      // Act
      const deleted = contextMap.delete('nonexistent');

      // Assert
      expect(deleted).toBe(false);
    });
  });

  // ============================================================================
  // cleanup 테스트
  // ============================================================================
  describe('cleanup', () => {
    // 정상 케이스: 오래된 항목 삭제
    it('should_remove_entries_older_than_max_age', () => {
      // Arrange
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      contextMap.set('toolu_old', {
        conversationId: 2049,
        raw: { type: 'tool_use', id: 'toolu_old', name: 'Read', input: {} },
      });

      // 10분 경과
      vi.setSystemTime(now + 10 * 60 * 1000);

      // Act - maxAge: 5분
      const removed = contextMap.cleanup(5 * 60 * 1000);

      // Assert
      expect(removed).toBe(1);
      expect(contextMap.get('toolu_old')).toBeUndefined();

      vi.useRealTimers();
    });

    it('should_keep_recent_entries', () => {
      // Arrange
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      contextMap.set('toolu_recent', {
        conversationId: 2049,
        raw: { type: 'tool_use', id: 'toolu_recent', name: 'Read', input: {} },
      });

      // 1분 경과
      vi.setSystemTime(now + 1 * 60 * 1000);

      // Act - maxAge: 5분
      const removed = contextMap.cleanup(5 * 60 * 1000);

      // Assert
      expect(removed).toBe(0);
      expect(contextMap.get('toolu_recent')).toBeDefined();

      vi.useRealTimers();
    });

    it('should_use_default_max_age_when_not_specified', () => {
      // Arrange
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      contextMap.set('toolu_test', {
        conversationId: 2049,
        raw: { type: 'tool_use', id: 'toolu_test', name: 'Read', input: {} },
      });

      // 기본 maxAge는 30분이라고 가정
      vi.setSystemTime(now + 35 * 60 * 1000);

      // Act
      const removed = contextMap.cleanup();

      // Assert
      expect(removed).toBe(1);
      expect(contextMap.get('toolu_test')).toBeUndefined();

      vi.useRealTimers();
    });

    it('should_cleanup_entries_from_multiple_conversations_based_on_age', () => {
      // Arrange
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      // 오래된 항목들
      contextMap.set('toolu_old_1', {
        conversationId: 1025,
        raw: { type: 'tool_use', id: 'toolu_old_1', name: 'Read', input: {} },
      });

      vi.setSystemTime(now + 1 * 60 * 1000);
      contextMap.set('toolu_old_2', {
        conversationId: 2049,
        raw: { type: 'tool_use', id: 'toolu_old_2', name: 'Read', input: {} },
      });

      // 10분 후 새 항목
      vi.setSystemTime(now + 10 * 60 * 1000);
      contextMap.set('toolu_new', {
        conversationId: 3073,
        raw: { type: 'tool_use', id: 'toolu_new', name: 'Read', input: {} },
      });

      // 1분 더 경과
      vi.setSystemTime(now + 11 * 60 * 1000);

      // Act - maxAge: 5분
      const removed = contextMap.cleanup(5 * 60 * 1000);

      // Assert - old_1, old_2는 삭제, new는 유지
      expect(removed).toBe(2);
      expect(contextMap.get('toolu_old_1')).toBeUndefined();
      expect(contextMap.get('toolu_old_2')).toBeUndefined();
      expect(contextMap.get('toolu_new')).toBeDefined();

      vi.useRealTimers();
    });
  });

  // ============================================================================
  // size 테스트
  // ============================================================================
  describe('size', () => {
    it('should_return_number_of_entries', () => {
      // Arrange
      contextMap.set('toolu_01', {
        conversationId: 1025,
        raw: { type: 'tool_use', id: 'toolu_01', name: 'Read', input: {} },
      });
      contextMap.set('toolu_02', {
        conversationId: 2049,
        raw: { type: 'tool_use', id: 'toolu_02', name: 'Write', input: {} },
      });

      // Act & Assert
      expect(contextMap.size).toBe(2);
    });

    it('should_return_zero_when_empty', () => {
      // Act & Assert
      expect(contextMap.size).toBe(0);
    });
  });

  // ============================================================================
  // clear 테스트
  // ============================================================================
  describe('clear', () => {
    it('should_remove_all_entries', () => {
      // Arrange
      contextMap.set('toolu_01', {
        conversationId: 1025,
        raw: { type: 'tool_use', id: 'toolu_01', name: 'Read', input: {} },
      });
      contextMap.set('toolu_02', {
        conversationId: 2049,
        raw: { type: 'tool_use', id: 'toolu_02', name: 'Write', input: {} },
      });

      // Act
      contextMap.clear();

      // Assert
      expect(contextMap.size).toBe(0);
      expect(contextMap.get('toolu_01')).toBeUndefined();
      expect(contextMap.get('toolu_02')).toBeUndefined();
    });
  });
});
