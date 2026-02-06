/**
 * @file platform/useImagePicker.ts
 * @description 플랫폼 독립적 이미지 선택 훅 (웹: input[type=file])
 */

import { useRef, useCallback } from 'react';

/**
 * 선택된 이미지 정보
 */
export interface SelectedImage {
  uri: string;
  fileName: string;
  mimeType: string;
  file: File;
}

/**
 * 이미지 선택 옵션
 */
export interface ImagePickerOptions {
  /** 여러 이미지 선택 허용 */
  allowsMultipleSelection?: boolean;
  /** 허용할 미디어 타입 */
  mediaTypes?: 'images' | 'videos' | 'all';
  /** 이미지 품질 (0-1) */
  quality?: number;
}

/**
 * 이미지 선택 결과
 */
export interface ImagePickerResult {
  canceled: boolean;
  assets: SelectedImage[];
}

/**
 * 웹 이미지 선택 훅
 */
export function useImagePicker() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resolveRef = useRef<((result: ImagePickerResult) => void) | null>(null);

  /**
   * 파일 입력 요소 생성 (lazy)
   */
  const getInput = useCallback(() => {
    if (!inputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.style.display = 'none';
      input.addEventListener('change', handleChange);
      input.addEventListener('cancel', handleCancel);
      document.body.appendChild(input);
      inputRef.current = input;
    }
    return inputRef.current;
  }, []);

  /**
   * 파일 선택 핸들러
   */
  const handleChange = useCallback((event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (files && files.length > 0 && resolveRef.current) {
      const assets: SelectedImage[] = Array.from(files).map((file) => ({
        uri: URL.createObjectURL(file),
        fileName: file.name,
        mimeType: file.type,
        file,
      }));

      resolveRef.current({ canceled: false, assets });
      resolveRef.current = null;
    }

    // 입력 초기화 (같은 파일 재선택 허용)
    input.value = '';
  }, []);

  /**
   * 취소 핸들러
   */
  const handleCancel = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current({ canceled: true, assets: [] });
      resolveRef.current = null;
    }
  }, []);

  /**
   * 이미지 라이브러리에서 선택
   */
  const launchImageLibrary = useCallback(
    (options: ImagePickerOptions = {}): Promise<ImagePickerResult> => {
      return new Promise((resolve) => {
        const input = getInput();

        // 옵션 설정
        const accept = getAcceptType(options.mediaTypes);
        input.accept = accept;
        input.multiple = options.allowsMultipleSelection ?? false;

        resolveRef.current = resolve;
        input.click();
      });
    },
    [getInput]
  );

  /**
   * 카메라에서 촬영 (웹에서는 이미지 라이브러리와 동일)
   */
  const launchCamera = useCallback(
    (options: ImagePickerOptions = {}): Promise<ImagePickerResult> => {
      // 웹에서는 카메라 접근이 제한적이므로 이미지 라이브러리로 대체
      return launchImageLibrary(options);
    },
    [launchImageLibrary]
  );

  return {
    launchImageLibrary,
    launchCamera,
  };
}

/**
 * 미디어 타입에 따른 accept 문자열 반환
 */
function getAcceptType(mediaTypes?: 'images' | 'videos' | 'all'): string {
  switch (mediaTypes) {
    case 'videos':
      return 'video/*';
    case 'all':
      return 'image/*,video/*';
    case 'images':
    default:
      return 'image/*';
  }
}
