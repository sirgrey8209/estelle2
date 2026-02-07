/**
 * @file conversationStore.ts
 * @description 대화별 Claude 상태 관리 스토어
 *
 * 각 대화(Conversation)의 Claude 상태를 독립적으로 관리합니다.
 * claudeStore의 전역 상태 문제를 해결하기 위해 도입되었습니다.
 */

import { create } from 'zustand';
import type {
  StoreMessage,
  ConversationClaudeState,
  ClaudeStatus,
  PendingRequest,
  RealtimeUsage,
  AssistantTextMessage,
} from '@estelle/core';
import { createInitialClaudeState } from '@estelle/core';

// ============================================================================
// Re-export for convenience
// ============================================================================

export { createInitialClaudeState as getInitialClaudeState };

// ============================================================================
// Store Interface
// ============================================================================

/**
 * conversationStore 상태 인터페이스
 */
export interface ConversationStoreState {
  /** 대화별 Claude 상태 */
  states: Map<string, ConversationClaudeState>;

  /** 현재 선택된 대화 ID */
  currentConversationId: string | null;

  // === Getters ===

  /** 특정 대화의 상태 조회 */
  getState: (conversationId: string) => ConversationClaudeState | null;

  /** 현재 선택된 대화의 상태 조회 */
  getCurrentState: () => ConversationClaudeState | null;

  /** pendingRequests 존재 여부 */
  hasPendingRequests: (conversationId: string) => boolean;

  // === Actions: 대화 선택 ===

  /** 현재 대화 설정 */
  setCurrentConversation: (conversationId: string | null) => void;

  // === Actions: status ===

  /** 상태 변경 */
  setStatus: (conversationId: string, status: ClaudeStatus) => void;

  // === Actions: messages ===

  /** 메시지 추가 */
  addMessage: (conversationId: string, message: StoreMessage) => void;

  /** 메시지 목록 설정 (히스토리 로드) */
  setMessages: (conversationId: string, messages: StoreMessage[], paging?: { totalCount: number; hasMore: boolean }) => void;

  /** 이전 메시지 추가 (페이징) */
  prependMessages: (conversationId: string, messages: StoreMessage[], hasMore: boolean) => void;

  /** 메시지 목록 비우기 */
  clearMessages: (conversationId: string) => void;

  // === Actions: 페이징 ===

  /** 로딩 상태 설정 */
  setLoadingMore: (conversationId: string, isLoading: boolean) => void;

  // === Actions: textBuffer ===

  /** 텍스트 버퍼에 추가 */
  appendTextBuffer: (conversationId: string, text: string) => void;

  /** 텍스트 버퍼 비우기 */
  clearTextBuffer: (conversationId: string) => void;

  /** 텍스트 버퍼를 메시지로 변환 */
  flushTextBuffer: (conversationId: string) => void;

  // === Actions: pendingRequests ===

  /** 대기 중인 요청 추가 */
  addPendingRequest: (conversationId: string, request: PendingRequest) => void;

  /** 대기 중인 요청 제거 */
  removePendingRequest: (conversationId: string, toolUseId: string) => void;

  // === Actions: realtimeUsage ===

  /** 실시간 사용량 업데이트 */
  updateRealtimeUsage: (conversationId: string, usage: Omit<RealtimeUsage, 'lastUpdateType'>) => void;

  // === Actions: 대화 관리 ===

  /** 대화 상태 삭제 */
  deleteConversation: (conversationId: string) => void;

  /** 전체 상태 초기화 */
  reset: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * UUID 생성 (간단한 버전)
 */
function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 대화 상태 가져오기 (없으면 생성)
 */
function getOrCreateState(
  states: Map<string, ConversationClaudeState>,
  conversationId: string
): ConversationClaudeState {
  let state = states.get(conversationId);
  if (!state) {
    state = createInitialClaudeState();
    states.set(conversationId, state);
  }
  return state;
}

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * 대화별 Claude 상태 관리 스토어
 */
export const useConversationStore = create<ConversationStoreState>((set, get) => ({
  states: new Map(),
  currentConversationId: null,

  // === Getters ===

  getState: (conversationId) => {
    return get().states.get(conversationId) ?? null;
  },

  getCurrentState: () => {
    const { currentConversationId, states } = get();
    if (!currentConversationId) return null;
    return states.get(currentConversationId) ?? null;
  },

  hasPendingRequests: (conversationId) => {
    const state = get().states.get(conversationId);
    return state ? state.pendingRequests.length > 0 : false;
  },

  // === Actions: 대화 선택 ===

  setCurrentConversation: (conversationId) => {
    if (!conversationId) {
      set({ currentConversationId: null });
      return;
    }

    const states = new Map(get().states);
    getOrCreateState(states, conversationId);

    set({
      currentConversationId: conversationId,
      states,
    });
  },

  // === Actions: status ===

  setStatus: (conversationId, status) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    const updates: Partial<ConversationClaudeState> = { status };

    if (status === 'working') {
      updates.workStartTime = Date.now();
      updates.realtimeUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        lastUpdateType: 'input',
      };
    } else if (status === 'idle') {
      updates.workStartTime = null;
      updates.realtimeUsage = null;
    }

    states.set(conversationId, { ...state, ...updates });
    set({ states });
  },

  // === Actions: messages ===

  addMessage: (conversationId, message) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    states.set(conversationId, {
      ...state,
      messages: [...state.messages, message],
    });
    set({ states });
  },

