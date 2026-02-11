/**
 * @file syncOrchestrator.test.ts
 * @description SyncOrchestrator 테스트
 *
 * 초기 동기화 조율 + 재시도 로직 검증
 * vitest fake timers + 실제 syncStore + mock deps
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSyncStore } from '../stores/syncStore';
import { SyncOrchestrator, type SyncDeps } from './syncOrchestrator';

describe('SyncOrchestrator', () => {
  let deps: SyncDeps;
  let orchestrator: SyncOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    useSyncStore.getState().reset();

    deps = {
      requestWorkspaceList: vi.fn(() => true),
      selectConversation: vi.fn(() => true),
    };

    orchestrator = new SyncOrchestrator(deps);
  });

  afterEach(() => {
    orchestrator.cleanup();
    vi.useRealTimers();
  });

  // 1. startInitialSync — requesting 전이 + requestWorkspaceList 1회 호출
  it('startInitialSync should transition to requesting and call requestWorkspaceList', () => {
    orchestrator.startInitialSync();

    expect(useSyncStore.getState().workspaceSync).toBe('requesting');
    expect(deps.requestWorkspaceList).toHaveBeenCalledTimes(1);
  });

  // 2. onWorkspaceListReceived 정상 — synced 전이 + 타이머 취소 확인
  it('onWorkspaceListReceived should transition to synced and cancel timer', () => {
    orchestrator.startInitialSync();
    orchestrator.onWorkspaceListReceived(null);

    expect(useSyncStore.getState().workspaceSync).toBe('synced');

    // 타이머가 취소되었으므로 5초 지나도 재시도 없어야 함
    vi.advanceTimersByTime(SyncOrchestrator.TIMEOUT_MS);
    expect(deps.requestWorkspaceList).toHaveBeenCalledTimes(1); // 초기 1회만
  });

  // 3. 타임아웃 재시도 — 5초 후 retryCount 1 + requestWorkspaceList 재호출
  it('should retry on timeout with incremented retryCount', () => {
    orchestrator.startInitialSync();

    vi.advanceTimersByTime(SyncOrchestrator.TIMEOUT_MS);

    expect(useSyncStore.getState().workspaceRetryCount).toBe(1);
    expect(deps.requestWorkspaceList).toHaveBeenCalledTimes(2); // 초기 1 + 재시도 1
  });

  // 4. MAX_RETRIES 초과 — 3회 타임아웃 후 failed
  it('should transition to failed after MAX_RETRIES timeouts', () => {
    orchestrator.startInitialSync(); // 초기 호출 1

    // MAX_RETRIES = 3 → retry 1, 2에서 재시도, 3에서 failed
    for (let i = 0; i < SyncOrchestrator.MAX_RETRIES; i++) {
      vi.advanceTimersByTime(SyncOrchestrator.TIMEOUT_MS);
    }

    expect(useSyncStore.getState().workspaceSync).toBe('failed');
    // 초기 1 + retry 2 (3번째에서 failed로 전환, 재호출 안 함)
    expect(deps.requestWorkspaceList).toHaveBeenCalledTimes(3);
  });

  // 5. selectedEntityId 전달 — synced 후 selectConversation 호출 + phase 'requesting'
  it('should call selectConversation and set conversation phase when entityId provided', () => {
    orchestrator.startInitialSync();
    orchestrator.onWorkspaceListReceived(1001);

    expect(useSyncStore.getState().workspaceSync).toBe('synced');
    expect(deps.selectConversation).toHaveBeenCalledWith(1001);

    const convSync = useSyncStore.getState().getConversationSync(1001);
    expect(convSync?.phase).toBe('requesting');
  });

  // 6. push 방어 — workspaceSync가 'idle'일 때 onWorkspaceListReceived 무시
  it('should ignore onWorkspaceListReceived when workspaceSync is not requesting', () => {
    // idle 상태에서 호출 (startInitialSync 안 함)
    orchestrator.onWorkspaceListReceived(null);

    expect(useSyncStore.getState().workspaceSync).toBe('idle');
    expect(deps.selectConversation).not.toHaveBeenCalled();
  });

  // 7. onHistoryReceived — conversation synced + 범위 업데이트
  it('onHistoryReceived should update conversation sync info with from-to range', () => {
    // 100개 메시지 중 80~100 로드됨
    orchestrator.onHistoryReceived(1001, 80, 100, 100);

    const convSync = useSyncStore.getState().getConversationSync(1001);
    expect(convSync?.phase).toBe('synced');
    expect(convSync?.syncedFrom).toBe(80);
    expect(convSync?.syncedTo).toBe(100);
    expect(convSync?.totalCount).toBe(100);
  });

  // 8. cleanup — 타이머 정리 + resetForReconnect 확인
  it('cleanup should clear timers and reset sync state', () => {
    orchestrator.startInitialSync();
    expect(useSyncStore.getState().workspaceSync).toBe('requesting');

    orchestrator.cleanup();

    expect(useSyncStore.getState().workspaceSync).toBe('idle');

    // 타이머가 정리되었으므로 5초 지나도 재시도 없어야 함
    vi.advanceTimersByTime(SyncOrchestrator.TIMEOUT_MS);
    expect(deps.requestWorkspaceList).toHaveBeenCalledTimes(1); // 초기 1회만
  });

  // 9. 타임아웃 중 응답 도착 — retry 1 이후 응답 → synced + 이후 타이머 무효
  it('should handle response arriving after first timeout retry', () => {
    orchestrator.startInitialSync();

    // 첫 타임아웃 → retry 1
    vi.advanceTimersByTime(SyncOrchestrator.TIMEOUT_MS);
    expect(useSyncStore.getState().workspaceRetryCount).toBe(1);
    expect(deps.requestWorkspaceList).toHaveBeenCalledTimes(2);

    // 응답 도착
    orchestrator.onWorkspaceListReceived(null);
    expect(useSyncStore.getState().workspaceSync).toBe('synced');

    // 이후 타이머는 무효 (재시도 없어야 함)
    vi.advanceTimersByTime(SyncOrchestrator.TIMEOUT_MS);
    expect(deps.requestWorkspaceList).toHaveBeenCalledTimes(2); // 추가 호출 없음
  });
});
