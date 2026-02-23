import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoginScreen } from './LoginScreen';
import { useAuthStore } from '../../stores/authStore';

// @react-oauth/google 모듈 mock
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess: (response: { credential: string }) => void }) => (
    <button
      data-testid="google-login-button"
      onClick={() => onSuccess({ credential: 'mock-credential' })}
    >
      Sign in with Google
    </button>
  ),
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// authStore mock
vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('미인증 상태', () => {
    it('should_show_login_button_when_not_authenticated', () => {
      // Arrange - 미인증 상태 설정
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        login: vi.fn(),
      } as unknown as ReturnType<typeof useAuthStore>);

      // Act
      render(<LoginScreen />);

      // Assert
      expect(screen.getByTestId('google-login-button')).toBeInTheDocument();
    });

    it('should_show_login_title_when_not_authenticated', () => {
      // Arrange
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        login: vi.fn(),
      } as unknown as ReturnType<typeof useAuthStore>);

      // Act
      render(<LoginScreen />);

      // Assert - 로그인 화면 제목/안내 메시지 확인
      expect(
        screen.getByText(/로그인|Sign in|Login/i)
      ).toBeInTheDocument();
    });
  });

  describe('로그인 플로우', () => {
    it('should_call_login_when_google_login_succeeds', async () => {
      // Arrange
      const mockLogin = vi.fn();
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        login: mockLogin,
      } as unknown as ReturnType<typeof useAuthStore>);

      render(<LoginScreen />);

      // Act - Google 로그인 버튼 클릭
      screen.getByTestId('google-login-button').click();

      // Assert
      expect(mockLogin).toHaveBeenCalled();
    });
  });

  describe('에러 처리', () => {
    it('should_show_error_message_when_login_fails', async () => {
      // Arrange
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        login: vi.fn(),
        error: 'Login failed',
      } as unknown as ReturnType<typeof useAuthStore>);

      // Act
      render(<LoginScreen />);

      // Assert
      // 에러 메시지가 표시되어야 함
      expect(screen.queryByText(/error|failed|실패/i)).toBeInTheDocument();
    });
  });

  describe('로딩 상태', () => {
    it('should_show_loading_indicator_when_logging_in', () => {
      // Arrange
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        login: vi.fn(),
      } as unknown as ReturnType<typeof useAuthStore>);

      // Act
      render(<LoginScreen />);

      // Assert
      // 로딩 인디케이터가 표시되어야 함
      expect(
        screen.queryByTestId('loading-indicator') ||
        screen.queryByRole('progressbar') ||
        screen.queryByText(/로딩|loading/i)
      ).toBeInTheDocument();
    });
  });

  describe('UI 요소', () => {
    it('should_render_estelle_branding', () => {
      // Arrange
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        login: vi.fn(),
      } as unknown as ReturnType<typeof useAuthStore>);

      // Act
      render(<LoginScreen />);

      // Assert - Estelle 브랜딩 확인
      expect(
        screen.queryByText(/Estelle/i) ||
        screen.queryByAltText(/Estelle/i)
      ).toBeInTheDocument();
    });
  });
});
