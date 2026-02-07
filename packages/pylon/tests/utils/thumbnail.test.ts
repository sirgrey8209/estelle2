/**
 * 썸네일 생성 유틸리티 테스트
 *
 * 테스트 항목:
 * - 이미지 파일 → base64 썸네일 반환
 * - 가로가 긴 이미지 → 가로 200px, 세로 비율 유지
 * - 세로가 긴 이미지 → 세로 200px, 가로 비율 유지
 * - 비이미지 파일 → null 반환
 * - 지원하지 않는 mimeType → null 반환
 * - 존재하지 않는 파일 → 에러 throw
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateThumbnail } from '../../src/utils/thumbnail.js';

/**
 * 테스트용 디렉토리 생성
 */
function createTestDir(): string {
  const baseDir = path.join(process.cwd(), 'test-thumbnails');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

/**
 * 디렉토리 안전하게 정리
 */
function safeCleanup(dir: string): void {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // 정리 실패 무시
  }
}

/**
 * 간단한 PNG 이미지 생성 (1x1 빨간 픽셀)
 * PNG 헤더 + IHDR + IDAT + IEND 최소 구조
 */
function createMinimalPng(): Buffer {
  // 1x1 빨간 픽셀 PNG (유효한 PNG 파일)
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x77, 0x53, 0xde, // CRC
    0x00, 0x00, 0x00, 0x0c, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, // compressed data
    0x01, 0xa0, 0x01, 0x07, // CRC (approximate)
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4e, 0x44, // IEND
    0xae, 0x42, 0x60, 0x82, // CRC
  ]);
}

/**
 * JPEG 이미지 생성 (지정된 크기)
 * sharp를 사용하여 테스트 이미지 생성
 */
async function createTestJpeg(
  testDir: string,
  filename: string,
  width: number,
  height: number
): Promise<string> {
  // sharp를 사용하여 단색 이미지 생성
  const sharp = (await import('sharp')).default;
  const filePath = path.join(testDir, filename);

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toFile(filePath);

  return filePath;
}

/**
 * PNG 이미지 생성 (지정된 크기)
 */
async function createTestPng(
  testDir: string,
  filename: string,
  width: number,
  height: number
): Promise<string> {
  const sharp = (await import('sharp')).default;
  const filePath = path.join(testDir, filename);

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 255, b: 0 },
    },
  })
    .png()
    .toFile(filePath);

  return filePath;
}

