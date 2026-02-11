/**
 * @file syncStore.ts
 * @description 동기화 상태 중앙 관리 스토어
 *
 * workspace 동기화 + 대화별 히스토리 동기화 상태를 관리합니다.
 * 기존에 여러 store에 분산되어 있던 동기화 플래그를 중앙화합니다.
 *
 * Cycle 1: 구조만 신설, 실제 이전/연동은 후속 사이클에서 진행
 */

import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export type SyncPhase = 'idle' | 'requesting' | 'synced' | 'failed';

export interface ConversationSyncInfo {
  phase: SyncPhase;
  /** 로드된 가장 오래된 메시지 인덱스 (0-based) */
  syncedFrom: number;
  /** 로드된 가장 최신 메시지 인덱스 (exclusive, 즉 syncedTo = totalCount면 최신까지 있음) */
  syncedTo: number;
  /** Pylon에 있는 전체 메시지 수 */
  totalCount: number;
  /** 추가 히스토리 로딩 중 */
  isLoadingMore: boolean;
}

// ============================================================================
// Store Interface
// ============================================================================

export interface SyncState {
  // === Workspace 동기화 ===
  workspaceSync: SyncPhase;
  workspaceRetryCount: number;

  // === 대화별 History 동기화 ===
  conversations: Map<number, ConversationSyncInfo>;

  // === Computed ===
  isReady: (currentEntityId: number | null) => boolean;

  // === Actions: Workspace ===
  setWorkspaceSync: (phase: SyncPhase) => void;
  incrementWorkspaceRetry: () => void;

  // === Actions: Conversation History ===
  setConversationPhase: (entityId: number, phase: SyncPhase) => void;
  /** 초기 로드: 범위 전체 설정 */
  setConversationSync: (entityId: number, syncedFrom: number, syncedTo: number, totalCount: number) => void;
  /** 과거 메시지 로드: syncedFrom 확장 */
  extendSyncedFrom: (entityId: number, newFrom: number) => void;
  /** 실시간 메시지 도착: syncedTo, totalCount 증가 */
  extendSyncedTo: (entityId: number, newTo: number, newTotalCount: number) => void;
  getConversationSync: (entityId: number) => ConversationSyncInfo | null;
  /** 과거 방향으로 더 있는지 */
  hasMoreBefore: (entityId: number) => boolean;
  /** 미래 방향으로 더 있는지 (갭 상황) */
  hasMoreAfter: (entityId: number) => boolean;
  /** 추가 로딩 상태 확인 */
  isLoadingMore: (entityId: number) => boolean;
  /** 추가 로딩 상태 설정 */
  setLoadingMore: (entityId: number, isLoading: boolean) => void;

  // === Actions: Reset ===
  resetForReconnect: () => void;
  reset: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSyncStore = create<SyncState>((set, get) => ({
  workspaceSync: 'idle',
  workspaceRetryCount: 0,
  conversations: new Map(),

  // === Computed ===

  isReady: (currentEntityId) => {
    const { workspaceSync, conversations } = get();
    if (workspaceSync !== 'synced') return false;
    if (currentEntityId === null) return true;

    const info = conversations.get(currentEntityId);
    return info?.phase === 'synced';
  },

  // === Actions: Workspace ===

  setWorkspaceSync: (phase) => {
    set({ workspaceSync: phase });
  },

  incrementWorkspaceRetry: () => {
    set((state) => ({ workspaceRetryCount: state.workspaceRetryCount + 1 }));
  },

  // === Actions: Conversation History ===

  setConversationPhase: (entityId, phase) => {
    const conversations = new Map(get().conversations);
    const existing = conversations.get(entityId);

    conversations.set(entityId, {
      phase,
      syncedFrom: existing?.syncedFrom ?? 0,
      syncedTo: existing?.syncedTo ?? 0,
      totalCount: existing?.totalCount ?? 0,
      isLoadingMore: existing?.isLoadingMore ?? false,
    });

    set({ conversations });
  },

  setConversationSync: (entityId, syncedFrom, syncedTo, totalCount) => {
    const conversations = new Map(get().conversations);
    const existing = conversations.get(entityId);

    conversations.set(entityId, {
      phase: existing?.phase ?? 'idle',
      syncedFrom,
      syncedTo,
      totalCount,
      isLoadingMore: false, // 동기화 완료 시 로딩 해제
    });

    set({ conversations });
  },

  extendSyncedFrom: (entityId, newFrom) => {
    const conversations = new Map(get().conversations);
    const existing = conversations.get(entityId);
    if (!existing) return;

    conversations.set(entityId, {
      ...existing,
      syncedFrom: Math.min(existing.syncedFrom, newFrom),
    });

    set({ conversations });
  },

  extendSyncedTo: (entityId, newTo, newTotalCount) => {
    const conversations = new Map(get().conversations);
    const existing = conversations.get(entityId);
    if (!existing) return;

    conversations.set(entityId, {
      ...existing,
      syncedTo: Math.max(existing.syncedTo, newTo),
      totalCount: Math.max(existing.totalCount, newTotalCount),
    });

    set({ conversations });
  },

  getConversationSync: (entityId) => {
    return get().conversations.get(entityId) ?? null;
  },

  hasMoreBefore: (entityId) => {
    const info = get().conversations.get(entityId);
    if (!info) return false;
    return info.syncedFrom > 0;
  },

  hasMoreAfter: (entityId) => {
    const info = get().conversations.get(entityId);
    if (!info) return false;
    return info.syncedTo < info.totalCount;
  },

  isLoadingMore: (entityId) => {
    const info = get().conversations.get(entityId);
    return info?.isLoadingMore ?? false;
  },

  setLoadingMore: (entityId, isLoading) => {
    const conversations = new Map(get().conversations);
    const existing = conversations.get(entityId);
    if (!existing) return;

    conversations.set(entityId, {
      ...existing,
      isLoadingMore: isLoading,
    });

    set({ conversations });
  },

  // === Actions: Reset ===

  resetForReconnect: () => {
    // 재연결 시 동기화 상태 초기화 (범위 정보는 유지하되 phase만 리셋)
    const conversations = new Map(get().conversations);
    for (const [entityId, info] of conversations) {
      conversations.set(entityId, {
        ...info,
        phase: 'idle',
      });
    }
    set({
      workspaceSync: 'idle',
      workspaceRetryCount: 0,
      conversations,
    });
  },

  reset: () => {
    set({
      workspaceSync: 'idle',
      workspaceRetryCount: 0,
      conversations: new Map(),
    });
  },
}));
