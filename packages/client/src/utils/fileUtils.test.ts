/**
 * @file fileUtils.test.ts
 * @description 파일 처리 유틸리티 테스트
 *
 * 파일 처리 공통 로직 테스트.
 * FileList → AttachedImage[] 변환, 고유 ID 생성 등.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  processFiles,
  generateFileId,
  isValidFile,
  filterFilesByType,
  createAttachedImageFromFile,
} from './fileUtils';
import type { AttachedImage } from '../stores/imageUploadStore';

describe('fileUtils', () => {
  describe('generateFileId', () => {
    it('should_generate_unique_id', () => {
      // Act
      const id1 = generateFileId();
      const id2 = generateFileId();

      // Assert
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should_start_with_file_prefix', () => {
      // Act
      const id = generateFileId();

      // Assert
      expect(id).toMatch(/^file_/);
    });

    it('should_contain_timestamp', () => {
      // Arrange
      const beforeTime = Date.now();

      // Act
      const id = generateFileId();

      const afterTime = Date.now();

      // Assert - ID에 타임스탬프가 포함되어야 함
      // 형식: file_<timestamp>_<random>
      const parts = id.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(2);

      const timestamp = parseInt(parts[1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('isValidFile', () => {
    it('should_return_true_for_valid_file', () => {
      // Arrange
      const file = new File(['content'], 'test.png', { type: 'image/png' });

      // Act
      const result = isValidFile(file);

      // Assert
      expect(result).toBe(true);
    });

    it('should_return_false_for_empty_file', () => {
      // Arrange
      const emptyFile = new File([], 'empty.txt', { type: 'text/plain' });

      // Act
      const result = isValidFile(emptyFile);

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_false_for_null', () => {
      // Act
      const result = isValidFile(null as unknown as File);

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_false_for_undefined', () => {
      // Act
      const result = isValidFile(undefined as unknown as File);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('filterFilesByType', () => {
    it('should_filter_files_by_mime_type', () => {
      // Arrange
      const imageFile = new File(['img'], 'test.png', { type: 'image/png' });
      const textFile = new File(['txt'], 'test.txt', { type: 'text/plain' });
      const files = [imageFile, textFile];

      // Act
      const result = filterFilesByType(files, ['image/*']);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(imageFile);
    });

    it('should_support_multiple_accept_types', () => {
      // Arrange
      const pngFile = new File(['png'], 'test.png', { type: 'image/png' });
      const jpgFile = new File(['jpg'], 'test.jpg', { type: 'image/jpeg' });
      const pdfFile = new File(['pdf'], 'test.pdf', {
        type: 'application/pdf',
      });
      const textFile = new File(['txt'], 'test.txt', { type: 'text/plain' });
      const files = [pngFile, jpgFile, pdfFile, textFile];

      // Act
      const result = filterFilesByType(files, ['image/*', 'application/pdf']);

      // Assert
      expect(result).toHaveLength(3);
      expect(result).toContain(pngFile);
      expect(result).toContain(jpgFile);
      expect(result).toContain(pdfFile);
    });

    it('should_return_all_files_when_accept_is_empty', () => {
      // Arrange
      const imageFile = new File(['img'], 'test.png', { type: 'image/png' });
      const textFile = new File(['txt'], 'test.txt', { type: 'text/plain' });
      const files = [imageFile, textFile];

      // Act
      const result = filterFilesByType(files, []);

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should_support_wildcard_for_all_types', () => {
      // Arrange
      const imageFile = new File(['img'], 'test.png', { type: 'image/png' });
      const textFile = new File(['txt'], 'test.txt', { type: 'text/plain' });
      const files = [imageFile, textFile];

      // Act
      const result = filterFilesByType(files, ['*/*']);

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should_handle_empty_file_list', () => {
      // Act
      const result = filterFilesByType([], ['image/*']);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('createAttachedImageFromFile', () => {
    beforeEach(() => {
      // URL.createObjectURL 모킹
      global.URL.createObjectURL = vi.fn(
        () => 'blob:http://localhost/mock-url'
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should_create_AttachedImage_from_File', () => {
      // Arrange
      const file = new File(['image content'], 'photo.png', {
        type: 'image/png',
      });

      // Act
      const result = createAttachedImageFromFile(file);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toMatch(/^file_/);
      expect(result.fileName).toBe('photo.png');
      expect(result.file).toBe(file);
      expect(result.mimeType).toBe('image/png');
      expect(result.uri).toBe('blob:http://localhost/mock-url');
    });

    it('should_use_provided_id', () => {
      // Arrange
      const file = new File(['content'], 'test.png', { type: 'image/png' });
      const customId = 'custom-id-123';

      // Act
      const result = createAttachedImageFromFile(file, customId);

      // Assert
      expect(result.id).toBe(customId);
    });

    it('should_handle_file_without_type', () => {
      // Arrange - type이 빈 문자열인 파일
      const file = new File(['content'], 'unknown.bin', { type: '' });

      // Act
      const result = createAttachedImageFromFile(file);

      // Assert
      expect(result.mimeType).toBe('');
      expect(result.fileName).toBe('unknown.bin');
    });
  });

  describe('processFiles', () => {
    beforeEach(() => {
      global.URL.createObjectURL = vi.fn(
        () => 'blob:http://localhost/mock-url'
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should_convert_FileList_to_AttachedImage_array', () => {
      // Arrange
      const file1 = new File(['content1'], 'test1.png', { type: 'image/png' });
      const file2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });

      // FileList 모킹 (FileList는 직접 생성 불가)
      const fileList = {
        0: file1,
        1: file2,
        length: 2,
        item: (i: number) => (i === 0 ? file1 : file2),
        [Symbol.iterator]: function* () {
          yield file1;
          yield file2;
        },
      } as unknown as FileList;

      // Act
      const result = processFiles(fileList);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].fileName).toBe('test1.png');
      expect(result[0].file).toBe(file1);
      expect(result[0].mimeType).toBe('image/png');
      expect(result[1].fileName).toBe('test2.jpg');
      expect(result[1].file).toBe(file2);
      expect(result[1].mimeType).toBe('image/jpeg');
    });

    it('should_accept_File_array', () => {
      // Arrange
      const files = [
        new File(['content1'], 'a.png', { type: 'image/png' }),
        new File(['content2'], 'b.png', { type: 'image/png' }),
      ];

      // Act
      const result = processFiles(files);

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should_filter_out_empty_files', () => {
      // Arrange
      const validFile = new File(['content'], 'valid.png', {
        type: 'image/png',
      });
      const emptyFile = new File([], 'empty.png', { type: 'image/png' });

      // Act
      const result = processFiles([validFile, emptyFile]);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('valid.png');
    });

    it('should_generate_unique_ids_for_each_file', () => {
      // Arrange
      const files = [
        new File(['a'], 'a.png', { type: 'image/png' }),
        new File(['b'], 'b.png', { type: 'image/png' }),
        new File(['c'], 'c.png', { type: 'image/png' }),
      ];

      // Act
      const result = processFiles(files);

      // Assert
      const ids = result.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('should_handle_empty_input', () => {
      // Arrange
      const emptyFileList = {
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      } as unknown as FileList;

      // Act
      const result = processFiles(emptyFileList);

      // Assert
      expect(result).toEqual([]);
    });

    it('should_remove_duplicate_files_by_name_and_size', () => {
      // Arrange
      const file1 = new File(['same content'], 'duplicate.png', {
        type: 'image/png',
      });
      const file2 = new File(['same content'], 'duplicate.png', {
        type: 'image/png',
      });
      const file3 = new File(['different'], 'other.png', {
        type: 'image/png',
      });

      // Act
      const result = processFiles([file1, file2, file3]);

      // Assert - 이름과 크기가 같은 파일은 중복 제거
      expect(result).toHaveLength(2);
    });
  });

  describe('통합 시나리오', () => {
    beforeEach(() => {
      global.URL.createObjectURL = vi.fn(
        () => 'blob:http://localhost/mock-url'
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should_process_mixed_file_types', () => {
      // Arrange
      const imageFile = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
      const pdfFile = new File(['pdf'], 'doc.pdf', {
        type: 'application/pdf',
      });
      const textFile = new File(['txt'], 'note.txt', { type: 'text/plain' });

      // Act
      const result = processFiles([imageFile, pdfFile, textFile]);

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.mimeType)).toEqual([
        'image/jpeg',
        'application/pdf',
        'text/plain',
      ]);
    });

    it('should_handle_files_with_special_characters_in_name', () => {
      // Arrange
      const file = new File(['content'], '한글 파일명 (1).png', {
        type: 'image/png',
      });

      // Act
      const result = processFiles([file]);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('한글 파일명 (1).png');
    });

    it('should_handle_very_large_filename', () => {
      // Arrange
      const longName = 'a'.repeat(255) + '.png';
      const file = new File(['content'], longName, { type: 'image/png' });

      // Act
      const result = processFiles([file]);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe(longName);
    });
  });
});