describe('generateThumbnail', () => {
  let testDir: string;

  beforeAll(() => {
    testDir = createTestDir();
  });

  afterAll(() => {
    safeCleanup(testDir);
  });

  describe('정상 케이스', () => {
    it('should_return_base64_thumbnail_when_valid_jpeg_image', async () => {
      // Arrange
      const filePath = await createTestJpeg(testDir, 'test-image.jpg', 400, 300);
      const mimeType = 'image/jpeg';

      // Act
      const result = await generateThumbnail(filePath, mimeType);

      // Assert
      expect(result).not.toBeNull();
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('should_return_base64_thumbnail_when_valid_png_image', async () => {
      // Arrange
      const filePath = await createTestPng(testDir, 'test-image.png', 400, 300);
      const mimeType = 'image/png';

      // Act
      const result = await generateThumbnail(filePath, mimeType);

      // Assert
      expect(result).not.toBeNull();
      // PNG도 JPEG 썸네일로 변환 (용량 효율)
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('should_resize_width_to_200px_when_landscape_image', async () => {
      // Arrange: 가로가 긴 이미지 (800x400)
      const filePath = await createTestJpeg(testDir, 'landscape.jpg', 800, 400);
      const mimeType = 'image/jpeg';

      // Act
      const result = await generateThumbnail(filePath, mimeType);

      // Assert
      expect(result).not.toBeNull();
      // base64 디코딩하여 이미지 크기 확인
      const sharp = (await import('sharp')).default;
      const base64Data = result!.replace(/^data:image\/jpeg;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const metadata = await sharp(buffer).metadata();

      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(100); // 비율 유지: 800:400 = 200:100
    });

    it('should_resize_height_to_200px_when_portrait_image', async () => {
      // Arrange: 세로가 긴 이미지 (300x600)
      const filePath = await createTestJpeg(testDir, 'portrait.jpg', 300, 600);
      const mimeType = 'image/jpeg';

      // Act
      const result = await generateThumbnail(filePath, mimeType);

      // Assert
      expect(result).not.toBeNull();
      const sharp = (await import('sharp')).default;
      const base64Data = result!.replace(/^data:image\/jpeg;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const metadata = await sharp(buffer).metadata();

      expect(metadata.height).toBe(200);
      expect(metadata.width).toBe(100); // 비율 유지: 300:600 = 100:200
    });

    it('should_not_upscale_when_image_smaller_than_200px', async () => {
      // Arrange: 작은 이미지 (100x80)
      const filePath = await createTestJpeg(testDir, 'small.jpg', 100, 80);
      const mimeType = 'image/jpeg';

      // Act
      const result = await generateThumbnail(filePath, mimeType);

      // Assert
      expect(result).not.toBeNull();
      const sharp = (await import('sharp')).default;
      const base64Data = result!.replace(/^data:image\/jpeg;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const metadata = await sharp(buffer).metadata();

      // 원본보다 커지면 안 됨
      expect(metadata.width).toBeLessThanOrEqual(100);
      expect(metadata.height).toBeLessThanOrEqual(80);
    });
  });

  describe('엣지 케이스', () => {
    it('should_return_null_when_non_image_mimetype', async () => {
      // Arrange: 텍스트 파일
      const filePath = path.join(testDir, 'test.txt');
      fs.writeFileSync(filePath, 'Hello, World!');
      const mimeType = 'text/plain';

      // Act
      const result = await generateThumbnail(filePath, mimeType);

      // Assert
      expect(result).toBeNull();
    });

    it('should_return_null_when_unsupported_image_mimetype', async () => {
      // Arrange: 지원하지 않는 이미지 타입 (예: SVG)
      const filePath = path.join(testDir, 'test.svg');
      fs.writeFileSync(filePath, '<svg></svg>');
      const mimeType = 'image/svg+xml';

      // Act
      const result = await generateThumbnail(filePath, mimeType);

      // Assert
      expect(result).toBeNull();
    });

    it('should_return_null_when_application_octet_stream', async () => {
      // Arrange: 바이너리 파일
      const filePath = path.join(testDir, 'test.bin');
      fs.writeFileSync(filePath, Buffer.from([0x00, 0x01, 0x02]));
      const mimeType = 'application/octet-stream';

      // Act
      const result = await generateThumbnail(filePath, mimeType);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('에러 케이스', () => {
    it('should_throw_error_when_file_not_exists', async () => {
      // Arrange
      const filePath = path.join(testDir, 'non-existent.jpg');
      const mimeType = 'image/jpeg';

      // Act & Assert
      await expect(generateThumbnail(filePath, mimeType)).rejects.toThrow();
    });

    it('should_throw_error_when_file_is_corrupted_image', async () => {
      // Arrange: 손상된 이미지 파일 (JPEG 헤더만 있고 데이터 없음)
      const filePath = path.join(testDir, 'corrupted.jpg');
      fs.writeFileSync(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0])); // 불완전한 JPEG
      const mimeType = 'image/jpeg';

      // Act & Assert
      await expect(generateThumbnail(filePath, mimeType)).rejects.toThrow();
    });
  });

  describe('지원 mimeType', () => {
    it('should_support_image_jpeg', async () => {
      const filePath = await createTestJpeg(testDir, 'jpeg-test.jpg', 200, 200);
      const result = await generateThumbnail(filePath, 'image/jpeg');
      expect(result).not.toBeNull();
    });

    it('should_support_image_png', async () => {
      const filePath = await createTestPng(testDir, 'png-test.png', 200, 200);
      const result = await generateThumbnail(filePath, 'image/png');
      expect(result).not.toBeNull();
    });

    it('should_support_image_webp', async () => {
      const sharp = (await import('sharp')).default;
      const filePath = path.join(testDir, 'webp-test.webp');
      await sharp({
        create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 0, b: 255 } },
      })
        .webp()
        .toFile(filePath);

      const result = await generateThumbnail(filePath, 'image/webp');
      expect(result).not.toBeNull();
    });

    it('should_support_image_gif', async () => {
      const sharp = (await import('sharp')).default;
      const filePath = path.join(testDir, 'gif-test.gif');
      await sharp({
        create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 255, b: 0 } },
      })
        .gif()
        .toFile(filePath);

      const result = await generateThumbnail(filePath, 'image/gif');
      expect(result).not.toBeNull();
    });
  });
});
