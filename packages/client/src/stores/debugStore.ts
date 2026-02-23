/**
 * @file debugStore.ts
 * @description 디버그 로그 스토어
 *
 * 모바일 PWA에서 콘솔 로그를 확인하기 위한 스토어입니다.
 */

import { create } from 'zustand';

/** 최대 로그 개수 */
const MAX_LOGS = 100;

/** 로그 레벨 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/** 로그 항목 */
export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  tag: string;
  message: string;
}

interface DebugState {
  logs: LogEntry[];
  nextId: number;
  enabled: boolean;
}

interface DebugActions {
  log: (tag: string, message: string, level?: LogLevel) => void;
  clear: () => void;
  setEnabled: (enabled: boolean) => void;
}

type DebugStore = DebugState & DebugActions;

export const useDebugStore = create<DebugStore>((set, get) => ({
  logs: [],
  nextId: 1,
  enabled: true,

  log: (tag, message, level = 'info') => {
    if (!get().enabled) return;

    const entry: LogEntry = {
      id: get().nextId,
      timestamp: Date.now(),
      level,
      tag,
      message,
    };

    set((state) => ({
      logs: [...state.logs.slice(-(MAX_LOGS - 1)), entry],
      nextId: state.nextId + 1,
    }));
  },

  clear: () => set({ logs: [], nextId: 1 }),

  setEnabled: (enabled) => set({ enabled }),
}));

/**
 * 글로벌 디버그 로그 함수 (편의용)
 */
export const debugLog = (tag: string, message: string, level?: LogLevel) => {
  useDebugStore.getState().log(tag, message, level);
};
