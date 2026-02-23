/**
 * @file in-memory-persistence.ts
 * @description 테스트용 InMemory Persistence 어댑터
 *
 * 파일 I/O 없이 메모리에서 데이터를 저장/조회합니다.
 * E2E Mock 테스트에서 Pylon의 상태 저장 동작을 검증할 때 사용합니다.
 *
 * @example
 * ```typescript
 * import { InMemoryPersistence } from './persistence/in-memory-persistence.js';
 * import { Pylon } from './pylon.js';
 *
 * const persistence = new InMemoryPersistence();
 *
 * // 초기 데이터 설정 (선택)
 * persistence.setWorkspaceStore({
 *   activeWorkspaceId: 'ws-1',
 *   activeConversationId: 'conv-1',
 *   workspaces: [...],
 * });
 *
 * const pylon = new Pylon({ persistence });
 * ```
 */

import type { PersistenceAdapter, PersistedAccount } from './types.js';
import type { WorkspaceStoreData } from '../stores/workspace-store.js';
import type { SessionData } from '../stores/message-store.js';
import type { ShareStoreData } from '../stores/share-store.js';

/**
 * InMemory Persistence 어댑터
 *
 * 테스트에서 파일 시스템 없이 영속성 동작을 시뮬레이션합니다.
 */
export class InMemoryPersistence implements PersistenceAdapter {
  private workspaceData?: WorkspaceStoreData;
  private shareData?: ShareStoreData;
  private accountData?: PersistedAccount;
  private sessions = new Map<string, SessionData>();

  // ============================================================================
  // WorkspaceStore 영속화
  // ============================================================================

  /**
   * WorkspaceStore 데이터 로드
   */
  loadWorkspaceStore(): WorkspaceStoreData | undefined {
    return this.workspaceData;
  }

  /**
   * WorkspaceStore 데이터 저장
   */
  async saveWorkspaceStore(data: WorkspaceStoreData): Promise<void> {
    // 깊은 복사로 저장 (외부 수정 방지)
    this.workspaceData = JSON.parse(JSON.stringify(data));
  }

  // ============================================================================
  // MessageStore 영속화 (세션 단위)
  // ============================================================================

  /**
   * 메시지 세션 데이터 로드
   */
  loadMessageSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 메시지 세션 데이터 저장
   */
  async saveMessageSession(sessionId: string, data: SessionData): Promise<void> {
    // 깊은 복사로 저장
    this.sessions.set(sessionId, JSON.parse(JSON.stringify(data)));
  }

  /**
   * 메시지 세션 삭제
   */
  async deleteMessageSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  /**
   * 저장된 모든 세션 ID 목록 조회
   */
  listMessageSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  // ============================================================================
  // ShareStore 영속화
  // ============================================================================

  /**
   * ShareStore 데이터 로드
   */
  loadShareStore(): ShareStoreData | undefined {
    return this.shareData;
  }

  /**
   * ShareStore 데이터 저장
   */
  async saveShareStore(data: ShareStoreData): Promise<void> {
    // 깊은 복사로 저장 (외부 수정 방지)
    this.shareData = JSON.parse(JSON.stringify(data));
  }

  // ============================================================================
  // Account 영속화
  // ============================================================================

  /**
   * 마지막 계정 정보 로드
   */
  loadLastAccount(): PersistedAccount | undefined {
    return this.accountData;
  }

  /**
   * 계정 정보 저장
   */
  async saveLastAccount(account: PersistedAccount): Promise<void> {
    // 깊은 복사로 저장 (외부 수정 방지)
    this.accountData = JSON.parse(JSON.stringify(account));
  }

  // ============================================================================
  // 테스트 헬퍼 메서드
  // ============================================================================

  /**
   * WorkspaceStore 데이터 직접 설정 (테스트용)
   */
  setWorkspaceStore(data: WorkspaceStoreData): void {
    this.workspaceData = JSON.parse(JSON.stringify(data));
  }

  /**
   * 세션 데이터 직접 설정 (테스트용)
   */
  setMessageSession(sessionId: string, data: SessionData): void {
    this.sessions.set(sessionId, JSON.parse(JSON.stringify(data)));
  }

  /**
   * ShareStore 데이터 직접 설정 (테스트용)
   */
  setShareStore(data: ShareStoreData): void {
    this.shareData = JSON.parse(JSON.stringify(data));
  }

  /**
   * Account 데이터 직접 설정 (테스트용)
   */
  setLastAccount(account: PersistedAccount): void {
    this.accountData = JSON.parse(JSON.stringify(account));
  }

  /**
   * 모든 데이터 초기화 (테스트용)
   */
  clear(): void {
    this.workspaceData = undefined;
    this.shareData = undefined;
    this.accountData = undefined;
    this.sessions.clear();
  }

  /**
   * 현재 저장된 세션 수 반환 (테스트용)
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * WorkspaceStore 데이터 존재 여부 (테스트용)
   */
  hasWorkspaceStore(): boolean {
    return this.workspaceData !== undefined;
  }
}
