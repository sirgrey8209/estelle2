import { create } from 'zustand';

/**
 * 로딩 상태 타입
 */
export type LoadingState = 'connecting' | 'loadingDesks' | 'ready';

/**
 * Relay 연결 상태 인터페이스
 */
export interface RelayState {
  /** WebSocket 연결 여부 */
  isConnected: boolean;

  /** 인증 완료 여부 */
  isAuthenticated: boolean;

  /** Relay에서 발급받은 디바이스 ID */
  deviceId: string | null;

  /** 데스크 목록 로드 완료 여부 */
  desksLoaded: boolean;

  /** 현재 로딩 상태 (계산된 값) */
  loadingState: LoadingState;

  // Actions
  setConnected: (connected: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setDeviceId: (deviceId: string | null) => void;
  setDesksLoaded: (loaded: boolean) => void;
  reset: () => void;
}

/**
 * 초기 상태
 */
const initialState = {
  isConnected: false,
  isAuthenticated: false,
  deviceId: null,
  desksLoaded: false,
};

/**
 * 로딩 상태 계산
 */
function computeLoadingState(
  isConnected: boolean,
  isAuthenticated: boolean,
  desksLoaded: boolean
): LoadingState {
  if (!isConnected || !isAuthenticated) {
    return 'connecting';
  }
  if (!desksLoaded) {
    return 'loadingDesks';
  }
  return 'ready';
}

/**
 * Relay 연결 상태 관리 스토어
 *
 * WebSocket 연결, 인증, 로딩 상태를 관리합니다.
 */
export const useRelayStore = create<RelayState>((set, get) => ({
  ...initialState,
  loadingState: 'connecting',

  setConnected: (connected) => {
    if (connected) {
      set({ isConnected: true });
    } else {
      // 연결 해제 시 모든 상태 초기화
      set({
        isConnected: false,
        isAuthenticated: false,
        deviceId: null,
        desksLoaded: false,
        loadingState: 'connecting',
      });
    }
    // 로딩 상태 재계산
    const state = get();
    set({
      loadingState: computeLoadingState(
        connected ? true : false,
        connected ? state.isAuthenticated : false,
        connected ? state.desksLoaded : false
      ),
    });
  },

  setAuthenticated: (authenticated) => {
    set({ isAuthenticated: authenticated });
    const state = get();
    set({
      loadingState: computeLoadingState(
        state.isConnected,
        authenticated,
        state.desksLoaded
      ),
    });
  },

  setDeviceId: (deviceId) => {
    set({ deviceId });
  },

  setDesksLoaded: (loaded) => {
    set({ desksLoaded: loaded });
    const state = get();
    set({
      loadingState: computeLoadingState(
        state.isConnected,
        state.isAuthenticated,
        loaded
      ),
    });
  },

  reset: () => {
    set({
      ...initialState,
      loadingState: 'connecting',
    });
  },
}));
