import { create } from 'zustand';

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

  // Actions
  setConnected: (connected: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setDeviceId: (deviceId: string | null) => void;
  reset: () => void;
}

/**
 * 초기 상태
 */
const initialState = {
  isConnected: false,
  isAuthenticated: false,
  deviceId: null,
};

/**
 * Relay 연결 상태 관리 스토어
 *
 * WebSocket 연결, 인증 상태를 관리합니다.
 */
export const useRelayStore = create<RelayState>((set) => ({
  ...initialState,

  setConnected: (connected) => {
    if (connected) {
      set({ isConnected: true });
    } else {
      // 연결 해제 시 모든 상태 초기화
      set({
        isConnected: false,
        isAuthenticated: false,
        deviceId: null,
      });
    }
  },

  setAuthenticated: (authenticated) => {
    set({ isAuthenticated: authenticated });
  },

  setDeviceId: (deviceId) => {
    set({ deviceId });
  },

  reset: () => {
    set({ ...initialState });
  },
}));
