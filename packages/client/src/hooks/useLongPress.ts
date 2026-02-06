import { useCallback, useRef, useEffect, useMemo } from 'react';

/**
 * useLongPress 훅 옵션
 */
export interface UseLongPressOptions {
  /** 롱프레스 인식 시간 (ms), 기본값: 500 */
  delay?: number;
  /** 진행률 콜백 (0~1) */
  onProgress?: (progress: number) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

/**
 * useLongPress 훅 반환값
 */
export interface UseLongPressHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
}

/** 기본 롱프레스 인식 시간 (ms) */
const DEFAULT_DELAY = 500;

/** 진행률 업데이트 간격 (ms) */
const PROGRESS_INTERVAL = 50;

/**
 * 롱프레스(롱홀드) 감지 훅
 *
 * 마우스와 터치 이벤트 모두 지원.
 * 지정된 시간 동안 누르고 있으면 콜백을 실행합니다.
 *
 * @param onLongPress 롱프레스 완료 시 실행할 콜백
 * @param options 옵션 (delay, onProgress, disabled)
 * @returns 이벤트 핸들러 객체
 */
export function useLongPress(
  onLongPress: () => void,
  options: UseLongPressOptions = {}
): UseLongPressHandlers {
  const { delay = DEFAULT_DELAY, onProgress, disabled = false } = options;

  // 타이머 참조
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // 타이머 정리 함수
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // 취소 처리 (진행률 0으로 리셋)
  const cancel = useCallback(() => {
    clearTimers();
    if (onProgress) {
      onProgress(0);
    }
  }, [clearTimers, onProgress]);

  // 프레스 시작
  const start = useCallback(() => {
    if (disabled) return;

    startTimeRef.current = Date.now();

    // 롱프레스 타이머
    timerRef.current = setTimeout(() => {
      onLongPress();
      clearTimers();
    }, delay);

    // 진행률 업데이트 타이머
    if (onProgress) {
      progressTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / delay, 1);
        onProgress(progress);
      }, PROGRESS_INTERVAL);
    }
  }, [disabled, delay, onLongPress, onProgress, clearTimers]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // 이벤트 핸들러 객체
  return useMemo(
    () => ({
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchMove: cancel,
    }),
    [start, cancel]
  );
}
