/**
 * @file useFileDrop.ts
 * @description 파일 드래그 드롭 훅
 *
 * 드래그 드롭 로직을 커스텀 훅으로 분리.
 * 드래그 오버, 드래그 떠남, 드롭 이벤트를 처리한다.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { filterFilesByType } from '../utils/fileUtils';

/**
 * useFileDrop 훅 옵션
 */
export interface UseFileDropOptions {
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 허용 MIME 타입 (예: ['image/*']) */
  accept?: string[];
}

/**
 * useFileDrop 훅 반환 타입
 */
export interface UseFileDropResult {
  /** 드래그 중인지 여부 */
  isDragging: boolean;
  /** 이벤트 핸들러 */
  handlers: {
    onDragOver: (e: React.DragEvent<HTMLElement>) => void;
    onDragEnter: (e: React.DragEvent<HTMLElement>) => void;
    onDragLeave: (e: React.DragEvent<HTMLElement>) => void;
    onDrop: (e: React.DragEvent<HTMLElement>) => void;
  };
}

/**
 * 파일 드래그 드롭 훅
 *
 * @param onFiles - 파일 드롭 시 호출되는 콜백
 * @param options - 훅 옵션
 * @returns 드래그 상태 및 이벤트 핸들러
 */
export function useFileDrop(
  onFiles: (files: File[]) => void,
  options: UseFileDropOptions = {}
): UseFileDropResult {
  const { disabled = false, accept } = options;
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      if (disabled) return;
    },
    [disabled]
  );

  const onDragEnter = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      if (disabled) return;
      dragCounterRef.current += 1;
      setIsDragging(true);
    },
    [disabled]
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      if (disabled) return;
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    },
    [disabled]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer?.files || []);

      // 빈 파일 목록이면 콜백 호출하지 않음
      if (files.length === 0) return;

      // accept 옵션이 있으면 필터링
      const filteredFiles = accept && accept.length > 0
        ? filterFilesByType(files, accept)
        : files;

      // 필터링 후 빈 목록이면 콜백 호출하지 않음
      if (filteredFiles.length === 0) return;

      onFiles(filteredFiles);
    },
    [disabled, accept, onFiles]
  );

  const handlers = useMemo(
    () => ({
      onDragOver,
      onDragEnter,
      onDragLeave,
      onDrop,
    }),
    [onDragOver, onDragEnter, onDragLeave, onDrop]
  );

  return { isDragging, handlers };
}