  setMessages: (conversationId, messages, paging) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    // 히스토리 로드 시 실시간으로 받은 메시지와 병합
    // 히스토리의 마지막 timestamp 이후에 온 실시간 메시지만 보존
    const historyLastTimestamp = messages.length > 0
      ? Math.max(...messages.map((m) => m.timestamp))
      : 0;
    const historyIds = new Set(messages.map((m) => m.id));
    const realtimeMessages = state.messages.filter(
      (m) => !historyIds.has(m.id) && m.timestamp > historyLastTimestamp
    );

    // 히스토리 + 실시간 메시지 (시간순 정렬)
    const mergedMessages = realtimeMessages.length > 0
      ? [...messages, ...realtimeMessages].sort((a, b) => a.timestamp - b.timestamp)
      : messages;

    states.set(conversationId, {
      ...state,
      messages: mergedMessages,
      totalCount: paging?.totalCount ?? mergedMessages.length,
      hasMore: paging?.hasMore ?? false,
    });
    set({ states });
  },

  prependMessages: (conversationId, messages, hasMore) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    // 중복 제거 후 앞에 추가
    const existingIds = new Set(state.messages.map((m) => m.id));
    const newMessages = messages.filter((m) => !existingIds.has(m.id));

    states.set(conversationId, {
      ...state,
      messages: [...newMessages, ...state.messages],
      hasMore,
      isLoadingMore: false,
    });
    set({ states });
  },

  clearMessages: (conversationId) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    states.set(conversationId, {
      ...state,
      messages: [],
      pendingRequests: [],
      totalCount: 0,
      hasMore: false,
    });
    set({ states });
  },

  // === Actions: 페이징 ===

  setLoadingMore: (conversationId, isLoading) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    states.set(conversationId, { ...state, isLoadingMore: isLoading });
    set({ states });
  },

  // === Actions: textBuffer ===

  appendTextBuffer: (conversationId, text) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    states.set(conversationId, {
      ...state,
      textBuffer: state.textBuffer + text,
    });
    set({ states });
  },

  clearTextBuffer: (conversationId) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    states.set(conversationId, { ...state, textBuffer: '' });
    set({ states });
  },

  flushTextBuffer: (conversationId) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    if (!state.textBuffer.trim()) {
      // 빈 버퍼면 그냥 비우기만
      states.set(conversationId, { ...state, textBuffer: '' });
      set({ states });
      return;
    }

    const newMessage: AssistantTextMessage = {
      id: generateId(),
      role: 'assistant',
      type: 'text',
      content: state.textBuffer,
      timestamp: Date.now(),
    };

    states.set(conversationId, {
      ...state,
      messages: [...state.messages, newMessage],
      textBuffer: '',
    });
    set({ states });
  },

  // === Actions: pendingRequests ===

  addPendingRequest: (conversationId, request) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    states.set(conversationId, {
      ...state,
      pendingRequests: [...state.pendingRequests, request],
    });
    set({ states });
  },

  removePendingRequest: (conversationId, toolUseId) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    states.set(conversationId, {
      ...state,
      pendingRequests: state.pendingRequests.filter((r) => r.toolUseId !== toolUseId),
    });
    set({ states });
  },

  // === Actions: realtimeUsage ===

  updateRealtimeUsage: (conversationId, usage) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, conversationId);

    const prev = state.realtimeUsage;
    let lastUpdateType: 'input' | 'output' = 'input';

    if (prev) {
      if (usage.outputTokens > prev.outputTokens) {
        lastUpdateType = 'output';
      } else if (usage.inputTokens > prev.inputTokens) {
        lastUpdateType = 'input';
      } else {
        lastUpdateType = prev.lastUpdateType;
      }
    }

    states.set(conversationId, {
      ...state,
      realtimeUsage: { ...usage, lastUpdateType },
    });
    set({ states });
  },

  // === Actions: 대화 관리 ===

  deleteConversation: (conversationId) => {
    const states = new Map(get().states);
    states.delete(conversationId);

    const currentId = get().currentConversationId;
    set({
      states,
      currentConversationId: currentId === conversationId ? null : currentId,
    });
  },

  reset: () => {
    set({
      states: new Map(),
      currentConversationId: null,
    });
  },
}));
