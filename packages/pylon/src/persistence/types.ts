/**
 * @file types.ts
 * @description Persistence 계층 타입 정의
 *
 * 파일 I/O를 추상화하여 테스트 용이성을 확보합니다.
 */

import type { WorkspaceStoreData } from '../stores/workspace-store.js';
import type { SessionData } from '../stores/message-store.js';
import type { ShareStoreData } from '../stores/share-store.js';
import type { AccountType } from '@estelle/core';

/**
 * 저장된 계정 정보
 */
export interface PersistedAccount {
  current: AccountType;
  subscriptionType?: string;
}

/**
 * 영속성 어댑터 인터페이스
 *
 * @description
 * 파일 시스템 I/O를 추상화하는 인터페이스입니다.
 * 실제 구현체(FileSystemPersistence)와 테스트용 인메모리 구현체를 교체할 수 있습니다.
 */
export interface PersistenceAdapter {
  // ============================================================================
  // WorkspaceStore 영속화
  // ============================================================================

  /**
   * WorkspaceStore 데이터 로드
   *
   * @returns 저장된 데이터 또는 undefined (파일 없음)
   */
  loadWorkspaceStore(): WorkspaceStoreData | undefined;

  /**
   * WorkspaceStore 데이터 저장
   *
   * @param data - 저장할 데이터
   */
  saveWorkspaceStore(data: WorkspaceStoreData): Promise<void>;

  // ============================================================================
  // MessageStore 영속화 (세션 단위)
  // ============================================================================

  /**
   * 메시지 세션 데이터 로드
   *
   * @param sessionId - 세션 ID (conversationId)
   * @returns 저장된 세션 데이터 또는 undefined
   */
  loadMessageSession(sessionId: string): SessionData | undefined;

  /**
   * 메시지 세션 데이터 저장
   *
   * @param sessionId - 세션 ID
   * @param data - 저장할 세션 데이터
   */
  saveMessageSession(sessionId: string, data: SessionData): Promise<void>;

  /**
   * 메시지 세션 삭제
   *
   * @param sessionId - 삭제할 세션 ID
   */
  deleteMessageSession(sessionId: string): Promise<void>;

  /**
   * 저장된 모든 세션 ID 목록 조회
   *
   * @returns 세션 ID 배열
   */
  listMessageSessions(): string[];

  // ============================================================================
  // ShareStore 영속화
  // ============================================================================

  /**
   * ShareStore 데이터 로드
   *
   * @returns 저장된 데이터 또는 undefined (파일 없음)
   */
  loadShareStore(): ShareStoreData | undefined;

  /**
   * ShareStore 데이터 저장
   *
   * @param data - 저장할 데이터
   */
  saveShareStore(data: ShareStoreData): Promise<void>;

  // ============================================================================
  // Account 영속화
  // ============================================================================

  /**
   * 마지막 계정 정보 로드
   *
   * @returns 저장된 계정 정보 또는 undefined (파일 없음)
   */
  loadLastAccount(): PersistedAccount | undefined;

  /**
   * 계정 정보 저장
   *
   * @param account - 저장할 계정 정보
   */
  saveLastAccount(account: PersistedAccount): Promise<void>;
}
