/**
 * @file google-auth.test.ts
 * @description Google OAuth 토큰 검증 테스트
 *
 * 테스트 대상: verifyGoogleToken
 * - 유효한 토큰 -> 이메일/이름/사진 반환
 * - 무효한 토큰 -> 에러
 * - 토큰 없음 -> 에러
 */

import { describe, it, expect } from 'vitest';
// 아직 구현되지 않은 모듈 import (의도된 실패)
import {
  verifyGoogleToken,
  type GoogleUserInfo,
} from '../src/google-auth.js';

describe('verifyGoogleToken', () => {
  // ============================================================================
  // 정상 케이스 (Happy Path)
  // ============================================================================

  describe('정상 케이스', () => {
    it('should_return_user_info_when_valid_token', async () => {
      // Arrange
      const validToken = 'valid-google-id-token';
      const clientId = 'test-client-id.apps.googleusercontent.com';

      // Act
      const result = await verifyGoogleToken(validToken, clientId);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBeDefined();
      expect(typeof result.email).toBe('string');
      expect(result.email).toContain('@');
    });

    it('should_return_name_when_token_contains_name', async () => {
      // Arrange
      const validToken = 'valid-google-id-token-with-name';
      const clientId = 'test-client-id.apps.googleusercontent.com';

      // Act
      const result = await verifyGoogleToken(validToken, clientId);

      // Assert
      expect(result.name).toBeDefined();
      expect(typeof result.name).toBe('string');
    });

    it('should_return_picture_when_token_contains_picture', async () => {
      // Arrange
      const validToken = 'valid-google-id-token-with-picture';
      const clientId = 'test-client-id.apps.googleusercontent.com';

      // Act
      const result = await verifyGoogleToken(validToken, clientId);

      // Assert
      expect(result.picture).toBeDefined();
      expect(typeof result.picture).toBe('string');
    });
  });

  // ============================================================================
  // 에러 케이스
  // ============================================================================

  describe('에러 케이스', () => {
    it('should_throw_error_when_token_is_invalid', async () => {
      // Arrange
      const invalidToken = 'invalid-token-format';
      const clientId = 'test-client-id.apps.googleusercontent.com';

      // Act & Assert
      await expect(verifyGoogleToken(invalidToken, clientId)).rejects.toThrow();
    });

    it('should_throw_error_when_token_is_expired', async () => {
      // Arrange
      const expiredToken = 'expired-google-id-token';
      const clientId = 'test-client-id.apps.googleusercontent.com';

      // Act & Assert
      await expect(verifyGoogleToken(expiredToken, clientId)).rejects.toThrow();
    });

    it('should_throw_error_when_client_id_mismatch', async () => {
      // Arrange
      const validToken = 'valid-google-id-token';
      const wrongClientId = 'wrong-client-id.apps.googleusercontent.com';

      // Act & Assert
      await expect(verifyGoogleToken(validToken, wrongClientId)).rejects.toThrow();
    });

    it('should_throw_error_when_token_is_empty', async () => {
      // Arrange
      const emptyToken = '';
      const clientId = 'test-client-id.apps.googleusercontent.com';

      // Act & Assert
      await expect(verifyGoogleToken(emptyToken, clientId)).rejects.toThrow();
    });

    it('should_throw_error_when_client_id_is_empty', async () => {
      // Arrange
      const validToken = 'valid-google-id-token';
      const emptyClientId = '';

      // Act & Assert
      await expect(verifyGoogleToken(validToken, emptyClientId)).rejects.toThrow();
    });
  });

  // ============================================================================
  // 엣지 케이스
  // ============================================================================

  describe('엣지 케이스', () => {
    it('should_handle_token_without_optional_fields', async () => {
      // Arrange - 이메일만 있고 이름/사진 없는 토큰
      const minimalToken = 'minimal-google-id-token';
      const clientId = 'test-client-id.apps.googleusercontent.com';

      // Act
      const result = await verifyGoogleToken(minimalToken, clientId);

      // Assert - 이메일은 필수, 나머지는 선택
      expect(result.email).toBeDefined();
      // name과 picture는 undefined일 수 있음
    });

    it('should_trim_whitespace_from_token', async () => {
      // Arrange
      const tokenWithWhitespace = '  valid-google-id-token  ';
      const clientId = 'test-client-id.apps.googleusercontent.com';

      // Act & Assert - 공백 제거 후 처리되어야 함
      // 구현에 따라 성공하거나 에러
      const result = await verifyGoogleToken(tokenWithWhitespace, clientId);
      expect(result.email).toBeDefined();
    });
  });
});

// ============================================================================
// GoogleUserInfo 타입 테스트
// ============================================================================

describe('GoogleUserInfo type', () => {
  it('should_have_required_email_field', () => {
    // Assert - 타입 체크 (컴파일 타임)
    const userInfo: GoogleUserInfo = {
      email: 'test@example.com',
    };

    expect(userInfo.email).toBe('test@example.com');
  });

  it('should_allow_optional_name_field', () => {
    // Assert - name은 선택
    const userInfo: GoogleUserInfo = {
      email: 'test@example.com',
      name: 'Test User',
    };

    expect(userInfo.name).toBe('Test User');
  });

  it('should_allow_optional_picture_field', () => {
    // Assert - picture은 선택
    const userInfo: GoogleUserInfo = {
      email: 'test@example.com',
      picture: 'https://example.com/photo.jpg',
    };

    expect(userInfo.picture).toBe('https://example.com/photo.jpg');
  });
});
