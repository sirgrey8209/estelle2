/**
 * @file share-store.test.ts
 * @description ShareStore 테스트
 *
 * 대화 공유 정보(ShareInfo)를 관리하는 ShareStore 클래스를 테스트합니다.
 * - shareId 생성/검증/삭제
 * - conversationId 매핑
 * - JSON 파일 영속 저장
 *
 * @estelle/core의 ShareInfo, generateShareId 활용
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ShareStore,
  type ShareStoreData,
  type ValidateResult,
} from '../../src/stores/share-store.js';
import type { ShareInfo } from '@estelle/core';

describe('ShareStore', () => {
  let store: ShareStore;

  beforeEach(() => {
    store = new ShareStore();
  });

  // ============================================================================
  // 초기화 테스트
  // ============================================================================
  describe('초기화', () => {
    it('should_have_empty_initial_state', () => {
      // Given: 새로운 ShareStore 인스턴스

      // When: 모든 공유 목록 조회
      const shares = store.getAll();

      // Then: 빈 배열
      expect(shares).toHaveLength(0);
    });

    it('should_initialize_from_existing_data', () => {
      // Given: 기존 공유 데이터
      const existingData: ShareStoreData = {
        shares: [
          {
            shareId: 'abc123XYZ789',
            conversationId: 123456,
            createdAt: 1700000000000,
            accessCount: 5,
          },
        ],
      };

      // When: 기존 데이터로 초기화
      const loadedStore = new ShareStore(existingData);

      // Then: 데이터 복원됨
      expect(loadedStore.getAll()).toHaveLength(1);
      const share = loadedStore.getAll()[0];
      expect(share.shareId).toBe('abc123XYZ789');
      expect(share.conversationId).toBe(123456);
      expect(share.accessCount).toBe(5);
    });
  });

  // ============================================================================
  // create() 테스트
  // ============================================================================
  describe('create', () => {
    it('should_create_share_with_valid_shareId_when_conversationId_provided', () => {
      // Given: conversationId
      const conversationId = 12345;

      // When: 공유 생성
      const shareInfo = store.create(conversationId);

      // Then: 유효한 ShareInfo 반환
      expect(shareInfo).toBeDefined();
      expect(shareInfo.conversationId).toBe(conversationId);
      expect(shareInfo.shareId).toHaveLength(12);
      expect(shareInfo.accessCount).toBe(0);
      expect(shareInfo.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it('should_generate_unique_shareIds_for_multiple_creates', () => {
      // Given: 여러 conversationId
      const conversationId1 = 111;
      const conversationId2 = 222;

      // When: 여러 공유 생성
      const share1 = store.create(conversationId1);
      const share2 = store.create(conversationId2);

      // Then: 서로 다른 shareId
      expect(share1.shareId).not.toBe(share2.shareId);
    });

    it('should_add_share_to_store_when_created', () => {
      // Given: conversationId
      const conversationId = 42;

      // When: 공유 생성
      store.create(conversationId);

      // Then: store에 추가됨
      expect(store.getAll()).toHaveLength(1);
    });

    it('should_replace_existing_share_when_same_conversationId', () => {
      // Given: 동일한 conversationId로 이미 공유 생성됨
      const conversationId = 100;
      const firstShare = store.create(conversationId);

      // When: 같은 conversationId로 다시 생성
      const secondShare = store.create(conversationId);

      // Then: 기존 공유 대체됨 (중복 없음)
      expect(store.getAll()).toHaveLength(1);
      expect(secondShare.shareId).not.toBe(firstShare.shareId);
    });

    it('should_generate_base62_shareId', () => {
      // Given/When: 공유 생성
      const share = store.create(1);

      // Then: Base62 문자만 포함 (a-z, A-Z, 0-9)
      expect(share.shareId).toMatch(/^[a-zA-Z0-9]{12}$/);
    });
  });

  // ============================================================================
  // validate() 테스트
  // ============================================================================
  describe('validate', () => {
    it('should_return_valid_true_when_shareId_exists', () => {
      // Given: 공유 생성됨
      const conversationId = 42;
      const share = store.create(conversationId);

      // When: 유효성 검증
      const result = store.validate(share.shareId);

      // Then: valid = true, conversationId와 shareId 포함
      expect(result.valid).toBe(true);
      expect(result.conversationId).toBe(conversationId);
      expect(result.shareId).toBe(share.shareId);
    });

    it('should_return_valid_false_when_shareId_not_exists', () => {
      // Given: 존재하지 않는 shareId

      // When: 유효성 검증
      const result = store.validate('nonexistent123');

      // Then: valid = false, conversationId/shareId 없음
      expect(result.valid).toBe(false);
      expect(result.conversationId).toBeUndefined();
      expect(result.shareId).toBeUndefined();
    });

    it('should_return_valid_false_when_shareId_is_empty', () => {
      // Given: 빈 shareId

      // When: 유효성 검증
      const result = store.validate('');

      // Then: valid = false
      expect(result.valid).toBe(false);
    });

    it('should_return_valid_false_when_shareId_is_wrong_length', () => {
      // Given: 길이가 잘못된 shareId
      store.create(1); // 최소 하나의 공유가 있어야 함

      // When: 짧은 shareId로 검증
      const result = store.validate('short');

      // Then: valid = false
      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // delete() 테스트
  // ============================================================================
  describe('delete', () => {
    it('should_return_true_when_share_deleted_successfully', () => {
      // Given: 공유 생성됨
      const share = store.create(42);

      // When: 삭제
      const result = store.delete(share.shareId);

      // Then: true 반환
      expect(result).toBe(true);
    });

    it('should_remove_share_from_store_when_deleted', () => {
      // Given: 공유 생성됨
      const share = store.create(42);

      // When: 삭제
      store.delete(share.shareId);

      // Then: store에서 제거됨
      expect(store.getAll()).toHaveLength(0);
      expect(store.validate(share.shareId).valid).toBe(false);
    });

    it('should_return_false_when_shareId_not_exists', () => {
      // Given: 존재하지 않는 shareId

      // When: 삭제 시도
      const result = store.delete('nonexistent123');

      // Then: false 반환
      expect(result).toBe(false);
    });

    it('should_only_delete_specified_share_when_multiple_exist', () => {
      // Given: 여러 공유 생성
      const share1 = store.create(1);
      const share2 = store.create(2);
      const share3 = store.create(3);

      // When: 하나만 삭제
      store.delete(share2.shareId);

      // Then: 삭제한 것만 제거, 나머지는 유지
      expect(store.getAll()).toHaveLength(2);
      expect(store.validate(share1.shareId).valid).toBe(true);
      expect(store.validate(share2.shareId).valid).toBe(false);
      expect(store.validate(share3.shareId).valid).toBe(true);
    });
  });

  // ============================================================================
  // getByConversation() 테스트
  // ============================================================================
  describe('getByConversation', () => {
    it('should_return_shareInfo_when_conversation_has_share', () => {
      // Given: 공유 생성됨
      const conversationId = 42;
      const created = store.create(conversationId);

      // When: conversationId로 조회
      const result = store.getByConversation(conversationId);

      // Then: ShareInfo 반환
      expect(result).not.toBeNull();
      expect(result?.shareId).toBe(created.shareId);
      expect(result?.conversationId).toBe(conversationId);
    });

    it('should_return_null_when_conversation_has_no_share', () => {
      // Given: 공유 없음

      // When: 존재하지 않는 conversationId로 조회
      const result = store.getByConversation(999);

      // Then: null 반환
      expect(result).toBeNull();
    });

    it('should_return_latest_share_when_conversation_recreated', () => {
      // Given: 공유 생성 후 재생성
      const conversationId = 42;
      store.create(conversationId);
      const latest = store.create(conversationId);

      // When: conversationId로 조회
      const result = store.getByConversation(conversationId);

      // Then: 최신 공유 반환
      expect(result?.shareId).toBe(latest.shareId);
    });
  });

  // ============================================================================
  // incrementAccessCount() 테스트
  // ============================================================================
  describe('incrementAccessCount', () => {
    it('should_increment_count_and_return_true_when_shareId_exists', () => {
      // Given: 공유 생성됨 (accessCount = 0)
      const share = store.create(42);
      expect(share.accessCount).toBe(0);

      // When: 접근 횟수 증가
      const result = store.incrementAccessCount(share.shareId);

      // Then: true 반환, count 증가
      expect(result).toBe(true);
      const updated = store.getByConversation(42);
      expect(updated?.accessCount).toBe(1);
    });

    it('should_increment_multiple_times', () => {
      // Given: 공유 생성됨
      const share = store.create(42);

      // When: 여러 번 증가
      store.incrementAccessCount(share.shareId);
      store.incrementAccessCount(share.shareId);
      store.incrementAccessCount(share.shareId);

      // Then: 정확히 3 증가
      const updated = store.getByConversation(42);
      expect(updated?.accessCount).toBe(3);
    });

    it('should_return_false_when_shareId_not_exists', () => {
      // Given: 존재하지 않는 shareId

      // When: 접근 횟수 증가 시도
      const result = store.incrementAccessCount('nonexistent123');

      // Then: false 반환
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // getAll() 테스트
  // ============================================================================
  describe('getAll', () => {
    it('should_return_empty_array_when_no_shares', () => {
      // Given: 빈 store

      // When: 전체 조회
      const result = store.getAll();

      // Then: 빈 배열
      expect(result).toEqual([]);
    });

    it('should_return_all_shares', () => {
      // Given: 여러 공유 생성
      store.create(1);
      store.create(2);
      store.create(3);

      // When: 전체 조회
      const result = store.getAll();

      // Then: 3개 반환
      expect(result).toHaveLength(3);
    });

    it('should_return_defensive_copy', () => {
      // Given: 공유 생성됨
      store.create(1);

      // When: 전체 조회 후 수정 시도
      const result = store.getAll();
      result.push({
        shareId: 'hacked123456',
        conversationId: 999,
        createdAt: Date.now(),
        accessCount: 0,
      });

      // Then: 원본 영향 없음
      expect(store.getAll()).toHaveLength(1);
    });
  });

  // ============================================================================
  // toJSON() / fromJSON() 테스트 (영속화)
  // ============================================================================
  describe('직렬화', () => {
    describe('toJSON', () => {
      it('should_export_empty_data_when_no_shares', () => {
        // Given: 빈 store

        // When: JSON export
        const data = store.toJSON();

        // Then: 빈 shares 배열
        expect(data.shares).toEqual([]);
      });

      it('should_export_all_shares_with_correct_structure', () => {
        // Given: 공유 생성됨
        const share = store.create(42);

        // When: JSON export
        const data = store.toJSON();

        // Then: 올바른 구조
        expect(data.shares).toHaveLength(1);
        expect(data.shares[0]).toEqual({
          shareId: share.shareId,
          conversationId: 42,
          createdAt: share.createdAt,
          accessCount: 0,
        });
      });
    });

    describe('fromJSON', () => {
      it('should_create_store_from_empty_data', () => {
        // Given: 빈 데이터
        const emptyData: ShareStoreData = { shares: [] };

        // When: fromJSON
        const restored = ShareStore.fromJSON(emptyData);

        // Then: 빈 store
        expect(restored.getAll()).toHaveLength(0);
      });

      it('should_restore_all_shares_from_data', () => {
        // Given: 공유 데이터
        const data: ShareStoreData = {
          shares: [
            {
              shareId: 'share1ABCDEF',
              conversationId: 1,
              createdAt: 1000,
              accessCount: 10,
            },
            {
              shareId: 'share2GHIJKL',
              conversationId: 2,
              createdAt: 2000,
              accessCount: 20,
            },
          ],
        };

        // When: fromJSON
        const restored = ShareStore.fromJSON(data);

        // Then: 모든 데이터 복원
        expect(restored.getAll()).toHaveLength(2);
        expect(restored.validate('share1ABCDEF').valid).toBe(true);
        expect(restored.validate('share2GHIJKL').valid).toBe(true);
      });

      it('should_preserve_accessCount_after_restore', () => {
        // Given: accessCount가 있는 데이터
        const data: ShareStoreData = {
          shares: [
            {
              shareId: 'testShare1234',
              conversationId: 42,
              createdAt: 1000,
              accessCount: 100,
            },
          ],
        };

        // When: fromJSON
        const restored = ShareStore.fromJSON(data);

        // Then: accessCount 유지
        const share = restored.getByConversation(42);
        expect(share?.accessCount).toBe(100);
      });
    });

    describe('toJSON-fromJSON 왕복', () => {
      it('should_preserve_all_data_through_serialization_cycle', () => {
        // Given: 여러 공유 생성 및 조작
        store.create(1);
        const share2 = store.create(2);
        store.create(3);
        store.incrementAccessCount(share2.shareId);
        store.incrementAccessCount(share2.shareId);

        // When: 직렬화 후 복원
        const exported = store.toJSON();
        const restored = ShareStore.fromJSON(exported);

        // Then: 모든 데이터 동일
        expect(restored.getAll()).toHaveLength(3);
        const restoredShare2 = restored.getByConversation(2);
        expect(restoredShare2?.accessCount).toBe(2);
      });
    });
  });

  // ============================================================================
  // 엣지 케이스 테스트
  // ============================================================================
  describe('엣지 케이스', () => {
    it('should_handle_conversationId_zero', () => {
      // Given: conversationId = 0

      // When: 공유 생성
      const share = store.create(0);

      // Then: 정상 생성됨
      expect(share.conversationId).toBe(0);
      expect(store.getByConversation(0)).not.toBeNull();
    });

    it('should_handle_negative_conversationId', () => {
      // Given: 음수 conversationId

      // When: 공유 생성
      const share = store.create(-1);

      // Then: 정상 생성됨 (유효성 검사는 호출자 책임)
      expect(share.conversationId).toBe(-1);
    });

    it('should_handle_large_conversationId', () => {
      // Given: 큰 conversationId
      const largeId = Number.MAX_SAFE_INTEGER;

      // When: 공유 생성
      const share = store.create(largeId);

      // Then: 정상 생성됨
      expect(share.conversationId).toBe(largeId);
    });

    it('should_handle_fromJSON_with_invalid_data_gracefully', () => {
      // Given: 잘못된 데이터 (타입 에러 방지를 위해 any 캐스팅)
      const invalidData = { shares: null } as unknown as ShareStoreData;

      // When/Then: 에러 발생 또는 빈 store 반환 (구현에 따라)
      // 최소한 크래시하지 않아야 함
      expect(() => ShareStore.fromJSON(invalidData)).not.toThrow();
    });

    it('should_handle_fromJSON_with_malformed_share_entry', () => {
      // Given: 일부 필드 누락된 데이터
      const malformedData = {
        shares: [
          { shareId: 'test12345678' }, // conversationId 누락
        ],
      } as unknown as ShareStoreData;

      // When/Then: 에러 발생하지 않음
      expect(() => ShareStore.fromJSON(malformedData)).not.toThrow();
    });
  });
});
