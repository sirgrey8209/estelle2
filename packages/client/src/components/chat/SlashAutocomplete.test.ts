/**
 * @file SlashAutocomplete.test.ts
 * @description SlashAutocomplete 유틸리티 함수 테스트
 *
 * 슬래시 명령어 자동완성을 위한 필터링 로직 테스트입니다.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { filterSlashCommandsByPrefix, parseSlashCommand, useSlashAutocomplete } from './SlashAutocomplete';

// ============================================================================
// filterSlashCommandsByPrefix 테스트
// ============================================================================

describe('filterSlashCommandsByPrefix', () => {
  const sampleCommands = ['/compact', '/clear', '/help', '/tdd-flow', '/keybindings-help'];

  describe('정상 케이스', () => {
    it('should_return_all_commands_when_prefix_is_slash_only', () => {
      // Arrange
      const prefix = '/';

      // Act
      const result = filterSlashCommandsByPrefix(sampleCommands, prefix);

      // Assert
      expect(result).toEqual(sampleCommands);
    });

    it('should_filter_commands_by_prefix', () => {
      // Arrange
      const prefix = '/cl';

      // Act
      const result = filterSlashCommandsByPrefix(sampleCommands, prefix);

      // Assert
      expect(result).toEqual(['/clear']);
    });

    it('should_filter_commands_with_multiple_matches', () => {
      // Arrange
      const prefix = '/c';

      // Act
      const result = filterSlashCommandsByPrefix(sampleCommands, prefix);

      // Assert
      expect(result).toEqual(['/compact', '/clear']);
    });

    it('should_be_case_insensitive', () => {
      // Arrange
      const prefix = '/COMPACT';

      // Act
      const result = filterSlashCommandsByPrefix(sampleCommands, prefix);

      // Assert
      expect(result).toEqual(['/compact']);
    });

    it('should_filter_skill_commands', () => {
      // Arrange
      const prefix = '/tdd';

      // Act
      const result = filterSlashCommandsByPrefix(sampleCommands, prefix);

      // Assert
      expect(result).toEqual(['/tdd-flow']);
    });
  });

  describe('엣지 케이스', () => {
    it('should_return_empty_when_no_match', () => {
      // Arrange
      const prefix = '/xyz';

      // Act
      const result = filterSlashCommandsByPrefix(sampleCommands, prefix);

      // Assert
      expect(result).toEqual([]);
    });

    it('should_return_empty_when_commands_is_empty', () => {
      // Arrange
      const prefix = '/compact';

      // Act
      const result = filterSlashCommandsByPrefix([], prefix);

      // Assert
      expect(result).toEqual([]);
    });

    it('should_return_empty_when_prefix_has_no_slash', () => {
      // Arrange
      const prefix = 'compact';

      // Act
      const result = filterSlashCommandsByPrefix(sampleCommands, prefix);

      // Assert
      expect(result).toEqual([]);
    });

    it('should_handle_prefix_with_trailing_space', () => {
      // Arrange
      const prefix = '/compact ';

      // Act
      const result = filterSlashCommandsByPrefix(sampleCommands, prefix);

      // Assert
      // 공백 포함 시 정확히 일치하는 것만 (없으면 빈 배열)
      expect(result).toEqual([]);
    });
  });
});

// ============================================================================
// parseSlashCommand 테스트
// ============================================================================

describe('parseSlashCommand', () => {
  describe('정상 케이스', () => {
    it('should_parse_slash_only', () => {
      // Arrange
      const input = '/';

      // Act
      const result = parseSlashCommand(input);

      // Assert
      expect(result).toEqual({
        isSlashCommand: true,
        prefix: '/',
        command: '',
      });
    });

    it('should_parse_slash_with_partial_command', () => {
      // Arrange
      const input = '/Rea';

      // Act
      const result = parseSlashCommand(input);

      // Assert
      expect(result).toEqual({
        isSlashCommand: true,
        prefix: '/Rea',
        command: 'Rea',
      });
    });

    it('should_parse_complete_command', () => {
      // Arrange
      const input = '/Read';

      // Act
      const result = parseSlashCommand(input);

      // Assert
      expect(result).toEqual({
        isSlashCommand: true,
        prefix: '/Read',
        command: 'Read',
      });
    });
  });

  describe('엣지 케이스', () => {
    it('should_not_be_slash_command_when_empty', () => {
      // Arrange
      const input = '';

      // Act
      const result = parseSlashCommand(input);

      // Assert
      expect(result).toEqual({
        isSlashCommand: false,
        prefix: '',
        command: '',
      });
    });

    it('should_not_be_slash_command_when_no_slash', () => {
      // Arrange
      const input = 'Hello world';

      // Act
      const result = parseSlashCommand(input);

      // Assert
      expect(result).toEqual({
        isSlashCommand: false,
        prefix: '',
        command: '',
      });
    });

    it('should_be_slash_command_when_slash_after_space', () => {
      // Arrange: 공백 뒤에 슬래시가 있으면 슬래시 명령어 입력 중으로 인식
      const input = 'Hello /Read';

      // Act
      const result = parseSlashCommand(input);

      // Assert: 문장 끝의 /Read를 슬래시 명령어로 인식
      expect(result).toEqual({
        isSlashCommand: true,
        prefix: '/Read',
        command: 'Read',
      });
    });

    it('should_not_be_slash_command_when_has_space_after_command', () => {
      // Arrange: 명령어 뒤에 공백이 있으면 자동완성 종료
      const input = '/Read some text';

      // Act
      const result = parseSlashCommand(input);

      // Assert
      expect(result).toEqual({
        isSlashCommand: false,
        prefix: '',
        command: '',
      });
    });

    it('should_handle_mcp_style_command', () => {
      // Arrange
      const input = '/mcp__slack__send';

      // Act
      const result = parseSlashCommand(input);

      // Assert
      expect(result).toEqual({
        isSlashCommand: true,
        prefix: '/mcp__slack__send',
        command: 'mcp__slack__send',
      });
    });
  });
});

// ============================================================================
// useSlashAutocomplete 훅 테스트
// ============================================================================

describe('useSlashAutocomplete', () => {
  describe('초기 상태', () => {
    it('should_return_zero_selectedIndex_initially', () => {
      // Arrange & Act
      const { result } = renderHook(() => useSlashAutocomplete(5));

      // Assert
      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('moveDown', () => {
    it('should_increment_selectedIndex_when_moveDown_called', () => {
      // Arrange
      const { result } = renderHook(() => useSlashAutocomplete(5));

      // Act
      act(() => {
        result.current.moveDown();
      });

      // Assert
      expect(result.current.selectedIndex).toBe(1);
    });

    it('should_wrap_to_zero_when_moveDown_at_last_item', () => {
      // Arrange
      const { result } = renderHook(() => useSlashAutocomplete(3));

      // Act: 0 -> 1 -> 2 -> 0 (wrap)
      act(() => {
        result.current.moveDown();
        result.current.moveDown();
        result.current.moveDown();
      });

      // Assert
      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('moveUp', () => {
    it('should_decrement_selectedIndex_when_moveUp_called', () => {
      // Arrange
      const { result } = renderHook(() => useSlashAutocomplete(5));

      // 먼저 아래로 이동
      act(() => {
        result.current.moveDown();
        result.current.moveDown();
      });

      // Act
      act(() => {
        result.current.moveUp();
      });

      // Assert
      expect(result.current.selectedIndex).toBe(1);
    });

    it('should_wrap_to_last_when_moveUp_at_first_item', () => {
      // Arrange
      const { result } = renderHook(() => useSlashAutocomplete(3));

      // Act: 0에서 위로 이동하면 마지막(2)으로 wrap
      act(() => {
        result.current.moveUp();
      });

      // Assert
      expect(result.current.selectedIndex).toBe(2);
    });
  });

  describe('reset', () => {
    it('should_reset_selectedIndex_to_zero', () => {
      // Arrange
      const { result } = renderHook(() => useSlashAutocomplete(5));

      // 먼저 아래로 이동
      act(() => {
        result.current.moveDown();
        result.current.moveDown();
      });

      // Act
      act(() => {
        result.current.reset();
      });

      // Assert
      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('itemCount 변경', () => {
    it('should_adjust_selectedIndex_when_itemCount_decreases', () => {
      // Arrange: itemCount=5, selectedIndex=3
      const { result, rerender } = renderHook(
        ({ itemCount }) => useSlashAutocomplete(itemCount),
        { initialProps: { itemCount: 5 } }
      );

      act(() => {
        result.current.moveDown();
        result.current.moveDown();
        result.current.moveDown();
      });
      expect(result.current.selectedIndex).toBe(3);

      // Act: itemCount를 2로 줄이면 selectedIndex는 1로 조정 (itemCount - 1)
      rerender({ itemCount: 2 });

      // Assert
      expect(result.current.selectedIndex).toBe(1);
    });

    it('should_keep_selectedIndex_when_itemCount_increases', () => {
      // Arrange: itemCount=3, selectedIndex=2
      const { result, rerender } = renderHook(
        ({ itemCount }) => useSlashAutocomplete(itemCount),
        { initialProps: { itemCount: 3 } }
      );

      act(() => {
        result.current.moveDown();
        result.current.moveDown();
      });
      expect(result.current.selectedIndex).toBe(2);

      // Act: itemCount를 5로 늘리면 selectedIndex는 그대로 2
      rerender({ itemCount: 5 });

      // Assert
      expect(result.current.selectedIndex).toBe(2);
    });
  });

  describe('엣지 케이스', () => {
    it('should_handle_empty_list', () => {
      // Arrange & Act
      const { result } = renderHook(() => useSlashAutocomplete(0));

      // Assert: itemCount=0일 때 selectedIndex는 0 (또는 -1)
      expect(result.current.selectedIndex).toBe(0);

      // moveUp/moveDown은 아무 일도 하지 않아야 함
      act(() => {
        result.current.moveDown();
      });
      expect(result.current.selectedIndex).toBe(0);

      act(() => {
        result.current.moveUp();
      });
      expect(result.current.selectedIndex).toBe(0);
    });

    it('should_handle_single_item_list', () => {
      // Arrange & Act
      const { result } = renderHook(() => useSlashAutocomplete(1));

      // Assert: itemCount=1일 때
      expect(result.current.selectedIndex).toBe(0);

      // moveDown/moveUp은 wrap해서 다시 0
      act(() => {
        result.current.moveDown();
      });
      expect(result.current.selectedIndex).toBe(0);

      act(() => {
        result.current.moveUp();
      });
      expect(result.current.selectedIndex).toBe(0);
    });
  });
});
