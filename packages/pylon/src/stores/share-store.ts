/**
 * @file share-store.ts
 * @description ShareStore - 대화 공유 정보 영속 저장
 *
 * 대화 공유 링크 정보(ShareInfo)를 관리하는 순수 데이터 클래스입니다.
 * 파일 I/O는 외부에서 처리하여 테스트 용이성을 확보합니다.
 *
 * @estelle/core의 ShareInfo, generateShareId 활용
 */

import { generateShareId, type ShareInfo } from '@estelle/core';

// ============================================================================
// 상수
// ============================================================================

/** 공유 ID 길이 (Base62 12자리) */
const SHARE_ID_LENGTH = 12;

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 공유 스토어 데이터 (직렬화용)
 */
export interface ShareStoreData {
  /** 모든 공유 정보 목록 */
  shares: ShareInfo[];
}

/**
 * 공유 유효성 검증 결과
 */
export interface ValidateResult {
  /** 유효한 공유인지 여부 */
  valid: boolean;

  /** 유효한 경우 대화 ID */
  conversationId?: number;

  /** 유효한 경우 공유 ID */
  shareId?: string;
}

// ============================================================================
// ShareStore 클래스
// ============================================================================

/**
 * ShareStore - 대화 공유 정보 관리
 *
 * @description
 * 대화 공유 링크 정보를 관리하는 순수 데이터 클래스입니다.
 * 하나의 conversationId에 대해 하나의 공유만 유지합니다.
 * (재생성 시 기존 공유는 대체됨)
 */
export class ShareStore {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /** shareId → ShareInfo 매핑 */
  private _sharesByShareId: Map<string, ShareInfo>;

  /** conversationId → ShareInfo 매핑 */
  private _sharesByConversationId: Map<number, ShareInfo>;

  // ============================================================================
  // 생성자
  // ============================================================================

  /**
   * ShareStore 생성자
   *
   * @param data - 기존 데이터 (직렬화된 상태)
   */
  constructor(data?: ShareStoreData) {
    this._sharesByShareId = new Map();
    this._sharesByConversationId = new Map();

    if (data?.shares && Array.isArray(data.shares)) {
      for (const share of data.shares) {
        // 필수 필드 검증 (malformed 데이터 방어)
        if (this.isValidShareInfo(share)) {
          this._sharesByShareId.set(share.shareId, share);
          this._sharesByConversationId.set(share.conversationId, share);
        }
      }
    }
  }

  // ============================================================================
  // 정적 팩토리 메서드
  // ============================================================================

  /**
   * JSON 데이터로부터 ShareStore 생성
   *
   * @param data - 직렬화된 데이터
   */
  static fromJSON(data: ShareStoreData): ShareStore {
    return new ShareStore(data);
  }

  // ============================================================================
  // 직렬화
  // ============================================================================

  /**
   * 직렬화용 JSON 데이터 반환
   */
  toJSON(): ShareStoreData {
    return {
      shares: Array.from(this._sharesByShareId.values()),
    };
  }

  // ============================================================================
  // Private 헬퍼
  // ============================================================================

  /**
   * ShareInfo 객체의 유효성 검사 (런타임 타입 검증)
   */
  private isValidShareInfo(value: unknown): value is ShareInfo {
    if (value === null || value === undefined || typeof value !== 'object') {
      return false;
    }

    const obj = value as Record<string, unknown>;
    return (
      typeof obj.shareId === 'string' &&
      typeof obj.conversationId === 'number' &&
      typeof obj.createdAt === 'number' &&
      typeof obj.accessCount === 'number'
    );
  }

  // ============================================================================
  // 공유 생성
  // ============================================================================

  /**
   * 새 공유 생성
   *
   * @param conversationId - 대화 ID
   * @returns 생성된 ShareInfo
   *
   * @remarks
   * 동일한 conversationId로 이미 공유가 존재하면 기존 공유를 대체합니다.
   */
  create(conversationId: number): ShareInfo {
    // 기존 공유가 있으면 제거
    const existing = this._sharesByConversationId.get(conversationId);
    if (existing) {
      this._sharesByShareId.delete(existing.shareId);
      this._sharesByConversationId.delete(conversationId);
    }

    // 새 공유 생성
    const shareInfo: ShareInfo = {
      shareId: generateShareId(),
      conversationId,
      createdAt: Date.now(),
      accessCount: 0,
    };

    // 맵에 추가
    this._sharesByShareId.set(shareInfo.shareId, shareInfo);
    this._sharesByConversationId.set(conversationId, shareInfo);

    return shareInfo;
  }

  // ============================================================================
  // 공유 검증
  // ============================================================================

  /**
   * 공유 ID 유효성 검증
   *
   * @param shareId - 검증할 공유 ID
   * @returns 검증 결과
   */
  validate(shareId: string): ValidateResult {
    // 빈 문자열 또는 길이 불일치
    if (!shareId || shareId.length !== SHARE_ID_LENGTH) {
      return { valid: false };
    }

    // 맵에서 조회
    const share = this._sharesByShareId.get(shareId);
    if (!share) {
      return { valid: false };
    }

    return {
      valid: true,
      conversationId: share.conversationId,
      shareId: share.shareId,
    };
  }

  // ============================================================================
  // 공유 삭제
  // ============================================================================

  /**
   * 공유 삭제
   *
   * @param shareId - 삭제할 공유 ID
   * @returns 삭제 성공 여부
   */
  delete(shareId: string): boolean {
    const share = this._sharesByShareId.get(shareId);
    if (!share) {
      return false;
    }

    this._sharesByShareId.delete(shareId);
    this._sharesByConversationId.delete(share.conversationId);

    return true;
  }

  // ============================================================================
  // 공유 조회
  // ============================================================================

  /**
   * conversationId로 공유 조회
   *
   * @param conversationId - 대화 ID
   * @returns ShareInfo 또는 null
   */
  getByConversation(conversationId: number): ShareInfo | null {
    return this._sharesByConversationId.get(conversationId) ?? null;
  }

  /**
   * 모든 공유 목록 조회
   *
   * @returns 모든 공유 정보 배열 (방어적 복사본)
   */
  getAll(): ShareInfo[] {
    return Array.from(this._sharesByShareId.values());
  }

  // ============================================================================
  // 접근 횟수 증가
  // ============================================================================

  /**
   * 공유 접근 횟수 증가
   *
   * @param shareId - 공유 ID
   * @returns 성공 여부
   */
  incrementAccessCount(shareId: string): boolean {
    const share = this._sharesByShareId.get(shareId);
    if (!share) {
      return false;
    }

    share.accessCount += 1;
    return true;
  }
}
