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

  // 5. selectedConversationId 전달 — synced 후 selectConversation 호출 + phase 'requesting'
  it('should call selectConversation and set conversation phase when conversationId provided', () => {
    orchestrator.startInitialSync();
    orchestrator.onWorkspaceListReceived(1001);

    expect(useSyncStore.getState().workspaceSync).toBe('synced');
    expect(deps.selectConversation).toHaveBeenCalledWith(1001);

    const convSync = useSyncStore.getState().getConversationSync(1001);
    expect(convSync?.phase).toBe('requesting');
  });

  // 6. idle 상태에서도 동작 — full refresh 시 race condition 해결
  it('should handle onWorkspaceListReceived when workspaceSync is idle (race condition)', () => {
    // idle 상태에서 호출 (startInitialSync 안 함 - workspace_list_result가 auth_result보다 먼저 도착)
    orchestrator.onWorkspaceListReceived(1001);

    // idle → synced로 전환되어야 함
    expect(useSyncStore.getState().workspaceSync).toBe('synced');
    expect(deps.selectConversation).toHaveBeenCalledWith(1001);
  });

  // 6-2. push 방어 — workspaceSync가 'synced'일 때 onWorkspaceListReceived 무시
  it('should ignore onWorkspaceListReceived when workspaceSync is already synced', () => {
    orchestrator.startInitialSync();
    orchestrator.onWorkspaceListReceived(1001);
    expect(useSyncStore.getState().workspaceSync).toBe('synced');

    // 이미 synced 상태에서 다시 호출 → 무시
    orchestrator.onWorkspaceListReceived(2002);

    // 첫 번째 호출의 대화만 선택되어야 함
    expect(deps.selectConversation).toHaveBeenCalledTimes(1);
    expect(deps.selectConversation).toHaveBeenCalledWith(1001);
  });

  // 6-3. failed 복구 — workspaceSync가 'failed'일 때 onWorkspaceListReceived로 synced 복구
  it('should recover from failed state when workspace list received', () => {
    orchestrator.startInitialSync();

    // MAX_RETRIES 초과하여 failed 상태로
    for (let i = 0; i < SyncOrchestrator.MAX_RETRIES; i++) {
      vi.advanceTimersByTime(SyncOrchestrator.TIMEOUT_MS);
    }
    expect(useSyncStore.getState().workspaceSync).toBe('failed');

    // Pylon이 늦게 연결되어 workspace_list_result 수신
    orchestrator.onWorkspaceListReceived(1001);

    // failed → synced로 복구되어야 함
    expect(useSyncStore.getState().workspaceSync).toBe('synced');
    expect(deps.selectConversation).toHaveBeenCalledWith(1001);
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
