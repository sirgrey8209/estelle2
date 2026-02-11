/**
 * @file syncOrchestrator.ts
 * @description 초기 동기화 조율 + 재시도 로직
 *
 * 연결 후 workspace 목록 요청 → 응답 대기 → 대화 선택 → 히스토리 수신까지의
 * 동기화 흐름을 관리합니다.
 *
 * Cycle 2: 구조만 신설, 실제 연결(App.tsx 등)은 Cycle 3에서 진행
 */

import { useSyncStore } from '../stores/syncStore';
import { requestWorkspaceList, selectConversation } from './relaySender';

// ============================================================================
// Types
// ============================================================================

export interface SyncDeps {
  requestWorkspaceList: () => boolean;
  selectConversation: (entityId: number) => boolean;
}

// ============================================================================
// SyncOrchestrator
// ============================================================================

export class SyncOrchestrator {
  static readonly TIMEOUT_MS = 5000;
  static readonly MAX_RETRIES = 3;

  private workspaceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private deps: SyncDeps) {}

  /**
   * 초기 동기화 시작
   * workspace 목록 요청 + 타임아웃 타이머 설정
   */
  startInitialSync(): void {
    const syncStore = useSyncStore.getState();
    syncStore.setWorkspaceSync('requesting');

    this.deps.requestWorkspaceList();
    this.startWorkspaceTimer();
  }

  /**
   * workspace 목록 수신 처리
   * requesting 상태일 때만 동작 (push 방어)
   */
  onWorkspaceListReceived(selectedEntityId: number | null): void {
    const syncStore = useSyncStore.getState();
    if (syncStore.workspaceSync !== 'requesting') return;

    this.clearWorkspaceTimer();
    syncStore.setWorkspaceSync('synced');

    if (selectedEntityId !== null) {
      syncStore.setConversationPhase(selectedEntityId, 'requesting');
      this.deps.selectConversation(selectedEntityId);
    }
  }

  /**
   * 히스토리 수신 처리
   * 현재는 useMessageRouter에서 직접 syncStore를 업데이트하므로,
   * 이 메서드는 추가적인 조율이 필요할 때만 사용
   */
  onHistoryReceived(entityId: number, syncedFrom: number, syncedTo: number, totalCount: number): void {
    const syncStore = useSyncStore.getState();
    syncStore.setConversationSync(entityId, syncedFrom, syncedTo, totalCount);
    syncStore.setConversationPhase(entityId, 'synced');
  }

  /**
   * 정리 (연결 해제 시)
   * 타이머 정리 + syncStore 리셋
   */
  cleanup(): void {
    this.clearWorkspaceTimer();
    useSyncStore.getState().resetForReconnect();
  }

  // === Private ===

  private startWorkspaceTimer(): void {
    this.clearWorkspaceTimer();
    this.workspaceTimer = setTimeout(() => {
      this.handleWorkspaceTimeout();
    }, SyncOrchestrator.TIMEOUT_MS);
  }

  private clearWorkspaceTimer(): void {
    if (this.workspaceTimer !== null) {
      clearTimeout(this.workspaceTimer);
      this.workspaceTimer = null;
    }
  }

  private handleWorkspaceTimeout(): void {
    const syncStore = useSyncStore.getState();
    if (syncStore.workspaceSync !== 'requesting') return;

    syncStore.incrementWorkspaceRetry();

    const { workspaceRetryCount } = useSyncStore.getState();
    if (workspaceRetryCount >= SyncOrchestrator.MAX_RETRIES) {
      syncStore.setWorkspaceSync('failed');
      return;
    }

    this.deps.requestWorkspaceList();
    this.startWorkspaceTimer();
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const syncOrchestrator = new SyncOrchestrator({
  requestWorkspaceList,
  selectConversation,
});
