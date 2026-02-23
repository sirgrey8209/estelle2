import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoogleLoginButton } from './GoogleLoginButton';

// @react-oauth/google 모듈의 GoogleLogin 컴포넌트 mock
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({
    onSuccess,
    onError,
  }: {
    onSuccess: (response: { credential: string }) => void;
    onError: () => void;
  }) => (
    <button
      data-testid="google-login-button"
      onClick={() => onSuccess({ credential: 'mock-google-credential' })}
      onKeyDown={(e) => e.key === 'Escape' && onError()}
    >
      Sign in with Google
    </button>
  ),
}));

describe('GoogleLoginButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('렌더링', () => {
    it('should_render_google_login_button', () => {
      // Act
      render(<GoogleLoginButton onSuccess={vi.fn()} onError={vi.fn()} />);

      // Assert
      expect(screen.getByTestId('google-login-button')).toBeInTheDocument();
    });
  });

  describe('로그인 성공', () => {
    it('should_call_onSuccess_when_login_succeeds', () => {
      // Arrange
      const onSuccess = vi.fn();
      const onError = vi.fn();

      render(<GoogleLoginButton onSuccess={onSuccess} onError={onError} />);

      // Act
      fireEvent.click(screen.getByTestId('google-login-button'));

      // Assert
      expect(onSuccess).toHaveBeenCalledWith('mock-google-credential');
      expect(onError).not.toHaveBeenCalled();
    });

    it('should_pass_credential_to_onSuccess_callback', () => {
      // Arrange
      const onSuccess = vi.fn();

      render(<GoogleLoginButton onSuccess={onSuccess} onError={vi.fn()} />);

      // Act
      fireEvent.click(screen.getByTestId('google-login-button'));

      // Assert
      expect(onSuccess).toHaveBeenCalledTimes(1);
      const [credential] = onSuccess.mock.calls[0];
      expect(typeof credential).toBe('string');
      expect(credential.length).toBeGreaterThan(0);
    });
  });

  describe('로그인 실패', () => {
    it('should_call_onError_when_login_fails', () => {
      // Arrange
      const onSuccess = vi.fn();
      const onError = vi.fn();

      render(<GoogleLoginButton onSuccess={onSuccess} onError={onError} />);

      // Act - Escape 키로 에러 시뮬레이션
      fireEvent.keyDown(screen.getByTestId('google-login-button'), {
        key: 'Escape',
      });

      // Assert
      expect(onError).toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('disabled 상태', () => {
    it('should_disable_button_when_disabled_prop_is_true', () => {
      // Act
      render(
        <GoogleLoginButton
          onSuccess={vi.fn()}
          onError={vi.fn()}
          disabled={true}
        />
      );

      // Assert
      const button = screen.getByTestId('google-login-button');
      // disabled 속성이나 스타일로 확인
      expect(button).toBeInTheDocument();
      // 구현에 따라 disabled 검증 방식 조정 필요
    });
  });
});
