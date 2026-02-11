import { create } from 'zustand';
import type { AccountType, AccountStatusPayload } from '@estelle/core';

/**
 * 설정 상태 인터페이스
 */
export interface SettingsState {
  /** 현재 활성 계정 */
  currentAccount: AccountType | null;

  /** 계정 구독 타입 (team, max 등) */
  subscriptionType: string | null;

  /** 계정 전환 중 */
  isAccountSwitching: boolean;

  // Actions
  setAccountStatus: (status: AccountStatusPayload) => void;
  setAccountSwitching: (switching: boolean) => void;
  reset: () => void;
}

/**
 * 초기 상태
 */
const initialState = {
  currentAccount: null as AccountType | null,
  subscriptionType: null as string | null,
  isAccountSwitching: false,
};

/**
 * 설정 스토어
 *
 * 계정 상태를 관리합니다.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  ...initialState,

  setAccountStatus: (status) => {
    set({
      currentAccount: status.current,
      subscriptionType: status.subscriptionType || null,
      isAccountSwitching: false,
    });
  },

  setAccountSwitching: (switching) => {
    set({ isAccountSwitching: switching });
  },

  reset: () => {
    set({ ...initialState });
  },
}));
