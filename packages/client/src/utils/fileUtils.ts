/**
 * @file fileUtils.ts
 * @description 파일 처리 유틸리티
 *
 * 파일 처리 공통 로직을 제공한다.
 * FileList -> AttachedImage[] 변환, 고유 ID 생성 등.
 */

import type { AttachedImage } from '../stores/imageUploadStore';

/**
 * 고유 파일 ID 생성
 *
 * 형식: file_<timestamp>_<random>
 *
 * @returns 고유 ID 문자열
 */
export function generateFileId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `file_${timestamp}_${random}`;
}

/**
 * 유효한 파일인지 검사
 *
 * @param file - 검사할 파일
 * @returns 유효하면 true, 아니면 false
 */
export function isValidFile(file: File): boolean {
  if (file == null) {
    return false;
  }
  if (file.size === 0) {
    return false;
  }
  return true;
}

/**
 * MIME 타입 패턴 매칭
 *
 * @param fileType - 파일의 MIME 타입
 * @param acceptPattern - 허용 패턴 (예: 'image/*', 'application/pdf', '*\/*')
 * @returns 매칭되면 true
 */
function matchesMimeType(fileType: string, acceptPattern: string): boolean {
  // 전체 와일드카드
  if (acceptPattern === '*/*') {
    return true;
  }

  // 정확히 일치
  if (fileType === acceptPattern) {
    return true;
  }

  // 와일드카드 패턴 (예: image/*)
  if (acceptPattern.endsWith('/*')) {
    const baseType = acceptPattern.slice(0, -2); // 'image/*' -> 'image'
    return fileType.startsWith(baseType + '/');
  }

  return false;
}

/**
 * 파일 타입으로 필터링
 *
 * @param files - 파일 배열
 * @param accept - 허용할 MIME 타입 패턴 배열
 * @returns 필터링된 파일 배열
 */
export function filterFilesByType(files: File[], accept: string[]): File[] {
  // 빈 accept 배열이면 모든 파일 허용
  if (accept.length === 0) {
    return files;
  }

  return files.filter((file) => {
    return accept.some((pattern) => matchesMimeType(file.type, pattern));
  });
}

/**
 * File 객체에서 AttachedImage 생성
 *
 * @param file - 원본 File 객체
 * @param id - 선택적 커스텀 ID
 * @returns AttachedImage 객체
 */
export function createAttachedImageFromFile(file: File, id?: string): AttachedImage {
  const fileId = id ?? generateFileId();
  const uri = URL.createObjectURL(file);

  return {
    id: fileId,
    uri,
    fileName: file.name,
    file,
    mimeType: file.type,
  };
}

/**
 * 파일 중복 키 생성 (이름 + 크기)
 */
function getFileKey(file: File): string {
  return `${file.name}:${file.size}`;
}

/**
 * FileList 또는 File 배열을 AttachedImage 배열로 변환
 *
 * - 빈 파일 제거
 * - 이름+크기 기준 중복 제거
 * - 각 파일에 고유 ID 부여
 *
 * @param files - FileList 또는 File 배열
 * @returns AttachedImage 배열
 */
export function processFiles(files: FileList | File[]): AttachedImage[] {
  // FileList를 배열로 변환
  const fileArray = Array.from(files);

  // 빈 파일 필터링
  const validFiles = fileArray.filter(isValidFile);

  // 중복 제거 (이름 + 크기 기준)
  const seen = new Set<string>();
  const uniqueFiles = validFiles.filter((file) => {
    const key = getFileKey(file);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  // AttachedImage로 변환
  return uniqueFiles.map((file) => createAttachedImageFromFile(file));
}
