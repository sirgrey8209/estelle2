import { create } from 'zustand';
import type { AccountType, AccountStatusPayload } from '@estelle/core';
import { CLIENT_VERSION } from '../version';

/**
 * 설정 상태 인터페이스
 */
export interface SettingsState {
  /** 현재 활성 계정 (UI 표시용, 마지막으로 업데이트된 파일런의 계정) */
  currentAccount: AccountType | null;

  /** 계정 구독 타입 (team, max 등) */
  subscriptionType: string | null;

  /** 파일런별 계정 정보 */
  accountByPylon: Map<number, AccountType>;

  /** 계정 전환 중 */
  isAccountSwitching: boolean;

  /** 클라이언트 버전 */
  clientVersion: string;

  /** 릴레이 버전 */
  relayVersion: string | null;

  /** Pylon 버전들 (pylonId -> version) */
  pylonVersions: Record<number, string>;

  /** 채팅 화면이 보이는지 (모바일에서 대화 탭인지) */
  isChatVisible: boolean;

  // Actions
  setAccountStatus: (status: AccountStatusPayload) => void;
  /** 파일런별 계정 설정 (account 변경 감지는 호출자가 처리) */
  setPylonAccount: (pylonId: number, account: AccountType) => void;
  /** 파일런의 이전 계정 조회 */
  getPylonAccount: (pylonId: number) => AccountType | null;
  setAccountSwitching: (switching: boolean) => void;
  setRelayVersion: (version: string) => void;
  setPylonVersions: (versions: Record<number, string>) => void;
  setChatVisible: (visible: boolean) => void;
  reset: () => void;
}

/**
 * 초기 상태
 */
const initialState = {
  currentAccount: null as AccountType | null,
  subscriptionType: null as string | null,
  accountByPylon: new Map<number, AccountType>(),
  isAccountSwitching: false,
  clientVersion: CLIENT_VERSION,
  relayVersion: null as string | null,
  pylonVersions: {} as Record<number, string>,
  isChatVisible: true,  // 데스크탑에서는 항상 true, 모바일에서만 동기화
};

/**
 * 설정 스토어
 *
 * 계정 상태를 관리합니다.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initialState,

  setAccountStatus: (status) => {
    set({
      currentAccount: status.current,
      subscriptionType: status.subscriptionType || null,
      isAccountSwitching: false,
    });
  },

  setPylonAccount: (pylonId, account) => {
    const newMap = new Map(get().accountByPylon);
    newMap.set(pylonId, account);
    set({ accountByPylon: newMap });
  },

  getPylonAccount: (pylonId) => {
    return get().accountByPylon.get(pylonId) ?? null;
  },

  setAccountSwitching: (switching) => {
    set({ isAccountSwitching: switching });
  },

  setRelayVersion: (version) => {
    set({ relayVersion: version });
  },

  setPylonVersions: (versions) => {
    set({ pylonVersions: versions });
  },

  setChatVisible: (visible) => {
    set({ isChatVisible: visible });
  },

  reset: () => {
    set({ ...initialState, accountByPylon: new Map() });
  },
}));
