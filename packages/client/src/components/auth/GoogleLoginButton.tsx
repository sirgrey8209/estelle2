import { GoogleLogin } from '@react-oauth/google';

/**
 * GoogleLoginButton 컴포넌트 Props
 */
export interface GoogleLoginButtonProps {
  /** 로그인 성공 시 호출되는 콜백 (credential: Google ID Token) */
  onSuccess: (credential: string) => void;
  /** 로그인 실패 시 호출되는 콜백 */
  onError: () => void;
  /** 버튼 비활성화 여부 */
  disabled?: boolean;
}

/**
 * Google 로그인 버튼 컴포넌트
 *
 * @react-oauth/google의 GoogleLogin을 래핑합니다.
 */
export function GoogleLoginButton({
  onSuccess,
  onError,
  disabled,
}: GoogleLoginButtonProps) {
  return (
    <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <GoogleLogin
        onSuccess={(response) => {
          if (response.credential) {
            onSuccess(response.credential);
          }
        }}
        onError={onError}
      />
    </div>
  );
}
