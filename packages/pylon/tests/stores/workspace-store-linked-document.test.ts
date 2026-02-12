/**
 * @file workspace-store-linked-document.test.ts
 * @description LinkedDocument 기능 테스트
 *
 * 대화(Conversation)에 문서를 연결/해제하고 조회하는 WorkspaceStore 메서드 테스트.
 *
 * 테스트 케이스:
 * - linkDocument: 문서 연결
 * - unlinkDocument: 문서 해제
 * - getLinkedDocuments: 연결된 문서 목록 조회
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceStore } from '../../src/stores/workspace-store.js';
import { encodeConversationId } from '@estelle/core';
import type { ConversationId, LinkedDocument } from '@estelle/core';

const PYLON_ID = 1;

describe('WorkspaceStore - LinkedDocument', () => {
  let store: WorkspaceStore;
  let conversationId: ConversationId;
  let workspaceId: number;

  beforeEach(() => {
    store = new WorkspaceStore(PYLON_ID);
    const { workspace } = store.createWorkspace('Test', 'C:\\test');
    workspaceId = workspace.workspaceId;
    const conversation = store.createConversation(workspaceId)!;
    conversationId = conversation.conversationId;
  });

  // ============================================================================
  // linkDocument 테스트
  // ============================================================================
  describe('linkDocument', () => {
    // 정상 케이스
    it('should_link_document_when_valid_path_provided', () => {
      // Arrange
      const path = 'src\\app.ts';

      // Act
      const result = store.linkDocument(conversationId, path);

      // Assert
      expect(result).toBe(true);
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs).toHaveLength(1);
      expect(docs[0].path).toBe(path);
    });

    it('should_set_addedAt_timestamp_when_linking_document', () => {
      // Arrange
      const path = 'readme.md';
      const beforeTime = Date.now();

      // Act
      store.linkDocument(conversationId, path);

      // Assert
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs[0].addedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(docs[0].addedAt).toBeLessThanOrEqual(Date.now());
    });

    it('should_link_multiple_documents_to_same_conversation', () => {
      // Arrange
      const paths = ['src\\a.ts', 'src\\b.ts', 'docs\\readme.md'];

      // Act
      paths.forEach((p) => store.linkDocument(conversationId, p));

      // Assert
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs).toHaveLength(3);
      expect(docs.map((d) => d.path)).toEqual(expect.arrayContaining(paths));
    });

    it('should_normalize_forward_slashes_to_backslashes', () => {
      // Arrange
      const inputPath = 'src/components/Header.tsx';
      const expectedPath = 'src\\components\\Header.tsx';

      // Act
      store.linkDocument(conversationId, inputPath);

      // Assert
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs[0].path).toBe(expectedPath);
    });

    // 중복 처리 케이스
    it('should_ignore_duplicate_path_when_already_linked', () => {
      // Arrange
      const path = 'src\\app.ts';
      store.linkDocument(conversationId, path);
      const docsBefore = store.getLinkedDocuments(conversationId);
      const originalAddedAt = docsBefore[0].addedAt;

      // Act - 잠시 대기 후 재연결 시도
      const result = store.linkDocument(conversationId, path);

      // Assert
      expect(result).toBe(false); // 중복이므로 false 반환
      const docsAfter = store.getLinkedDocuments(conversationId);
      expect(docsAfter).toHaveLength(1);
      expect(docsAfter[0].addedAt).toBe(originalAddedAt); // addedAt 갱신 안 함
    });

    it('should_treat_same_path_with_different_slashes_as_duplicate', () => {
      // Arrange
      store.linkDocument(conversationId, 'src\\app.ts');

      // Act
      const result = store.linkDocument(conversationId, 'src/app.ts');

      // Assert
      expect(result).toBe(false);
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs).toHaveLength(1);
    });

    // 에러 케이스
    it('should_return_false_when_conversation_not_found', () => {
      // Arrange
      const fakeConversationId = encodeConversationId(PYLON_ID, workspaceId, 999);

      // Act
      const result = store.linkDocument(fakeConversationId, 'test.ts');

      // Assert
      expect(result).toBe(false);
    });

    // 엣지 케이스
    it('should_handle_empty_path', () => {
      // Arrange
      const emptyPath = '';

      // Act
      const result = store.linkDocument(conversationId, emptyPath);

      // Assert
      expect(result).toBe(false);
    });

    it('should_handle_path_with_only_whitespace', () => {
      // Arrange
      const whitespacePath = '   ';

      // Act
      const result = store.linkDocument(conversationId, whitespacePath);

      // Assert
      expect(result).toBe(false);
    });

    it('should_trim_whitespace_from_path', () => {
      // Arrange
      const pathWithSpaces = '  src\\app.ts  ';
      const expectedPath = 'src\\app.ts';

      // Act
      store.linkDocument(conversationId, pathWithSpaces);

      // Assert
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs[0].path).toBe(expectedPath);
    });
  });

  // ============================================================================
  // unlinkDocument 테스트
  // ============================================================================
  describe('unlinkDocument', () => {
    // 정상 케이스
    it('should_unlink_document_when_path_exists', () => {
      // Arrange
      const path = 'src\\app.ts';
      store.linkDocument(conversationId, path);

      // Act
      const result = store.unlinkDocument(conversationId, path);

      // Assert
      expect(result).toBe(true);
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs).toHaveLength(0);
    });

    it('should_unlink_only_specified_document', () => {
      // Arrange
      store.linkDocument(conversationId, 'src\\a.ts');
      store.linkDocument(conversationId, 'src\\b.ts');
      store.linkDocument(conversationId, 'src\\c.ts');

      // Act
      store.unlinkDocument(conversationId, 'src\\b.ts');

      // Assert
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.path)).toEqual(['src\\a.ts', 'src\\c.ts']);
    });

    it('should_normalize_forward_slashes_when_unlinking', () => {
      // Arrange
      store.linkDocument(conversationId, 'src\\app.ts');

      // Act - 슬래시 형태로 해제 시도
      const result = store.unlinkDocument(conversationId, 'src/app.ts');

      // Assert
      expect(result).toBe(true);
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs).toHaveLength(0);
    });

    // 에러 케이스
    it('should_return_false_when_path_not_found', () => {
      // Arrange
      store.linkDocument(conversationId, 'src\\a.ts');

      // Act
      const result = store.unlinkDocument(conversationId, 'src\\nonexistent.ts');

      // Assert
      expect(result).toBe(false);
    });

    it('should_return_false_when_conversation_not_found', () => {
      // Arrange
      const fakeConversationId = encodeConversationId(PYLON_ID, workspaceId, 999);

      // Act
      const result = store.unlinkDocument(fakeConversationId, 'test.ts');

      // Assert
      expect(result).toBe(false);
    });

    // 엣지 케이스
    it('should_return_false_when_no_linked_documents', () => {
      // Act - 아무것도 연결되지 않은 상태에서 해제 시도
      const result = store.unlinkDocument(conversationId, 'test.ts');

      // Assert
      expect(result).toBe(false);
    });

    it('should_handle_empty_path_on_unlink', () => {
      // Act
      const result = store.unlinkDocument(conversationId, '');

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // getLinkedDocuments 테스트
  // ============================================================================
  describe('getLinkedDocuments', () => {
    // 정상 케이스
    it('should_return_all_linked_documents', () => {
      // Arrange
      store.linkDocument(conversationId, 'src\\a.ts');
      store.linkDocument(conversationId, 'src\\b.ts');

      // Act
      const docs = store.getLinkedDocuments(conversationId);

      // Assert
      expect(docs).toHaveLength(2);
      expect(docs.every((d) => typeof d.path === 'string')).toBe(true);
      expect(docs.every((d) => typeof d.addedAt === 'number')).toBe(true);
    });

    it('should_return_documents_in_order_of_addition', () => {
      // Arrange
      store.linkDocument(conversationId, 'first.ts');
      store.linkDocument(conversationId, 'second.ts');
      store.linkDocument(conversationId, 'third.ts');

      // Act
      const docs = store.getLinkedDocuments(conversationId);

      // Assert
      expect(docs[0].path).toBe('first.ts');
      expect(docs[1].path).toBe('second.ts');
      expect(docs[2].path).toBe('third.ts');
    });

    // 빈 케이스
    it('should_return_empty_array_when_no_documents_linked', () => {
      // Act
      const docs = store.getLinkedDocuments(conversationId);

      // Assert
      expect(docs).toEqual([]);
    });

    // 에러 케이스
    it('should_return_empty_array_when_conversation_not_found', () => {
      // Arrange
      const fakeConversationId = encodeConversationId(PYLON_ID, workspaceId, 999);

      // Act
      const docs = store.getLinkedDocuments(fakeConversationId);

      // Assert
      expect(docs).toEqual([]);
    });
  });

  // ============================================================================
  // 직렬화 및 복원 테스트
  // ============================================================================
  describe('직렬화 및 복원', () => {
    it('should_preserve_linked_documents_after_toJSON_and_fromJSON', () => {
      // Arrange
      store.linkDocument(conversationId, 'src\\a.ts');
      store.linkDocument(conversationId, 'src\\b.ts');
      const data = store.toJSON();

      // Act
      const restored = WorkspaceStore.fromJSON(PYLON_ID, data);
      const docs = restored.getLinkedDocuments(conversationId);

      // Assert
      expect(docs).toHaveLength(2);
      expect(docs[0].path).toBe('src\\a.ts');
      expect(docs[1].path).toBe('src\\b.ts');
    });

    it('should_preserve_addedAt_timestamps_after_restore', () => {
      // Arrange
      store.linkDocument(conversationId, 'test.ts');
      const originalDocs = store.getLinkedDocuments(conversationId);
      const originalAddedAt = originalDocs[0].addedAt;
      const data = store.toJSON();

      // Act
      const restored = WorkspaceStore.fromJSON(PYLON_ID, data);
      const restoredDocs = restored.getLinkedDocuments(conversationId);

      // Assert
      expect(restoredDocs[0].addedAt).toBe(originalAddedAt);
    });
  });

  // ============================================================================
  // Conversation과의 연동 테스트
  // ============================================================================
  describe('Conversation 연동', () => {
    it('should_keep_linked_documents_when_conversation_renamed', () => {
      // Arrange
      store.linkDocument(conversationId, 'test.ts');

      // Act
      store.renameConversation(conversationId, 'New Name');

      // Assert
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs).toHaveLength(1);
    });

    it('should_remove_linked_documents_when_conversation_deleted', () => {
      // Arrange
      store.linkDocument(conversationId, 'test.ts');
      const newConv = store.createConversation(workspaceId, 'Another');

      // Act
      store.deleteConversation(conversationId);

      // Assert - 삭제된 대화의 문서는 조회 불가
      const docs = store.getLinkedDocuments(conversationId);
      expect(docs).toEqual([]);
    });

    it('should_have_independent_linked_documents_per_conversation', () => {
      // Arrange
      const conv2 = store.createConversation(workspaceId, 'Second')!;
      store.linkDocument(conversationId, 'first-conv-doc.ts');
      store.linkDocument(conv2.conversationId, 'second-conv-doc.ts');

      // Act
      const docs1 = store.getLinkedDocuments(conversationId);
      const docs2 = store.getLinkedDocuments(conv2.conversationId);

      // Assert
      expect(docs1).toHaveLength(1);
      expect(docs1[0].path).toBe('first-conv-doc.ts');
      expect(docs2).toHaveLength(1);
      expect(docs2[0].path).toBe('second-conv-doc.ts');
    });
  });
});
