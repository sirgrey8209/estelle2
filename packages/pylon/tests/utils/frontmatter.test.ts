/**
 * Frontmatter 파서 테스트
 *
 * YAML frontmatter를 파싱하고 autorun 플래그를 확인하는 유틸리티 테스트.
 * - parseFrontmatter: YAML frontmatter 파싱
 * - hasAutorun: autorun: true 여부 확인
 *
 * @module tests/utils/frontmatter
 */

import { describe, it, expect } from 'vitest';
import { parseFrontmatter, hasAutorun } from '../../src/utils/frontmatter.js';

describe('Frontmatter', () => {
  describe('parseFrontmatter', () => {
    it('should_parse_yaml_frontmatter_when_valid', () => {
      // Arrange
      const content = `---
title: 테스트
autorun: true
---

# 문서 내용`;

      // Act
      const result = parseFrontmatter(content);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.title).toBe('테스트');
      expect(result?.autorun).toBe(true);
    });

    it('should_return_null_when_no_frontmatter', () => {
      // Arrange
      const content = `# 문서 제목

일반 마크다운 내용입니다.`;

      // Act
      const result = parseFrontmatter(content);

      // Assert
      expect(result).toBeNull();
    });

    it('should_return_null_when_empty_content', () => {
      // Arrange
      const content = '';

      // Act
      const result = parseFrontmatter(content);

      // Assert
      expect(result).toBeNull();
    });

    it('should_parse_boolean_values_correctly', () => {
      // Arrange
      const contentTrue = `---
autorun: true
---`;
      const contentFalse = `---
autorun: false
---`;

      // Act
      const resultTrue = parseFrontmatter(contentTrue);
      const resultFalse = parseFrontmatter(contentFalse);

      // Assert
      expect(resultTrue?.autorun).toBe(true);
      expect(resultFalse?.autorun).toBe(false);
    });

    it('should_parse_string_values_correctly', () => {
      // Arrange
      const content = `---
title: "작업 계획"
description: 간단한 설명
---`;

      // Act
      const result = parseFrontmatter(content);

      // Assert
      expect(result?.title).toBe('작업 계획');
      expect(result?.description).toBe('간단한 설명');
    });

    it('should_handle_multiline_frontmatter', () => {
      // Arrange
      const content = `---
title: 긴 제목
autorun: true
tags: 태그1
category: 카테고리
---

# 내용`;

      // Act
      const result = parseFrontmatter(content);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.title).toBe('긴 제목');
      expect(result?.autorun).toBe(true);
      expect(result?.tags).toBe('태그1');
      expect(result?.category).toBe('카테고리');
    });

    it('should_handle_frontmatter_with_special_characters', () => {
      // Arrange
      const content = `---
title: "특수 문자: 콜론, 따옴표 'test'"
path: C:/WorkSpace/project
---`;

      // Act
      const result = parseFrontmatter(content);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.title).toBe("특수 문자: 콜론, 따옴표 'test'");
      expect(result?.path).toBe('C:/WorkSpace/project');
    });

    it('should_return_null_when_frontmatter_not_at_start', () => {
      // Arrange
      const content = `# 제목

---
title: 잘못된 위치
---`;

      // Act
      const result = parseFrontmatter(content);

      // Assert
      expect(result).toBeNull();
    });

    it('should_return_null_when_frontmatter_not_closed', () => {
      // Arrange
      const content = `---
title: 닫히지 않음

# 내용`;

      // Act
      const result = parseFrontmatter(content);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('hasAutorun', () => {
    it('should_return_true_when_autorun_is_true', () => {
      // Arrange
      const content = `---
autorun: true
---

# 작업 계획`;

      // Act
      const result = hasAutorun(content);

      // Assert
      expect(result).toBe(true);
    });

    it('should_return_false_when_autorun_is_false', () => {
      // Arrange
      const content = `---
autorun: false
---

# 문서`;

      // Act
      const result = hasAutorun(content);

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_false_when_no_autorun_field', () => {
      // Arrange
      const content = `---
title: 제목만 있음
---

# 문서`;

      // Act
      const result = hasAutorun(content);

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_false_when_no_frontmatter', () => {
      // Arrange
      const content = `# 일반 마크다운

frontmatter가 없는 문서입니다.`;

      // Act
      const result = hasAutorun(content);

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_false_when_autorun_is_string_true', () => {
      // Arrange - 문자열 "true"는 boolean true가 아님
      const content = `---
autorun: "true"
---

# 문서`;

      // Act
      const result = hasAutorun(content);

      // Assert
      expect(result).toBe(false);
    });

    it('should_handle_whitespace_around_autorun', () => {
      // Arrange
      const content = `---
  autorun:   true
---

# 문서`;

      // Act
      const result = hasAutorun(content);

      // Assert
      expect(result).toBe(true);
    });

    it('should_return_false_when_empty_content', () => {
      // Arrange
      const content = '';

      // Act
      const result = hasAutorun(content);

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_false_when_autorun_is_number', () => {
      // Arrange
      const content = `---
autorun: 1
---

# 문서`;

      // Act
      const result = hasAutorun(content);

      // Assert
      expect(result).toBe(false);
    });
  });
});
