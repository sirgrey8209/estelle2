/**
 * @file useLongPress.test.ts
 * @description 롱프레스 감지 훅 테스트
 *
 * 롱프레스(롱홀드) 동작을 감지하여 콜백을 실행하는 훅.
 * 모바일 터치와 데스크탑 마우스 이벤트 모두 지원.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from './useLongPress';

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('기본 동작', () => {
    it('should call callback after long press duration', () => {
      // Arrange
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      // Act - 마우스 다운 후 500ms(기본값) 경과
      act(() => {
        result.current.onMouseDown({} as React.MouseEvent);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Assert
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('should not call callback if released before duration', () => {
      // Arrange
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      // Act - 마우스 다운 후 300ms만에 업
      act(() => {
        result.current.onMouseDown({} as React.MouseEvent);
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      act(() => {
        result.current.onMouseUp({} as React.MouseEvent);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Assert - 콜백이 호출되지 않아야 함
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('should support custom duration', () => {
      // Arrange
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 1000 })
      );

      // Act - 500ms에서는 호출 안 됨
      act(() => {
        result.current.onMouseDown({} as React.MouseEvent);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Assert - 아직 호출 안 됨
      expect(onLongPress).not.toHaveBeenCalled();

      // Act - 1000ms 채우면 호출
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Assert
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('터치 이벤트', () => {
    it('should call callback on touch long press', () => {
      // Arrange
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      // Act - 터치 시작 후 500ms 경과
      act(() => {
        result.current.onTouchStart({} as React.TouchEvent);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Assert
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('should cancel on touch move', () => {
      // Arrange
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      // Act - 터치 시작 후 이동
      act(() => {
        result.current.onTouchStart({} as React.TouchEvent);
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      act(() => {
        result.current.onTouchMove({} as React.TouchEvent);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Assert - 이동으로 취소되어 콜백 호출 안 됨
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('should cancel on touch end before duration', () => {
      // Arrange
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      // Act - 터치 시작 후 빨리 끝남
      act(() => {
        result.current.onTouchStart({} as React.TouchEvent);
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      act(() => {
        result.current.onTouchEnd({} as React.TouchEvent);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Assert
      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  describe('마우스 이동 취소', () => {
    it('should cancel on mouse leave', () => {
      // Arrange
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress(onLongPress));

      // Act - 마우스 다운 후 영역 이탈
      act(() => {
        result.current.onMouseDown({} as React.MouseEvent);
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      act(() => {
        result.current.onMouseLeave({} as React.MouseEvent);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Assert
      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  describe('프로그레스 콜백', () => {
    it('should call onProgress during long press', () => {
      // Arrange
      const onLongPress = vi.fn();
      const onProgress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 500, onProgress })
      );

      // Act - 마우스 다운 후 시간 진행
      act(() => {
        result.current.onMouseDown({} as React.MouseEvent);
      });

      // 100ms마다 진행률 체크 (대략적으로)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Assert - 진행률 콜백이 호출되어야 함 (0~1 사이 값)
      expect(onProgress).toHaveBeenCalled();
      const progressValue = onProgress.mock.calls[0][0];
      expect(progressValue).toBeGreaterThan(0);
      expect(progressValue).toBeLessThanOrEqual(1);
    });

    it('should call onProgress with 0 when cancelled', () => {
      // Arrange
      const onLongPress = vi.fn();
      const onProgress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { delay: 500, onProgress })
      );

      // Act - 마우스 다운 후 취소
      act(() => {
        result.current.onMouseDown({} as React.MouseEvent);
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      act(() => {
        result.current.onMouseUp({} as React.MouseEvent);
      });

      // Assert - 취소 시 진행률 0으로 리셋
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clear timer on unmount', () => {
      // Arrange
      const onLongPress = vi.fn();
      const { result, unmount } = renderHook(() => useLongPress(onLongPress));

      // Act - 마우스 다운 후 언마운트
      act(() => {
        result.current.onMouseDown({} as React.MouseEvent);
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      unmount();
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Assert - 언마운트로 타이머 정리되어 콜백 호출 안 됨
      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  describe('비활성화 옵션', () => {
    it('should not trigger when disabled', () => {
      // Arrange
      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useLongPress(onLongPress, { disabled: true })
      );

      // Act
      act(() => {
        result.current.onMouseDown({} as React.MouseEvent);
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Assert
      expect(onLongPress).not.toHaveBeenCalled();
    });
  });
});
