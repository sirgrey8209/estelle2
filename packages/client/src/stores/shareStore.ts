import { create } from 'zustand';
import type { StoreMessage } from '@estelle/core';

/**
 * Share 상태 인터페이스
 *
 * 공유 링크를 통한 대화 뷰어의 상태를 관리합니다.
 */
export interface ShareState {
  /** 공유 ID (URL에서 추출) */
  shareId: string | null;

  /** 대화 고유 식별자 */
  conversationId: number | null;

  /** 대화 메시지 목록 */
  messages: StoreMessage[];

  /** WebSocket 연결 여부 */
  isConnected: boolean;

  /** 인증 완료 여부 */
  isAuthenticated: boolean;

  /** 에러 메시지 */
  error: string | null;

  // Actions
  setShareId: (shareId: string) => void;
  setConversationId: (conversationId: number | null) => void;
  setConnected: (connected: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setError: (error: string | null) => void;
  addMessage: (message: StoreMessage) => void;
  setMessages: (messages: StoreMessage[]) => void;
  reset: () => void;
}

/**
 * 초기 상태
 */
const initialState = {
  shareId: null as string | null,
  conversationId: null as number | null,
  messages: [] as StoreMessage[],
  isConnected: false,
  isAuthenticated: false,
  error: null as string | null,
};

/**
 * Share 상태 관리 스토어
 *
 * 공유 링크를 통한 대화 뷰어의 상태를 관리합니다.
 * - shareId: 공유 링크 ID
 * - conversationId: 대화 식별자
 * - messages: 대화 메시지 목록
 * - 연결/인증 상태
 * - 에러 상태
 */
export const useShareStore = create<ShareState>((set) => ({
  ...initialState,

  setShareId: (shareId) => {
    set({ shareId });
  },

  setConversationId: (conversationId) => {
    set({ conversationId });
  },

  setConnected: (connected) => {
    if (connected) {
      set({ isConnected: true });
    } else {
      // 연결 해제 시 인증 상태도 초기화
      set({
        isConnected: false,
        isAuthenticated: false,
      });
    }
  },

  setAuthenticated: (authenticated) => {
    set({ isAuthenticated: authenticated });
  },

  setError: (error) => {
    set({ error });
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  setMessages: (messages) => {
    set({ messages });
  },

  reset: () => {
    set({ ...initialState });
  },
}));
