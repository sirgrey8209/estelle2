/**
 * @file tool-context-map.test.ts
 * @description ClaudeBeacon의 ToolContextMap 테스트
 *
 * Pylon의 ToolContextMap과 달리, Beacon의 ToolContextMap은
 * toolUseId → { pylonAddress, entityId, raw } 매핑을 관리한다.
 *
 * MCP에서 toolUseId로 조회하면 해당 도구 호출이 어느 Pylon의
 * 어느 대화에서 발생했는지 알 수 있다.
 *
 * 테스트 케이스:
 * - set: toolUseId → PylonInfo 저장
 * - get: toolUseId → PylonInfo 조회
 * - delete: toolUseId 삭제
 * - cleanup: 오래된 항목 자동 정리
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
// 아직 구현되지 않은 모듈 - 테스트 실패 예상
import { ToolContextMap, type PylonInfo, type ToolUseRaw } from '../src/tool-context-map.js';

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
    it('should_store_pylon_info_when_tool_use_id_provided', () => {
      // Arrange
      const toolUseId = 'toolu_01ABC123';
      const info: PylonInfo = {
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
        raw: { type: 'tool_use', id: toolUseId, name: 'Read', input: {} },
      };

      // Act
      contextMap.set(toolUseId, info);

      // Assert
      const result = contextMap.get(toolUseId);
      expect(result).toBeDefined();
      expect(result?.pylonAddress).toBe('127.0.0.1:9878');
      expect(result?.entityId).toBe(2049);
      expect(result?.raw.name).toBe('Read');
    });

    it('should_overwrite_existing_mapping_when_same_tool_use_id', () => {
      // Arrange
      const toolUseId = 'toolu_01ABC123';
      const info1: PylonInfo = {
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
        raw: { type: 'tool_use', id: toolUseId, name: 'Read', input: {} },
      };
      const info2: PylonInfo = {
        pylonAddress: '127.0.0.1:9879',
        entityId: 3073,
        raw: { type: 'tool_use', id: toolUseId, name: 'Write', input: {} },
      };
      contextMap.set(toolUseId, info1);

      // Act
      contextMap.set(toolUseId, info2);

      // Assert
      const result = contextMap.get(toolUseId);
      expect(result?.pylonAddress).toBe('127.0.0.1:9879');
      expect(result?.entityId).toBe(3073);
      expect(result?.raw.name).toBe('Write');
    });

    it('should_store_multiple_mappings_for_different_pylons', () => {
      // Arrange & Act - 3개의 Pylon(dev/stage/release)에서 도구 호출
      contextMap.set('toolu_dev_01', {
        pylonAddress: '127.0.0.1:9876', // dev
        entityId: 1025,
        raw: { type: 'tool_use', id: 'toolu_dev_01', name: 'Read', input: {} },
      });
      contextMap.set('toolu_stage_01', {
        pylonAddress: '127.0.0.1:9878', // stage
        entityId: 2049,
        raw: { type: 'tool_use', id: 'toolu_stage_01', name: 'Write', input: {} },
      });
      contextMap.set('toolu_release_01', {
        pylonAddress: '127.0.0.1:9879', // release
        entityId: 3073,
        raw: { type: 'tool_use', id: 'toolu_release_01', name: 'Edit', input: {} },
      });

      // Assert
      expect(contextMap.get('toolu_dev_01')?.pylonAddress).toBe('127.0.0.1:9876');
      expect(contextMap.get('toolu_stage_01')?.pylonAddress).toBe('127.0.0.1:9878');
      expect(contextMap.get('toolu_release_01')?.pylonAddress).toBe('127.0.0.1:9879');
    });

    // 엣지 케이스
    it('should_not_store_when_tool_use_id_is_empty', () => {
      // Arrange
      const info: PylonInfo = {
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
        raw: { type: 'tool_use', id: '', name: 'Read', input: {} },
      };

      // Act
      contextMap.set('', info);

      // Assert
      expect(contextMap.get('')).toBeUndefined();
      expect(contextMap.size).toBe(0);
    });

    it('should_store_info_with_complex_raw_input', () => {
      // Arrange - 실제 도구 호출처럼 복잡한 input 포함
      const toolUseId = 'toolu_complex';
      const info: PylonInfo = {
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
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
      contextMap.set(toolUseId, info);

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
    it('should_return_pylon_info_when_tool_use_id_exists', () => {
      // Arrange
      const toolUseId = 'toolu_01ABC123';
      const info: PylonInfo = {
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
        raw: { type: 'tool_use', id: toolUseId, name: 'Read', input: {} },
      };
      contextMap.set(toolUseId, info);

      // Act
      const result = contextMap.get(toolUseId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.pylonAddress).toBe('127.0.0.1:9878');
      expect(result?.entityId).toBe(2049);
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
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
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
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
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
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
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
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
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

    it('should_cleanup_entries_from_multiple_pylons_based_on_age', () => {
      // Arrange
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      // 오래된 항목들 (dev, stage)
      contextMap.set('toolu_old_dev', {
        pylonAddress: '127.0.0.1:9876',
        entityId: 1025,
        raw: { type: 'tool_use', id: 'toolu_old_dev', name: 'Read', input: {} },
      });

      vi.setSystemTime(now + 1 * 60 * 1000);
      contextMap.set('toolu_old_stage', {
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
        raw: { type: 'tool_use', id: 'toolu_old_stage', name: 'Read', input: {} },
      });

      // 10분 후 새 항목 (release)
      vi.setSystemTime(now + 10 * 60 * 1000);
      contextMap.set('toolu_new_release', {
        pylonAddress: '127.0.0.1:9879',
        entityId: 3073,
        raw: { type: 'tool_use', id: 'toolu_new_release', name: 'Read', input: {} },
      });

      // 1분 더 경과
      vi.setSystemTime(now + 11 * 60 * 1000);

      // Act - maxAge: 5분
      const removed = contextMap.cleanup(5 * 60 * 1000);

      // Assert - dev와 stage는 삭제, release는 유지
      expect(removed).toBe(2);
      expect(contextMap.get('toolu_old_dev')).toBeUndefined();
      expect(contextMap.get('toolu_old_stage')).toBeUndefined();
      expect(contextMap.get('toolu_new_release')).toBeDefined();

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
        pylonAddress: '127.0.0.1:9876',
        entityId: 1025,
        raw: { type: 'tool_use', id: 'toolu_01', name: 'Read', input: {} },
      });
      contextMap.set('toolu_02', {
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
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
        pylonAddress: '127.0.0.1:9876',
        entityId: 1025,
        raw: { type: 'tool_use', id: 'toolu_01', name: 'Read', input: {} },
      });
      contextMap.set('toolu_02', {
        pylonAddress: '127.0.0.1:9878',
        entityId: 2049,
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
