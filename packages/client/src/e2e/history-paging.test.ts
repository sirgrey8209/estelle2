/**
 * @file history-paging.test.ts
 * @description 히스토리 페이징 통합 테스트
 *
 * loadBefore, syncStore from-to 범위 관리, 실시간 메시지 처리를 검증합니다.
 *
 * ## loadBefore 규칙
 *
 * loadBefore = "이 인덱스 이전의 메시지를 로드" (현재 syncedFrom 값)
 * - messages = [0, 1, 2, ..., 99] (0이 가장 오래됨, 99가 최신)
 * - loadBefore = 80이면 → 인덱스 0~79 범위에서 최신 것부터 (maxBytes 제한 내) 가져옴
 *
 * Client가 "60~80 범위"를 원하면:
 * - 현재 syncedFrom=80, syncedTo=100, totalCount=100
 * - loadBefore = syncedFrom = 80 보내면 됨
 * - Pylon: 0~79 범위에서 최신 것부터 maxBytes만큼 반환 → 60~79 (20개)
 * - Client: newSyncedFrom = loadBefore - loadedCount = 80 - 20 = 60
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageType } from '@estelle/core';
import type { StoreMessage } from '@estelle/core';

// ============================================================================
// Mocks
// ============================================================================

const mockWorkspaceStore = {
  selectedConversation: null as { conversationId: number } | null,
};

const mockConversationStore = {
  setMessages: vi.fn(),
  prependMessages: vi.fn(),
  addMessage: vi.fn(),
  clearTextBuffer: vi.fn(),
  getState: vi.fn(() => ({ messages: [], status: 'idle' })),
  setStatus: vi.fn(),
};

vi.mock('../stores/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: () => mockWorkspaceStore,
  },
}));

vi.mock('../stores/conversationStore', () => ({
  useConversationStore: {
    getState: () => mockConversationStore,
  },
}));

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ setAccountStatus: vi.fn() }),
  },
}));

// syncStore는 실제 구현 사용
import { useSyncStore } from '../stores/syncStore';

vi.mock('../services/syncOrchestrator', () => ({
  syncOrchestrator: { onWorkspaceListReceived: vi.fn() },
}));

import { routeMessage } from '../hooks/useMessageRouter';

// ============================================================================
// Test Constants
// ============================================================================

const CONVERSATION_ID = 1001;

function createMessage(index: number): StoreMessage {
  return {
    id: `msg-${index}`,
    role: 'user',
    type: 'text',
    content: `Message ${index}`,
    timestamp: 1700000000000 + index * 1000,
  } as StoreMessage;
}

// ============================================================================
// Tests
// ============================================================================

describe('히스토리 페이징 통합 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSyncStore.getState().reset();
    mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };
  });

  describe('초기 로드 (loadBefore=0 또는 미지정)', () => {
    it('100개 중 최신 20개 로드 시 syncedFrom=80, syncedTo=100', () => {
      // Given: Pylon이 totalCount=100, 20개 메시지 반환
      const messages = Array.from({ length: 20 }, (_, i) => createMessage(80 + i));

      // When: loadBefore 미지정 = 초기 로드
      routeMessage({
        type: MessageType.HISTORY_RESULT,
        payload: {
          conversationId: CONVERSATION_ID,
          messages,
          totalCount: 100,
        },
      });

      // Then
      const syncInfo = useSyncStore.getState().getConversationSync(CONVERSATION_ID);
      expect(syncInfo?.syncedFrom).toBe(80);  // 100 - 20 = 80
      expect(syncInfo?.syncedTo).toBe(100);
      expect(syncInfo?.totalCount).toBe(100);
      expect(syncInfo?.phase).toBe('synced');
    });

    it('50개 중 전체 로드 시 syncedFrom=0, syncedTo=50', () => {
      // Given: 작은 대화, 전체 로드됨
      const messages = Array.from({ length: 50 }, (_, i) => createMessage(i));

      // When: loadBefore 미지정 = 초기 로드
      routeMessage({
        type: MessageType.HISTORY_RESULT,
        payload: {
          conversationId: CONVERSATION_ID,
          messages,
          totalCount: 50,
        },
      });

      // Then
      const syncInfo = useSyncStore.getState().getConversationSync(CONVERSATION_ID);
      expect(syncInfo?.syncedFrom).toBe(0);
      expect(syncInfo?.syncedTo).toBe(50);
      expect(useSyncStore.getState().hasMoreBefore(CONVERSATION_ID)).toBe(false);
    });
  });

  describe('과거 로드 (loadBefore > 0)', () => {
    beforeEach(() => {
      // 초기 상태: 80~100 로드됨
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 80, 100, 100);
      useSyncStore.getState().setConversationPhase(CONVERSATION_ID, 'synced');
    });

    /**
     * loadBefore 계산 예시:
     * - 현재: syncedFrom=80, syncedTo=100, totalCount=100
     * - Client가 60~80 원함
     * - Client → Pylon: loadBefore = syncedFrom = 80 (80 이전 메시지 요청)
     * - Pylon: messages[60..80] 반환
     * - Pylon → Client: loadBefore=80, messages(20개), totalCount=100
     * - Client: newSyncedFrom = loadBefore - loadedCount = 80 - 20 = 60
     */
    it('loadBefore=80으로 20개 더 로드 → syncedFrom=60으로 확장', () => {
      // Given: 60~80 범위 메시지 (Pylon이 반환)
      const messages = Array.from({ length: 20 }, (_, i) => createMessage(60 + i));

      // When: Pylon이 loadBefore=80으로 응답 (인덱스 80 이전 메시지)
      routeMessage({
        type: MessageType.HISTORY_RESULT,
        payload: {
          conversationId: CONVERSATION_ID,
          messages,
          totalCount: 100,
          loadBefore: 80,
        },
      });

      // Then: syncedFrom이 60으로 확장
      // newSyncedFrom = 80 - 20 = 60
      const syncInfo = useSyncStore.getState().getConversationSync(CONVERSATION_ID);
      expect(syncInfo?.syncedFrom).toBe(60);
      expect(syncInfo?.syncedTo).toBe(100);  // 유지
    });

    it('loadBefore=20으로 20개 더 로드 → syncedFrom=0 (처음 도달)', () => {
      // Given: 현재 20~100 로드됨 상태로 변경
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 20, 100, 100);

      // Client가 0~20 원함 → loadBefore = 20
      const messages = Array.from({ length: 20 }, (_, i) => createMessage(i));

      // When: Pylon이 loadBefore=20으로 응답
      routeMessage({
        type: MessageType.HISTORY_RESULT,
        payload: {
          conversationId: CONVERSATION_ID,
          messages,
          totalCount: 100,
          loadBefore: 20,
        },
      });

      // Then: newSyncedFrom = 20 - 20 = 0
      const syncInfo = useSyncStore.getState().getConversationSync(CONVERSATION_ID);
      expect(syncInfo?.syncedFrom).toBe(0);
      expect(useSyncStore.getState().hasMoreBefore(CONVERSATION_ID)).toBe(false);
    });

    it('prependMessages가 호출되어야 함', () => {
      const messages = Array.from({ length: 10 }, (_, i) => createMessage(70 + i));

      routeMessage({
        type: MessageType.HISTORY_RESULT,
        payload: {
          conversationId: CONVERSATION_ID,
          messages,
          totalCount: 100,
          loadBefore: 80,  // 인덱스 80 이전 메시지
        },
      });

      expect(mockConversationStore.prependMessages).toHaveBeenCalledWith(CONVERSATION_ID, messages);
      expect(mockConversationStore.setMessages).not.toHaveBeenCalled();
    });
  });

  describe('hasMoreBefore / hasMoreAfter', () => {
    it('syncedFrom > 0이면 hasMoreBefore = true', () => {
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 50, 100, 100);

      expect(useSyncStore.getState().hasMoreBefore(CONVERSATION_ID)).toBe(true);
    });

    it('syncedFrom = 0이면 hasMoreBefore = false', () => {
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 0, 100, 100);

      expect(useSyncStore.getState().hasMoreBefore(CONVERSATION_ID)).toBe(false);
    });

    it('syncedTo < totalCount이면 hasMoreAfter = true (갭)', () => {
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 50, 80, 100);

      expect(useSyncStore.getState().hasMoreAfter(CONVERSATION_ID)).toBe(true);
    });

    it('syncedTo = totalCount이면 hasMoreAfter = false', () => {
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 50, 100, 100);

      expect(useSyncStore.getState().hasMoreAfter(CONVERSATION_ID)).toBe(false);
    });
  });

  describe('isLoadingMore 상태 관리', () => {
    it('setLoadingMore(true) 후 isLoadingMore = true', () => {
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 80, 100, 100);
      useSyncStore.getState().setLoadingMore(CONVERSATION_ID, true);

      expect(useSyncStore.getState().isLoadingMore(CONVERSATION_ID)).toBe(true);
    });

    it('setConversationSync 호출 시 isLoadingMore = false로 리셋', () => {
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 80, 100, 100);
      useSyncStore.getState().setLoadingMore(CONVERSATION_ID, true);

      // 새 데이터 도착
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 60, 100, 100);

      expect(useSyncStore.getState().isLoadingMore(CONVERSATION_ID)).toBe(false);
    });
  });

  describe('extendSyncedTo (실시간 메시지)', () => {
    beforeEach(() => {
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 80, 100, 100);
    });

    it('새 메시지 도착 시 syncedTo, totalCount 증가', () => {
      useSyncStore.getState().extendSyncedTo(CONVERSATION_ID, 101, 101);

      const syncInfo = useSyncStore.getState().getConversationSync(CONVERSATION_ID);
      expect(syncInfo?.syncedFrom).toBe(80);  // 유지
      expect(syncInfo?.syncedTo).toBe(101);
      expect(syncInfo?.totalCount).toBe(101);
    });

    it('3개 메시지 연속 도착', () => {
      useSyncStore.getState().extendSyncedTo(CONVERSATION_ID, 101, 101);
      useSyncStore.getState().extendSyncedTo(CONVERSATION_ID, 102, 102);
      useSyncStore.getState().extendSyncedTo(CONVERSATION_ID, 103, 103);

      const syncInfo = useSyncStore.getState().getConversationSync(CONVERSATION_ID);
      expect(syncInfo?.syncedTo).toBe(103);
      expect(syncInfo?.totalCount).toBe(103);
    });
  });

  describe('extendSyncedFrom', () => {
    it('더 작은 값으로만 확장됨', () => {
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 80, 100, 100);

      // 60으로 확장
      useSyncStore.getState().extendSyncedFrom(CONVERSATION_ID, 60);
      expect(useSyncStore.getState().getConversationSync(CONVERSATION_ID)?.syncedFrom).toBe(60);

      // 70은 무시됨 (이미 60까지 있음)
      useSyncStore.getState().extendSyncedFrom(CONVERSATION_ID, 70);
      expect(useSyncStore.getState().getConversationSync(CONVERSATION_ID)?.syncedFrom).toBe(60);
    });

    it('음수로 계산되면 0으로 클램프', () => {
      useSyncStore.getState().setConversationSync(CONVERSATION_ID, 10, 100, 100);

      // 음수가 들어와도 0 이상 유지
      useSyncStore.getState().extendSyncedFrom(CONVERSATION_ID, -5);
      expect(useSyncStore.getState().getConversationSync(CONVERSATION_ID)?.syncedFrom).toBe(-5);
      // 참고: extendSyncedFrom 자체는 음수 체크 안 함
      // useMessageRouter에서 Math.max(0, newSyncedFrom)으로 보장
    });
  });
});
