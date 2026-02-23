import { GoogleOAuthProvider } from '@react-oauth/google';
import { GoogleLoginButton } from './GoogleLoginButton';
import { useAuthStore } from '../../stores/authStore';

/**
 * Google OAuth Client ID
 * 실제 사용 시 환경변수로 대체해야 합니다.
 */
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';

/**
 * ID 토큰에서 사용자 정보를 추출합니다.
 * 실제 구현에서는 JWT를 디코딩하여 사용자 정보를 추출합니다.
 */
const PLACEHOLDER_USER = {
  email: '',
  name: '',
  picture: null,
} as const;

/**
 * 로그인 화면 컴포넌트
 *
 * 미인증 사용자에게 Google 로그인을 제공합니다.
 */
export function LoginScreen() {
  const { login, error, isLoading } = useAuthStore();

  const handleLoginSuccess = (credential: string) => {
    login({
      idToken: credential,
      user: PLACEHOLDER_USER,
    });
  };

  const handleLoginError = () => {
    // 에러 처리는 상위 컴포넌트에서 담당
    console.error('Google login failed');
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="p-8 bg-white rounded-lg shadow-md">
          {/* Estelle 브랜딩 */}
          <h1 className="text-2xl font-bold text-center mb-6">Estelle</h1>

          {/* 로딩 상태 */}
          {isLoading && (
            <div data-testid="loading-indicator" className="text-center mb-4">
              <span className="text-gray-500">Loading...</span>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="text-red-500 text-center mb-4">
              Login failed: {error}
            </div>
          )}

          {/* Google 로그인 버튼 */}
          <div className="flex justify-center">
            <GoogleLoginButton
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
