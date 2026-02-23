import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    // 각 테스트 전에 스토어 초기화
    useAuthStore.getState().reset();
  });

  describe('초기 상태', () => {
    it('should_have_unauthenticated_initial_state', () => {
      const state = useAuthStore.getState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.idToken).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  describe('로그인 성공', () => {
    it('should_update_state_when_login_succeeds', () => {
      // Arrange
      const credential = {
        idToken: 'test-id-token-12345',
        user: {
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/photo.jpg',
        },
      };

      // Act
      useAuthStore.getState().login(credential);

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.idToken).toBe('test-id-token-12345');
      expect(state.user).toEqual({
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
      });
    });

    it('should_store_idToken_when_login_succeeds', () => {
      // Arrange
      const credential = {
        idToken: 'jwt-token-abc123',
        user: {
          email: 'user@test.com',
          name: 'User',
          picture: null,
        },
      };

      // Act
      useAuthStore.getState().login(credential);

      // Assert
      expect(useAuthStore.getState().idToken).toBe('jwt-token-abc123');
    });
  });

  describe('로그아웃', () => {
    it('should_reset_state_when_logout', () => {
      // Arrange - 먼저 로그인 상태로 설정
      useAuthStore.getState().login({
        idToken: 'test-token',
        user: {
          email: 'test@example.com',
          name: 'Test User',
          picture: null,
        },
      });

      // Act
      useAuthStore.getState().logout();

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.idToken).toBeNull();
      expect(state.user).toBeNull();
    });

    it('should_clear_idToken_when_logout', () => {
      // Arrange
      useAuthStore.getState().login({
        idToken: 'some-token',
        user: { email: 'a@b.com', name: 'A', picture: null },
      });

      // Act
      useAuthStore.getState().logout();

      // Assert
      expect(useAuthStore.getState().idToken).toBeNull();
    });
  });

  describe('getIdToken', () => {
    it('should_return_idToken_when_authenticated', () => {
      // Arrange
      useAuthStore.getState().login({
        idToken: 'my-id-token',
        user: { email: 'test@test.com', name: 'Test', picture: null },
      });

      // Act
      const idToken = useAuthStore.getState().getIdToken();

      // Assert
      expect(idToken).toBe('my-id-token');
    });

    it('should_return_null_when_not_authenticated', () => {
      // Act
      const idToken = useAuthStore.getState().getIdToken();

      // Assert
      expect(idToken).toBeNull();
    });
  });

  describe('reset', () => {
    it('should_reset_all_state_to_initial_values', () => {
      // Arrange
      useAuthStore.getState().login({
        idToken: 'token-to-clear',
        user: { email: 'clear@test.com', name: 'Clear', picture: 'http://pic.jpg' },
      });

      // Act
      useAuthStore.getState().reset();

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.idToken).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  describe('엣지 케이스', () => {
    it('should_handle_empty_user_info', () => {
      // Arrange
      const credential = {
        idToken: 'token-with-minimal-user',
        user: {
          email: '',
          name: '',
          picture: null,
        },
      };

      // Act
      useAuthStore.getState().login(credential);

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('');
      expect(state.user?.name).toBe('');
    });

    it('should_handle_multiple_logins', () => {
      // Arrange - 첫 번째 로그인
      useAuthStore.getState().login({
        idToken: 'first-token',
        user: { email: 'first@test.com', name: 'First', picture: null },
      });

      // Act - 두 번째 로그인 (다른 계정)
      useAuthStore.getState().login({
        idToken: 'second-token',
        user: { email: 'second@test.com', name: 'Second', picture: null },
      });

      // Assert - 최신 정보로 업데이트
      const state = useAuthStore.getState();
      expect(state.idToken).toBe('second-token');
      expect(state.user?.email).toBe('second@test.com');
    });
  });
});
