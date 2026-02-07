/**
 * 썸네일 생성 유틸리티
 *
 * 이미지 파일에서 base64 썸네일을 생성한다.
 * - 지원 형식: JPEG, PNG, WebP, GIF
 * - 최대 크기: 200px (비율 유지)
 * - 출력: data:image/jpeg;base64,... (JPEG 변환으로 용량 효율)
 */

import sharp from 'sharp';
import fs from 'fs';

/** 썸네일 최대 크기 (픽셀) */
const MAX_SIZE = 200;

/** 지원하는 이미지 MIME 타입 */
const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * 이미지 파일에서 썸네일을 생성한다.
 *
 * @param filePath - 이미지 파일 경로
 * @param mimeType - 파일의 MIME 타입
 * @returns base64 데이터 URL 또는 null (비지원 타입)
 * @throws 파일이 존재하지 않거나 손상된 경우
 */
export async function generateThumbnail(
  filePath: string,
  mimeType: string
): Promise<string | null> {
  // 지원하지 않는 MIME 타입은 null 반환
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    return null;
  }

  // 파일 존재 확인
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // 이미지 로드 및 메타데이터 확인
  const image = sharp(filePath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Invalid image: ${filePath}`);
  }

  const { width, height } = metadata;

  // 리사이즈 계산: 큰 쪽이 200px을 넘으면 축소 (비율 유지)
  // 작은 이미지는 확대하지 않음
  let targetWidth: number | undefined;
  let targetHeight: number | undefined;

  if (width > MAX_SIZE || height > MAX_SIZE) {
    if (width >= height) {
      // 가로가 긴 이미지: 가로를 200px로
      targetWidth = MAX_SIZE;
    } else {
      // 세로가 긴 이미지: 세로를 200px로
      targetHeight = MAX_SIZE;
    }
  }

  // 썸네일 생성 (JPEG 출력)
  const resizeOptions: sharp.ResizeOptions = {
    fit: 'inside',
    withoutEnlargement: true,
  };

  if (targetWidth) {
    resizeOptions.width = targetWidth;
  }
  if (targetHeight) {
    resizeOptions.height = targetHeight;
  }

  const buffer = await image
    .resize(resizeOptions.width, resizeOptions.height, resizeOptions)
    .jpeg({ quality: 80 })
    .toBuffer();

  // base64 데이터 URL 생성
  const base64 = buffer.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}
