/**
 * @file send-file.test.ts
 * @description send_file MCP 도구 테스트
 *
 * Claude가 사용자에게 파일을 전송할 때 사용하는 MCP 도구의 핵심 로직을 테스트합니다.
 * - 파일 존재 확인
 * - MIME 타입 판별 (확장자 기반)
 * - 파일 타입 분류 (image/markdown/text/binary)
 * - 상대 경로 → 절대 경로 변환
 * - MCP 표준 응답 포맷 반환
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { executeSendFile } from '../../../src/mcp/tools/send-file.js';

// ============================================================================
// 테스트 헬퍼
// ============================================================================

/** 테스트용 임시 디렉토리 */
const TEST_DIR = path.join(process.cwd(), 'test-send-file');
const TEST_WORKING_DIR = path.join(TEST_DIR, 'workdir');

/**
 * MCP 표준 응답에서 텍스트 추출
 */
function extractText(result: { content: Array<{ type: string; text: string }> }): string {
  return result.content[0]?.text ?? '';
}

/**
 * MCP 성공 응답에서 파싱된 JSON 추출
 */
function extractJson(result: { content: Array<{ type: string; text: string }> }): Record<string, unknown> {
  return JSON.parse(extractText(result));
}

// ============================================================================
// 테스트
// ============================================================================

