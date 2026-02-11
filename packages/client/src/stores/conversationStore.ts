/**
 * @file conversationStore.ts
 * @description 대화별 Claude 상태 관리 스토어
 *
 * 각 대화(Conversation)의 Claude 상태를 독립적으로 관리합니다.
 * claudeStore의 전역 상태 문제를 해결하기 위해 도입되었습니다.
 *
 * entityId(number)를 키로 사용합니다.
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
  /** 대화별 Claude 상태 (entityId → state) */
  states: Map<number, ConversationClaudeState>;

  /** 현재 선택된 entityId */
  currentEntityId: number | null;

  // === Getters ===

  /** 특정 대화의 상태 조회 */
  getState: (entityId: number) => ConversationClaudeState | null;

  /** 현재 선택된 대화의 상태 조회 */
  getCurrentState: () => ConversationClaudeState | null;

  /** pendingRequests 존재 여부 */
  hasPendingRequests: (entityId: number) => boolean;

  // === Actions: 대화 선택 ===

  /** 현재 대화 설정 */
  setCurrentConversation: (entityId: number | null) => void;

  // === Actions: status ===

  /** 상태 변경 */
  setStatus: (entityId: number, status: ClaudeStatus) => void;

  // === Actions: messages ===

  /** 메시지 추가 */
  addMessage: (entityId: number, message: StoreMessage) => void;

  /** 메시지 목록 설정 (히스토리 로드) */
  setMessages: (entityId: number, messages: StoreMessage[]) => void;

  /** 이전 메시지 추가 (페이징) */
  prependMessages: (entityId: number, messages: StoreMessage[]) => void;

  /** 메시지 목록 비우기 */
  clearMessages: (entityId: number) => void;


  // === Actions: textBuffer ===

  /** 텍스트 버퍼에 추가 */
  appendTextBuffer: (entityId: number, text: string) => void;

  /** 텍스트 버퍼 비우기 */
  clearTextBuffer: (entityId: number) => void;

  /** 텍스트 버퍼를 메시지로 변환 */
  flushTextBuffer: (entityId: number) => void;

  // === Actions: pendingRequests ===

  /** 대기 중인 요청 추가 */
  addPendingRequest: (entityId: number, request: PendingRequest) => void;

  /** 대기 중인 요청 제거 */
  removePendingRequest: (entityId: number, toolUseId: string) => void;

  // === Actions: realtimeUsage ===

  /** 실시간 사용량 업데이트 */
  updateRealtimeUsage: (entityId: number, usage: Omit<RealtimeUsage, 'lastUpdateType'>) => void;

  // === Actions: 대화 관리 ===

  /** 대화 상태 삭제 */
  deleteConversation: (entityId: number) => void;

  /** 전체 상태 초기화 */
  reset: () => void;

  // === 하위 호환 ===
  /** @deprecated currentEntityId 사용 권장 */
  currentConversationId: string | null;
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
  states: Map<number, ConversationClaudeState>,
  entityId: number
): ConversationClaudeState {
  let state = states.get(entityId);
  if (!state) {
    state = createInitialClaudeState();
    states.set(entityId, state);
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
  currentEntityId: null,
  currentConversationId: null,

  // === Getters ===

  getState: (entityId) => {
    return get().states.get(entityId) ?? null;
  },

  /**
   * 현재 선택된 대화의 상태 조회
   *
   * ⚠️ React 컴포넌트에서는 useCurrentConversationState() 사용 권장
   * 이 함수는 get()을 호출하여 Zustand selector 구독을 우회함
   */
  getCurrentState: () => {
    const { currentEntityId, states } = get();
    if (!currentEntityId) return null;
    return states.get(currentEntityId) ?? null;
  },

  hasPendingRequests: (entityId) => {
    const state = get().states.get(entityId);
    return state ? state.pendingRequests.length > 0 : false;
  },

  // === Actions: 대화 선택 ===

  setCurrentConversation: (entityId) => {
    if (!entityId) {
      set({ currentEntityId: null, currentConversationId: null });
      return;
    }

    const states = new Map(get().states);
    getOrCreateState(states, entityId);

    set({
      currentEntityId: entityId,
      currentConversationId: String(entityId),
      states,
    });
  },

  // === Actions: status ===

  setStatus: (entityId, status) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

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

    states.set(entityId, { ...state, ...updates });
    set({ states });
  },

  // === Actions: messages ===

  addMessage: (entityId, message) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

    states.set(entityId, {
      ...state,
      messages: [...state.messages, message],
    });
    set({ states });
  },

  setMessages: (entityId, messages) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

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

    states.set(entityId, {
      ...state,
      messages: mergedMessages,
    });
    set({ states });
  },

  prependMessages: (entityId, messages) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

    // 중복 제거 후 앞에 추가
    const existingIds = new Set(state.messages.map((m) => m.id));
    const newMessages = messages.filter((m) => !existingIds.has(m.id));

    states.set(entityId, {
      ...state,
      messages: [...newMessages, ...state.messages],
    });
    set({ states });
  },

  clearMessages: (entityId) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

    states.set(entityId, {
      ...state,
      messages: [],
      pendingRequests: [],
    });
    set({ states });
  },

  // === Actions: textBuffer ===

  appendTextBuffer: (entityId, text) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

    states.set(entityId, {
      ...state,
      textBuffer: state.textBuffer + text,
    });
    set({ states });
  },

  clearTextBuffer: (entityId) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

    states.set(entityId, { ...state, textBuffer: '' });
    set({ states });
  },

  flushTextBuffer: (entityId) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

    if (!state.textBuffer.trim()) {
      // 빈 버퍼면 그냥 비우기만
      states.set(entityId, { ...state, textBuffer: '' });
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

    states.set(entityId, {
      ...state,
      messages: [...state.messages, newMessage],
      textBuffer: '',
    });
    set({ states });
  },

  // === Actions: pendingRequests ===

  addPendingRequest: (entityId, request) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

    states.set(entityId, {
      ...state,
      pendingRequests: [...state.pendingRequests, request],
    });
    set({ states });
  },

  removePendingRequest: (entityId, toolUseId) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

    states.set(entityId, {
      ...state,
      pendingRequests: state.pendingRequests.filter((r) => r.toolUseId !== toolUseId),
    });
    set({ states });
  },

  // === Actions: realtimeUsage ===

  updateRealtimeUsage: (entityId, usage) => {
    const states = new Map(get().states);
    const state = getOrCreateState(states, entityId);

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

    states.set(entityId, {
      ...state,
      realtimeUsage: { ...usage, lastUpdateType },
    });
    set({ states });
  },

  // === Actions: 대화 관리 ===

  deleteConversation: (entityId) => {
    const states = new Map(get().states);
    states.delete(entityId);

    const currentId = get().currentEntityId;
    set({
      states,
      currentEntityId: currentId === entityId ? null : currentId,
      currentConversationId: currentId === entityId ? null : get().currentConversationId,
    });
  },

  reset: () => {
    set({
      states: new Map(),
      currentEntityId: null,
      currentConversationId: null,
    });
  },
}));

// ============================================================================
// Hooks
// ============================================================================

/**
 * 현재 선택된 대화의 상태를 리액티브하게 구독하는 hook
 *
 * getCurrentState()와 달리 Zustand selector를 통해 구독하므로
 * 상태 변경 시 자동으로 리렌더링이 트리거됩니다.
 *
 * @returns 현재 대화의 ConversationClaudeState 또는 null
 */
export function useCurrentConversationState(): ConversationClaudeState | null {
  return useConversationStore((s) => {
    if (!s.currentEntityId) return null;
    return s.states.get(s.currentEntityId) ?? null;
  });
}
