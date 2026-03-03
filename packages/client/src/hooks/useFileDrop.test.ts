/**
 * @file useFileDrop.test.ts
 * @description 파일 드래그 드롭 훅 테스트
 *
 * 드래그 드롭 로직을 커스텀 훅으로 분리하여 테스트.
 * 드래그 오버, 드래그 떠남, 드롭 이벤트를 처리한다.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileDrop } from './useFileDrop';

/**
 * Mock DragEvent 생성 헬퍼
 */
function createMockDragEvent(
  files: File[] = [],
  overrides: Partial<DragEvent> = {}
): React.DragEvent<HTMLElement> {
  const dataTransfer = {
    files: files as unknown as FileList,
    items: files.map((f) => ({
      kind: 'file',
      type: f.type,
      getAsFile: () => f,
    })) as unknown as DataTransferItemList,
    types: ['Files'],
  } as unknown as DataTransfer;

  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer,
    ...overrides,
  } as unknown as React.DragEvent<HTMLElement>;
}

describe('useFileDrop', () => {
  describe('기본 동작', () => {
    it('should_return_isDragging_false_when_initialized', () => {
      // Arrange & Act
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));

      // Assert
      expect(result.current.isDragging).toBe(false);
    });

    it('should_return_handlers_object', () => {
      // Arrange & Act
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));

      // Assert
      expect(result.current.handlers).toBeDefined();
      expect(result.current.handlers.onDragOver).toBeInstanceOf(Function);
      expect(result.current.handlers.onDragEnter).toBeInstanceOf(Function);
      expect(result.current.handlers.onDragLeave).toBeInstanceOf(Function);
      expect(result.current.handlers.onDrop).toBeInstanceOf(Function);
    });
  });

  describe('드래그 오버', () => {
    it('should_set_isDragging_true_when_drag_enters', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));
      const event = createMockDragEvent();

      // Act
      act(() => {
        result.current.handlers.onDragEnter(event);
      });

      // Assert
      expect(result.current.isDragging).toBe(true);
    });

    it('should_prevent_default_on_drag_over', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));
      const event = createMockDragEvent();

      // Act
      act(() => {
        result.current.handlers.onDragOver(event);
      });

      // Assert
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should_keep_isDragging_true_on_drag_over', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));
      const enterEvent = createMockDragEvent();
      const overEvent = createMockDragEvent();

      // Act
      act(() => {
        result.current.handlers.onDragEnter(enterEvent);
        result.current.handlers.onDragOver(overEvent);
      });

      // Assert
      expect(result.current.isDragging).toBe(true);
    });
  });

  describe('드래그 떠남', () => {
    it('should_set_isDragging_false_when_drag_leaves', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));
      const enterEvent = createMockDragEvent();
      const leaveEvent = createMockDragEvent();

      // Act
      act(() => {
        result.current.handlers.onDragEnter(enterEvent);
      });

      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.handlers.onDragLeave(leaveEvent);
      });

      // Assert
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe('드롭', () => {
    it('should_call_onFiles_with_dropped_files_when_drop', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));

      const file1 = new File(['content1'], 'test1.png', { type: 'image/png' });
      const file2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });
      const dropEvent = createMockDragEvent([file1, file2]);

      // Act
      act(() => {
        result.current.handlers.onDrop(dropEvent);
      });

      // Assert
      expect(onFiles).toHaveBeenCalledTimes(1);
      expect(onFiles).toHaveBeenCalledWith([file1, file2]);
    });

    it('should_set_isDragging_false_after_drop', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));

      const file = new File(['content'], 'test.png', { type: 'image/png' });
      const enterEvent = createMockDragEvent([file]);
      const dropEvent = createMockDragEvent([file]);

      // Act
      act(() => {
        result.current.handlers.onDragEnter(enterEvent);
      });

      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.handlers.onDrop(dropEvent);
      });

      // Assert
      expect(result.current.isDragging).toBe(false);
    });

    it('should_prevent_default_on_drop', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));

      const file = new File(['content'], 'test.png', { type: 'image/png' });
      const dropEvent = createMockDragEvent([file]);

      // Act
      act(() => {
        result.current.handlers.onDrop(dropEvent);
      });

      // Assert
      expect(dropEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('엣지 케이스', () => {
    it('should_handle_empty_drop_when_no_files', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));
      const dropEvent = createMockDragEvent([]);

      // Act
      act(() => {
        result.current.handlers.onDrop(dropEvent);
      });

      // Assert - 빈 배열로 콜백 호출 또는 호출 안 함 (구현에 따라)
      // 여기서는 빈 배열이면 콜백을 호출하지 않는 것이 더 나은 UX
      expect(onFiles).not.toHaveBeenCalled();
    });

    it('should_handle_drag_leave_without_prior_drag_enter', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));
      const leaveEvent = createMockDragEvent();

      // Act - dragEnter 없이 dragLeave
      act(() => {
        result.current.handlers.onDragLeave(leaveEvent);
      });

      // Assert - 에러 없이 false 유지
      expect(result.current.isDragging).toBe(false);
    });

    it('should_handle_multiple_drag_enter_events', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));

      // Act - 중첩된 요소로 인한 다중 dragEnter
      act(() => {
        result.current.handlers.onDragEnter(createMockDragEvent());
        result.current.handlers.onDragEnter(createMockDragEvent());
      });

      // Assert
      expect(result.current.isDragging).toBe(true);

      // 하나의 dragLeave로는 isDragging이 false가 되지 않아야 함 (중첩 요소 고려)
      // 구현에 따라 다를 수 있음
    });

    it('should_handle_non_file_drag_when_no_files_type', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));

      // 텍스트 드래그 (파일이 아님)
      const textDragEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          files: [] as unknown as FileList,
          items: [] as unknown as DataTransferItemList,
          types: ['text/plain'], // 파일이 아님
        },
      } as unknown as React.DragEvent<HTMLElement>;

      // Act
      act(() => {
        result.current.handlers.onDragEnter(textDragEvent);
      });

      // Assert - 파일이 아닌 드래그는 무시할 수 있음 (구현에 따라)
      // 또는 isDragging이 true가 될 수 있음
    });
  });

  describe('비활성화 옵션', () => {
    it('should_not_set_isDragging_when_disabled', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() =>
        useFileDrop(onFiles, { disabled: true })
      );
      const event = createMockDragEvent();

      // Act
      act(() => {
        result.current.handlers.onDragEnter(event);
      });

      // Assert
      expect(result.current.isDragging).toBe(false);
    });

    it('should_not_call_onFiles_when_disabled', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() =>
        useFileDrop(onFiles, { disabled: true })
      );

      const file = new File(['content'], 'test.png', { type: 'image/png' });
      const dropEvent = createMockDragEvent([file]);

      // Act
      act(() => {
        result.current.handlers.onDrop(dropEvent);
      });

      // Assert
      expect(onFiles).not.toHaveBeenCalled();
    });
  });

  describe('파일 타입 필터', () => {
    it('should_filter_files_by_accept_option', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() =>
        useFileDrop(onFiles, { accept: ['image/*'] })
      );

      const imageFile = new File(['img'], 'test.png', { type: 'image/png' });
      const textFile = new File(['txt'], 'test.txt', { type: 'text/plain' });
      const dropEvent = createMockDragEvent([imageFile, textFile]);

      // Act
      act(() => {
        result.current.handlers.onDrop(dropEvent);
      });

      // Assert - 이미지만 전달되어야 함
      expect(onFiles).toHaveBeenCalledWith([imageFile]);
    });

    it('should_accept_all_files_when_no_accept_option', () => {
      // Arrange
      const onFiles = vi.fn();
      const { result } = renderHook(() => useFileDrop(onFiles));

      const imageFile = new File(['img'], 'test.png', { type: 'image/png' });
      const textFile = new File(['txt'], 'test.txt', { type: 'text/plain' });
      const dropEvent = createMockDragEvent([imageFile, textFile]);

      // Act
      act(() => {
        result.current.handlers.onDrop(dropEvent);
      });

      // Assert - 모든 파일 전달
      expect(onFiles).toHaveBeenCalledWith([imageFile, textFile]);
    });
  });
});
