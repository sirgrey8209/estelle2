/**
 * @file syncStore.test.ts
 * @description syncStore 테스트
 *
 * 동기화 상태 중앙 관리 스토어 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSyncStore } from './syncStore';

// ============================================================================
// Tests
// ============================================================================

describe('syncStore', () => {
  beforeEach(() => {
    useSyncStore.getState().reset();
  });

  describe('초기 상태', () => {
    it('workspaceSync idle, conversations 빈 Map, retryCount 0', () => {
      const state = useSyncStore.getState();

      expect(state.workspaceSync).toBe('idle');
      expect(state.conversations.size).toBe(0);
      expect(state.workspaceRetryCount).toBe(0);
    });
  });

  describe('workspace sync 전이', () => {
    it('setWorkspaceSync로 idle → requesting → synced 전이', () => {
      const store = useSyncStore.getState();

      expect(store.workspaceSync).toBe('idle');

      store.setWorkspaceSync('requesting');
      expect(useSyncStore.getState().workspaceSync).toBe('requesting');

      store.setWorkspaceSync('synced');
      expect(useSyncStore.getState().workspaceSync).toBe('synced');
    });

    it('failed 상태도 설정 가능', () => {
      const store = useSyncStore.getState();

      store.setWorkspaceSync('failed');
      expect(useSyncStore.getState().workspaceSync).toBe('failed');
    });
  });

  describe('workspace retry', () => {
    it('incrementWorkspaceRetry로 카운터 증가', () => {
      const store = useSyncStore.getState();

      expect(useSyncStore.getState().workspaceRetryCount).toBe(0);

      store.incrementWorkspaceRetry();
      expect(useSyncStore.getState().workspaceRetryCount).toBe(1);

      store.incrementWorkspaceRetry();
      expect(useSyncStore.getState().workspaceRetryCount).toBe(2);
    });
  });

  describe('conversation phase 관리', () => {
    it('setConversationPhase로 대화별 phase 독립 관리', () => {
      const store = useSyncStore.getState();

      store.setConversationPhase(1001, 'requesting');
      store.setConversationPhase(1002, 'synced');

      const info1 = useSyncStore.getState().getConversationSync(1001);
      const info2 = useSyncStore.getState().getConversationSync(1002);

      expect(info1?.phase).toBe('requesting');
      expect(info2?.phase).toBe('synced');
    });

    it('존재하지 않는 대화 조회 시 null 반환', () => {
      const store = useSyncStore.getState();
      expect(store.getConversationSync(9999)).toBeNull();
    });

    it('setConversationPhase는 기존 syncedFrom/syncedTo/totalCount 유지', () => {
      const store = useSyncStore.getState();

      store.setConversationSync(1001, 10, 50, 100);
      store.setConversationPhase(1001, 'synced');

      const info = useSyncStore.getState().getConversationSync(1001);
      expect(info?.syncedFrom).toBe(10);
      expect(info?.syncedTo).toBe(50);
      expect(info?.totalCount).toBe(100);
      expect(info?.phase).toBe('synced');
    });
  });

  describe('conversation sync 범위 (from-to)', () => {
    it('setConversationSync로 범위 설정', () => {
      const store = useSyncStore.getState();

      // 100개 중 80~100 로드됨 (최근 20개)
      store.setConversationSync(1001, 80, 100, 100);

      const info = useSyncStore.getState().getConversationSync(1001);
      expect(info?.syncedFrom).toBe(80);
      expect(info?.syncedTo).toBe(100);
      expect(info?.totalCount).toBe(100);
    });

    it('extendSyncedFrom으로 과거 방향 확장', () => {
      const store = useSyncStore.getState();

      // 초기: 80~100
      store.setConversationSync(1001, 80, 100, 100);

      // 과거 로드: 60~80 추가 → 60~100
      store.extendSyncedFrom(1001, 60);

      const info = useSyncStore.getState().getConversationSync(1001);
      expect(info?.syncedFrom).toBe(60);
      expect(info?.syncedTo).toBe(100);
    });

    it('extendSyncedTo로 미래 방향 확장 (실시간 메시지)', () => {
      const store = useSyncStore.getState();

      // 초기: 80~100
      store.setConversationSync(1001, 80, 100, 100);

      // 실시간 메시지 3개 도착 → 80~103
      store.extendSyncedTo(1001, 103, 103);

      const info = useSyncStore.getState().getConversationSync(1001);
      expect(info?.syncedFrom).toBe(80);
      expect(info?.syncedTo).toBe(103);
      expect(info?.totalCount).toBe(103);
    });

    it('hasMoreBefore는 syncedFrom > 0일 때 true', () => {
      const store = useSyncStore.getState();

      // 80~100 (앞에 80개 더 있음)
      store.setConversationSync(1001, 80, 100, 100);
      expect(useSyncStore.getState().hasMoreBefore(1001)).toBe(true);

      // 0~100 (처음부터 로드됨)
      store.setConversationSync(1001, 0, 100, 100);
      expect(useSyncStore.getState().hasMoreBefore(1001)).toBe(false);
    });

    it('hasMoreAfter는 syncedTo < totalCount일 때 true (갭 상황)', () => {
      const store = useSyncStore.getState();

      // 80~100인데 totalCount가 110 (갭 발생)
      store.setConversationSync(1001, 80, 100, 110);
      expect(useSyncStore.getState().hasMoreAfter(1001)).toBe(true);

      // 80~110으로 갭 해소
      store.setConversationSync(1001, 80, 110, 110);
      expect(useSyncStore.getState().hasMoreAfter(1001)).toBe(false);
    });

    it('hasMoreBefore/hasMoreAfter는 존재하지 않는 대화에 대해 false', () => {
      expect(useSyncStore.getState().hasMoreBefore(9999)).toBe(false);
      expect(useSyncStore.getState().hasMoreAfter(9999)).toBe(false);
    });
  });

  describe('isLoadingMore', () => {
    it('setLoadingMore로 로딩 상태 설정', () => {
      const store = useSyncStore.getState();

      store.setConversationSync(1001, 80, 100, 100);
      expect(useSyncStore.getState().isLoadingMore(1001)).toBe(false);

      store.setLoadingMore(1001, true);
      expect(useSyncStore.getState().isLoadingMore(1001)).toBe(true);

      store.setLoadingMore(1001, false);
      expect(useSyncStore.getState().isLoadingMore(1001)).toBe(false);
    });

    it('setConversationSync 호출 시 isLoadingMore false로 리셋', () => {
      const store = useSyncStore.getState();

      store.setConversationSync(1001, 80, 100, 100);
      store.setLoadingMore(1001, true);

      // 새로운 동기화로 로딩 완료
      store.setConversationSync(1001, 60, 100, 100);

      expect(useSyncStore.getState().isLoadingMore(1001)).toBe(false);
    });
  });

  describe('resetForReconnect', () => {
    it('workspace idle, 모든 conversation phase idle, 범위 정보 유지', () => {
      const store = useSyncStore.getState();

      // 상태 설정
      store.setWorkspaceSync('synced');
      store.setConversationPhase(1001, 'synced');
      store.setConversationSync(1001, 80, 100, 100);
      store.setConversationPhase(1002, 'synced');
      store.setConversationSync(1002, 25, 30, 30);

      // resetForReconnect
      useSyncStore.getState().resetForReconnect();

      const state = useSyncStore.getState();

      // workspace는 idle
      expect(state.workspaceSync).toBe('idle');
      expect(state.workspaceRetryCount).toBe(0);

      // conversation phase는 idle이지만 범위는 유지
      const info1 = state.getConversationSync(1001);
      expect(info1?.phase).toBe('idle');
      expect(info1?.syncedFrom).toBe(80);
      expect(info1?.syncedTo).toBe(100);
      expect(info1?.totalCount).toBe(100);

      const info2 = state.getConversationSync(1002);
      expect(info2?.phase).toBe('idle');
      expect(info2?.syncedFrom).toBe(25);
      expect(info2?.syncedTo).toBe(30);
      expect(info2?.totalCount).toBe(30);
    });
  });

  describe('isReady', () => {
    it('workspace synced + 대화 synced = true', () => {
      const store = useSyncStore.getState();

      store.setWorkspaceSync('synced');
      store.setConversationPhase(1001, 'synced');

      expect(useSyncStore.getState().isReady(1001)).toBe(true);
    });

    it('workspace synced + conversationId null = true (workspace만 확인)', () => {
      const store = useSyncStore.getState();

      store.setWorkspaceSync('synced');

      expect(useSyncStore.getState().isReady(null)).toBe(true);
    });

    it('workspace not synced = false', () => {
      const store = useSyncStore.getState();

      store.setWorkspaceSync('requesting');
      store.setConversationPhase(1001, 'synced');

      expect(useSyncStore.getState().isReady(1001)).toBe(false);
    });

    it('workspace synced + 대화 not synced = false', () => {
      const store = useSyncStore.getState();

      store.setWorkspaceSync('synced');
      store.setConversationPhase(1001, 'requesting');

      expect(useSyncStore.getState().isReady(1001)).toBe(false);
    });

    it('workspace synced + 대화 미등록 = false', () => {
      const store = useSyncStore.getState();

      store.setWorkspaceSync('synced');

      expect(useSyncStore.getState().isReady(1001)).toBe(false);
    });
  });
});
