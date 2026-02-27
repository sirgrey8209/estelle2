/**
 * Autorun 문서 탐지 테스트
 *
 * 연결 문서들 중 autorun: true인 문서를 찾는 유틸리티 테스트.
 * - findAutorunDoc: 문서 목록에서 autorun 문서 탐색
 *
 * @module tests/utils/autorun-detector
 */

import { describe, it, expect } from 'vitest';
import { findAutorunDoc } from '../../src/utils/autorun-detector.js';

/**
 * 테스트용 모킹 함수 생성
 * 파일 경로 → 내용 매핑을 받아 readFile 함수 반환
 */
const createMockReadFile = (files: Record<string, string>) => {
  return (path: string): string | null => files[path] ?? null;
};

describe('AutorunDetector', () => {
  describe('findAutorunDoc', () => {
    it('should_return_first_autorun_doc_when_found', () => {
      // Arrange
      const files: Record<string, string> = {
        '/docs/first.md': `---
title: 첫 번째 문서
---

# 첫 번째`,
        '/docs/second.md': `---
title: 두 번째 문서
autorun: true
---

# 두 번째`,
        '/docs/third.md': `---
title: 세 번째 문서
---

# 세 번째`,
      };
      const linkedDocs = ['/docs/first.md', '/docs/second.md', '/docs/third.md'];
      const readFile = createMockReadFile(files);

      // Act
      const result = findAutorunDoc(linkedDocs, readFile);

      // Assert
      expect(result).toBe('/docs/second.md');
    });

    it('should_return_undefined_when_no_autorun_doc', () => {
      // Arrange
      const files: Record<string, string> = {
        '/docs/first.md': `---
title: 첫 번째
---

# 내용`,
        '/docs/second.md': `---
title: 두 번째
autorun: false
---

# 내용`,
      };
      const linkedDocs = ['/docs/first.md', '/docs/second.md'];
      const readFile = createMockReadFile(files);

      // Act
      const result = findAutorunDoc(linkedDocs, readFile);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should_return_undefined_when_empty_list', () => {
      // Arrange
      const linkedDocs: string[] = [];
      const readFile = createMockReadFile({});

      // Act
      const result = findAutorunDoc(linkedDocs, readFile);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should_skip_files_that_cannot_be_read', () => {
      // Arrange - 두 번째 파일만 읽을 수 있음
      const files: Record<string, string> = {
        '/docs/second.md': `---
autorun: true
---

# 내용`,
      };
      const linkedDocs = ['/docs/first.md', '/docs/second.md', '/docs/third.md'];
      const readFile = createMockReadFile(files);

      // Act
      const result = findAutorunDoc(linkedDocs, readFile);

      // Assert
      expect(result).toBe('/docs/second.md');
    });

    it('should_handle_single_doc_with_autorun', () => {
      // Arrange
      const files: Record<string, string> = {
        '/docs/only.md': `---
autorun: true
---

# 단일 문서`,
      };
      const linkedDocs = ['/docs/only.md'];
      const readFile = createMockReadFile(files);

      // Act
      const result = findAutorunDoc(linkedDocs, readFile);

      // Assert
      expect(result).toBe('/docs/only.md');
    });

    it('should_handle_single_doc_without_autorun', () => {
      // Arrange
      const files: Record<string, string> = {
        '/docs/only.md': `---
title: 단일 문서
---

# 내용`,
      };
      const linkedDocs = ['/docs/only.md'];
      const readFile = createMockReadFile(files);

      // Act
      const result = findAutorunDoc(linkedDocs, readFile);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should_return_first_when_multiple_autorun_docs', () => {
      // Arrange - 두 번째와 세 번째 모두 autorun
      const files: Record<string, string> = {
        '/docs/first.md': `---
title: 첫 번째
---

# 내용`,
        '/docs/second.md': `---
autorun: true
title: 두 번째
---

# 두 번째`,
        '/docs/third.md': `---
autorun: true
title: 세 번째
---

# 세 번째`,
      };
      const linkedDocs = ['/docs/first.md', '/docs/second.md', '/docs/third.md'];
      const readFile = createMockReadFile(files);

      // Act
      const result = findAutorunDoc(linkedDocs, readFile);

      // Assert
      expect(result).toBe('/docs/second.md');
    });

    it('should_handle_file_without_frontmatter', () => {
      // Arrange
      const files: Record<string, string> = {
        '/docs/no-frontmatter.md': `# 일반 마크다운

frontmatter 없는 문서입니다.`,
        '/docs/with-autorun.md': `---
autorun: true
---

# 내용`,
      };
      const linkedDocs = ['/docs/no-frontmatter.md', '/docs/with-autorun.md'];
      const readFile = createMockReadFile(files);

      // Act
      const result = findAutorunDoc(linkedDocs, readFile);

      // Assert
      expect(result).toBe('/docs/with-autorun.md');
    });

    it('should_handle_autorun_false', () => {
      // Arrange - autorun: false는 무시
      const files: Record<string, string> = {
        '/docs/false-autorun.md': `---
autorun: false
---

# 내용`,
        '/docs/true-autorun.md': `---
autorun: true
---

# 내용`,
      };
      const linkedDocs = ['/docs/false-autorun.md', '/docs/true-autorun.md'];
      const readFile = createMockReadFile(files);

      // Act
      const result = findAutorunDoc(linkedDocs, readFile);

      // Assert
      expect(result).toBe('/docs/true-autorun.md');
    });
  });
});
