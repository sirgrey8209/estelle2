import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 사용자 정보 인터페이스
 */
export interface UserInfo {
  email: string;
  name: string;
  picture: string | null;
}

/**
 * 로그인 자격 증명 인터페이스
 */
export interface LoginCredential {
  idToken: string;
  user: UserInfo;
}

/**
 * 인증 상태 인터페이스
 */
export interface AuthState {
  /** 인증 완료 여부 */
  isAuthenticated: boolean;

  /** Google ID 토큰 */
  idToken: string | null;

  /** 사용자 정보 */
  user: UserInfo | null;

  /** 에러 메시지 */
  error: string | null;

  /** 로딩 상태 */
  isLoading: boolean;

  // Actions
  login: (credential: LoginCredential) => void;
  logout: () => void;
  getIdToken: () => string | null;
  reset: () => void;
}

/**
 * Google OAuth가 설정되어 있는지 확인
 * VITE_GOOGLE_CLIENT_ID가 없거나 플레이스홀더면 false
 */
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const isGoogleAuthEnabled = GOOGLE_CLIENT_ID !== '' && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID';

/**
 * 초기 상태
 * Google OAuth가 비활성화된 경우 자동으로 인증된 상태로 시작
 */
const initialState = {
  isAuthenticated: !isGoogleAuthEnabled, // Google OAuth 없으면 자동 인증
  idToken: null,
  user: isGoogleAuthEnabled ? null : { email: 'local@localhost', name: 'Local User', picture: null },
  error: null,
  isLoading: false,
};

/**
 * 인증 상태 관리 스토어
 *
 * Google OAuth 로그인 상태와 사용자 정보를 관리합니다.
 * localStorage에 저장되어 새로고침 후에도 유지됩니다.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: (credential: LoginCredential) => {
        set({
          isAuthenticated: true,
          idToken: credential.idToken,
          user: credential.user,
          error: null,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          isAuthenticated: false,
          idToken: null,
          user: null,
          error: null,
          isLoading: false,
        });
      },

      getIdToken: () => {
        return get().idToken;
      },

      reset: () => {
        set({ ...initialState });
      },
    }),
    {
      name: 'estelle-auth', // localStorage 키 이름
      partialize: (state) => ({
        // 저장할 필드만 선택 (error, isLoading은 제외)
        isAuthenticated: state.isAuthenticated,
        idToken: state.idToken,
        user: state.user,
      }),
    }
  )
);