describe('executeSendFile', () => {
  // ==========================================================================
  // Setup / Teardown
  // ==========================================================================

  beforeAll(() => {
    // 테스트 디렉토리 생성
    fs.mkdirSync(TEST_WORKING_DIR, { recursive: true });

    // 테스트용 파일 생성
    fs.writeFileSync(path.join(TEST_DIR, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(path.join(TEST_DIR, 'photo.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    fs.writeFileSync(path.join(TEST_DIR, 'readme.md'), '# Hello');
    fs.writeFileSync(path.join(TEST_DIR, 'notes.txt'), 'some notes');
    fs.writeFileSync(path.join(TEST_DIR, 'data.json'), '{"key": "value"}');
    fs.writeFileSync(path.join(TEST_DIR, 'script.ts'), 'const x = 1;');
    fs.writeFileSync(path.join(TEST_DIR, 'style.css'), 'body {}');
    fs.writeFileSync(path.join(TEST_DIR, 'app.py'), 'print("hello")');
    fs.writeFileSync(path.join(TEST_DIR, 'unknown.xyz'), 'binary data');

    // workdir 하위에 상대 경로 테스트용 파일 생성
    fs.writeFileSync(path.join(TEST_WORKING_DIR, 'relative.txt'), 'relative file');
  });

  afterAll(() => {
    // 테스트 디렉토리 정리
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // 정리 실패 무시
    }
  });

  // ==========================================================================
  // 정상 케이스 (Happy Path)
  // ==========================================================================

  describe('정상 케이스', () => {
    it('should_return_success_with_file_info_when_file_exists', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'image.png');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      expect(result.isError).toBeUndefined();
      const json = extractJson(result);
      expect(json.success).toBe(true);

      const file = json.file as Record<string, unknown>;
      expect(file.filename).toBe('image.png');
      expect(file.mimeType).toBe('image/png');
      expect(file.size).toBeGreaterThan(0);
      expect(file.path).toBe(filePath);
    });

    it('should_include_description_when_provided', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'readme.md');

      // Act
      const result = await executeSendFile(TEST_DIR, {
        path: filePath,
        description: '프로젝트 소개 문서',
      });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.description).toBe('프로젝트 소개 문서');
    });

    it('should_set_description_null_when_not_provided', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'notes.txt');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.description).toBeNull();
    });

    it('should_resolve_relative_path_against_working_dir', async () => {
      // Arrange - 상대 경로 전달
      const relativePath = 'relative.txt';

      // Act
      const result = await executeSendFile(TEST_WORKING_DIR, { path: relativePath });

      // Assert
      expect(result.isError).toBeUndefined();
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.path).toBe(path.join(TEST_WORKING_DIR, 'relative.txt'));
    });

    it('should_use_absolute_path_as_is', async () => {
      // Arrange - 절대 경로 전달
      const absolutePath = path.join(TEST_DIR, 'notes.txt');

      // Act
      const result = await executeSendFile(TEST_WORKING_DIR, { path: absolutePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.path).toBe(absolutePath);
    });
  });

  // ==========================================================================
  // MIME 타입 판별
  // ==========================================================================

  describe('MIME 타입 판별', () => {
    it('should_detect_image_jpeg_for_jpg_extension', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'photo.jpg');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.mimeType).toBe('image/jpeg');
    });

    it('should_detect_image_png_for_png_extension', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'image.png');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.mimeType).toBe('image/png');
    });

    it('should_detect_text_markdown_for_md_extension', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'readme.md');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.mimeType).toBe('text/markdown');
    });

    it('should_detect_text_plain_for_txt_extension', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'notes.txt');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.mimeType).toBe('text/plain');
    });

    it('should_detect_application_json_for_json_extension', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'data.json');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.mimeType).toBe('application/json');
    });

    it('should_detect_text_typescript_for_ts_extension', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'script.ts');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.mimeType).toBe('text/typescript');
    });

    it('should_detect_octet_stream_for_unknown_extension', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'unknown.xyz');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.mimeType).toBe('application/octet-stream');
    });
  });

  // ==========================================================================
  // 파일 타입 분류
  // ==========================================================================

  describe('파일 타입 분류', () => {
    it('should_classify_as_image_when_mime_starts_with_image', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'image.png');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.fileType).toBe('image');
    });

    it('should_classify_as_markdown_when_mime_is_text_markdown', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'readme.md');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.fileType).toBe('markdown');
    });

    it('should_classify_as_text_when_mime_starts_with_text', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'notes.txt');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.fileType).toBe('text');
    });

    it('should_classify_as_binary_when_mime_is_unknown', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'unknown.xyz');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      const json = extractJson(result);
      const file = json.file as Record<string, unknown>;
      expect(file.fileType).toBe('binary');
    });
  });

  // ==========================================================================
  // 에러 케이스
  // ==========================================================================

  describe('에러 케이스', () => {
    it('should_return_error_when_file_not_found', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'nonexistent.txt');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      expect(result.isError).toBe(true);
      const text = extractText(result);
      expect(text).toContain('파일을 찾을 수 없습니다');
    });

    it('should_return_error_when_path_is_undefined', async () => {
      // Arrange - path가 없는 경우
      const args = {} as { path?: string };

      // Act
      const result = await executeSendFile(TEST_DIR, args);

      // Assert
      expect(result.isError).toBe(true);
      const text = extractText(result);
      expect(text).toContain('path');
    });

    it('should_return_error_when_path_is_empty_string', async () => {
      // Arrange
      const args = { path: '' };

      // Act
      const result = await executeSendFile(TEST_DIR, args);

      // Assert
      expect(result.isError).toBe(true);
    });
  });

  // ==========================================================================
  // 응답 포맷
  // ==========================================================================

  describe('MCP 응답 포맷', () => {
    it('should_return_content_array_with_text_type', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'notes.txt');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('should_return_parseable_json_in_success_response', async () => {
      // Arrange
      const filePath = path.join(TEST_DIR, 'notes.txt');

      // Act
      const result = await executeSendFile(TEST_DIR, { path: filePath });

      // Assert - JSON.parse가 에러 없이 동작해야 함
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should_return_content_array_with_text_type_on_error', async () => {
      // Arrange
      const args = {} as { path?: string };

      // Act
      const result = await executeSendFile(TEST_DIR, args);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content[0].type).toBe('text');
      expect(typeof result.content[0].text).toBe('string');
    });
  });
});
