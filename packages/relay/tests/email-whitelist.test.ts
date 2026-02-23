/**
 * @file email-whitelist.test.ts
 * @description 이메일 화이트리스트 테스트
 *
 * 테스트 대상: isEmailAllowed, loadAllowedEmails
 * - 허용된 이메일 -> true
 * - 미허용 이메일 -> false
 * - 파일 로드 에러 처리
 */

import { describe, it, expect } from 'vitest';
// 아직 구현되지 않은 모듈 import (의도된 실패)
import {
  isEmailAllowed,
  loadAllowedEmails,
  type EmailWhitelist,
} from '../src/email-whitelist.js';

describe('isEmailAllowed', () => {
  // ============================================================================
  // 정상 케이스 (Happy Path)
  // ============================================================================

  describe('정상 케이스', () => {
    it('should_return_true_when_email_is_in_whitelist', () => {
      // Arrange
      const whitelist: EmailWhitelist = ['allowed@example.com', 'admin@example.com'];
      const email = 'allowed@example.com';

      // Act
      const result = isEmailAllowed(email, whitelist);

      // Assert
      expect(result).toBe(true);
    });

    it('should_return_false_when_email_is_not_in_whitelist', () => {
      // Arrange
      const whitelist: EmailWhitelist = ['allowed@example.com', 'admin@example.com'];
      const email = 'notallowed@example.com';

      // Act
      const result = isEmailAllowed(email, whitelist);

      // Assert
      expect(result).toBe(false);
    });

    it('should_handle_multiple_allowed_emails', () => {
      // Arrange
      const whitelist: EmailWhitelist = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
      ];

      // Act & Assert
      expect(isEmailAllowed('user1@example.com', whitelist)).toBe(true);
      expect(isEmailAllowed('user2@example.com', whitelist)).toBe(true);
      expect(isEmailAllowed('user3@example.com', whitelist)).toBe(true);
    });
  });

  // ============================================================================
  // 엣지 케이스
  // ============================================================================

  describe('엣지 케이스', () => {
    it('should_return_false_when_whitelist_is_empty', () => {
      // Arrange
      const whitelist: EmailWhitelist = [];
      const email = 'any@example.com';

      // Act
      const result = isEmailAllowed(email, whitelist);

      // Assert
      expect(result).toBe(false);
    });

    it('should_be_case_insensitive', () => {
      // Arrange
      const whitelist: EmailWhitelist = ['User@Example.com'];
      const emailLower = 'user@example.com';
      const emailUpper = 'USER@EXAMPLE.COM';

      // Act & Assert - 이메일은 대소문자 구분 없이 비교해야 함
      expect(isEmailAllowed(emailLower, whitelist)).toBe(true);
      expect(isEmailAllowed(emailUpper, whitelist)).toBe(true);
    });

    it('should_handle_email_with_leading_trailing_spaces', () => {
      // Arrange
      const whitelist: EmailWhitelist = ['user@example.com'];
      const emailWithSpaces = '  user@example.com  ';

      // Act
      const result = isEmailAllowed(emailWithSpaces, whitelist);

      // Assert - 공백 제거 후 비교
      expect(result).toBe(true);
    });

    it('should_return_false_when_email_is_empty', () => {
      // Arrange
      const whitelist: EmailWhitelist = ['user@example.com'];
      const emptyEmail = '';

      // Act
      const result = isEmailAllowed(emptyEmail, whitelist);

      // Assert
      expect(result).toBe(false);
    });

    it('should_handle_single_email_whitelist', () => {
      // Arrange
      const whitelist: EmailWhitelist = ['solo@example.com'];

      // Act & Assert
      expect(isEmailAllowed('solo@example.com', whitelist)).toBe(true);
      expect(isEmailAllowed('other@example.com', whitelist)).toBe(false);
    });

    it('should_not_allow_partial_match', () => {
      // Arrange
      const whitelist: EmailWhitelist = ['admin@example.com'];

      // Act & Assert - 부분 일치는 허용하지 않음
      expect(isEmailAllowed('admin@example.com.hacker.com', whitelist)).toBe(false);
      expect(isEmailAllowed('admi@example.com', whitelist)).toBe(false);
      expect(isEmailAllowed('admin@example.co', whitelist)).toBe(false);
    });
  });

  // ============================================================================
  // 에러 케이스
  // ============================================================================

  describe('에러 케이스', () => {
    it('should_handle_null_email_gracefully', () => {
      // Arrange
      const whitelist: EmailWhitelist = ['user@example.com'];

      // Act & Assert
      expect(isEmailAllowed(null as unknown as string, whitelist)).toBe(false);
    });

    it('should_handle_undefined_email_gracefully', () => {
      // Arrange
      const whitelist: EmailWhitelist = ['user@example.com'];

      // Act & Assert
      expect(isEmailAllowed(undefined as unknown as string, whitelist)).toBe(false);
    });
  });
});

// ============================================================================
// loadAllowedEmails
// ============================================================================

describe('loadAllowedEmails', () => {
  describe('정상 케이스', () => {
    it('should_load_emails_from_json_file', async () => {
      // Arrange
      const filePath = 'data/allowed-emails.json';

      // Act
      const result = await loadAllowedEmails(filePath);

      // Assert
      expect(Array.isArray(result)).toBe(true);
    });

    it('should_return_array_of_strings', async () => {
      // Arrange
      const filePath = 'data/allowed-emails.json';

      // Act
      const result = await loadAllowedEmails(filePath);

      // Assert
      result.forEach((email) => {
        expect(typeof email).toBe('string');
      });
    });
  });

  describe('에러 케이스', () => {
    it('should_throw_when_file_not_found', async () => {
      // Arrange
      const nonExistentPath = 'data/non-existent-file.json';

      // Act & Assert
      await expect(loadAllowedEmails(nonExistentPath)).rejects.toThrow();
    });

    it('should_throw_when_file_is_invalid_json', async () => {
      // Arrange
      const invalidJsonPath = 'data/invalid.json';

      // Act & Assert
      await expect(loadAllowedEmails(invalidJsonPath)).rejects.toThrow();
    });

    it('should_throw_when_json_is_not_array', async () => {
      // Arrange - JSON이 배열이 아닌 경우 (예: {"emails": [...]})
      const objectJsonPath = 'data/object-format.json';

      // Act & Assert
      await expect(loadAllowedEmails(objectJsonPath)).rejects.toThrow();
    });
  });

  describe('엣지 케이스', () => {
    it('should_return_empty_array_when_file_contains_empty_array', async () => {
      // Arrange
      const emptyArrayPath = 'data/empty-allowed-emails.json';

      // Act
      const result = await loadAllowedEmails(emptyArrayPath);

      // Assert
      expect(result).toEqual([]);
    });
  });
});

// ============================================================================
// EmailWhitelist 타입 테스트
// ============================================================================

describe('EmailWhitelist type', () => {
  it('should_be_array_of_strings', () => {
    // Arrange
    const whitelist: EmailWhitelist = [
      'user1@example.com',
      'user2@example.com',
    ];

    // Assert
    expect(Array.isArray(whitelist)).toBe(true);
    expect(whitelist).toHaveLength(2);
  });

  it('should_allow_empty_array', () => {
    // Arrange
    const whitelist: EmailWhitelist = [];

    // Assert
    expect(whitelist).toEqual([]);
  });
});
