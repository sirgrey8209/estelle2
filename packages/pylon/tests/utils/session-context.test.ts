/**
 * SessionContext 모듈 테스트
 *
 * 테스트 항목:
 * - 시스템 프롬프트 빌드 (환경 정보)
 * - 초기 system-reminder 빌드 (대화명, 연결된 문서)
 * - 문서 추가 알림 빌드
 * - 문서 삭제 알림 빌드
 * - 대화명 변경 알림 빌드
 */

import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  buildInitialReminder,
  buildDocumentAddedReminder,
  buildDocumentRemovedReminder,
  buildConversationRenamedReminder,
} from '../../src/utils/session-context.js';

describe('SessionContext', () => {
  describe('buildSystemPrompt', () => {
    it('should_include_environment_info_when_release', () => {
      // Arrange
      const buildEnv = 'release';

      // Act
      const result = buildSystemPrompt(buildEnv);

      // Assert
      expect(result).toContain('release');
      expect(result).toContain('환경');
    });

    it('should_include_environment_info_when_stage', () => {
      // Arrange
      const buildEnv = 'stage';

      // Act
      const result = buildSystemPrompt(buildEnv);

      // Assert
      expect(result).toContain('stage');
    });

    it('should_include_environment_info_when_dev', () => {
      // Arrange
      const buildEnv = 'dev';

      // Act
      const result = buildSystemPrompt(buildEnv);

      // Assert
      expect(result).toContain('dev');
    });

    it('should_return_string_type', () => {
      // Arrange
      const buildEnv = 'release';

      // Act
      const result = buildSystemPrompt(buildEnv);

      // Assert
      expect(typeof result).toBe('string');
    });
  });

  describe('buildInitialReminder', () => {
    it('should_include_conversation_name_when_provided', () => {
      // Arrange
      const conversationName = '테스트 대화';
      const linkedDocs: string[] = [];

      // Act
      const result = buildInitialReminder(conversationName, linkedDocs);

      // Assert
      expect(result).toContain('테스트 대화');
      expect(result).toContain('대화명');
    });

    it('should_include_linked_documents_when_provided', () => {
      // Arrange
      const conversationName = '대화1';
      const linkedDocs = ['doc1.md', 'doc2.md'];

      // Act
      const result = buildInitialReminder(conversationName, linkedDocs);

      // Assert
      expect(result).toContain('doc1.md');
      expect(result).toContain('doc2.md');
      expect(result).toContain('연결된 문서');
    });

    it('should_show_none_when_no_linked_documents', () => {
      // Arrange
      const conversationName = '대화1';
      const linkedDocs: string[] = [];

      // Act
      const result = buildInitialReminder(conversationName, linkedDocs);

      // Assert
      expect(result).toContain('없음');
    });

    it('should_wrap_content_in_system_reminder_tag', () => {
      // Arrange
      const conversationName = '대화1';
      const linkedDocs: string[] = [];

      // Act
      const result = buildInitialReminder(conversationName, linkedDocs);

      // Assert
      expect(result).toContain('<system-reminder>');
      expect(result).toContain('</system-reminder>');
    });

    it('should_include_guidance_text', () => {
      // Arrange
      const conversationName = '대화1';
      const linkedDocs: string[] = [];

      // Act
      const result = buildInitialReminder(conversationName, linkedDocs);

      // Assert
      expect(result).toContain('대화를 시작해 주세요');
    });

    it('should_handle_empty_conversation_name', () => {
      // Arrange
      const conversationName = '';
      const linkedDocs: string[] = [];

      // Act
      const result = buildInitialReminder(conversationName, linkedDocs);

      // Assert
      expect(result).toContain('<system-reminder>');
      expect(typeof result).toBe('string');
    });

    it('should_handle_special_characters_in_conversation_name', () => {
      // Arrange
      const conversationName = '테스트 <대화> & "특수"';
      const linkedDocs: string[] = [];

      // Act
      const result = buildInitialReminder(conversationName, linkedDocs);

      // Assert
      expect(result).toContain(conversationName);
    });
  });

  describe('buildDocumentAddedReminder', () => {
    it('should_include_document_path_when_provided', () => {
      // Arrange
      const docPath = 'doc/example.md';

      // Act
      const result = buildDocumentAddedReminder(docPath);

      // Assert
      expect(result).toContain('doc/example.md');
    });

    it('should_indicate_document_was_added', () => {
      // Arrange
      const docPath = 'doc/example.md';

      // Act
      const result = buildDocumentAddedReminder(docPath);

      // Assert
      expect(result).toMatch(/추가|연결/);
    });

    it('should_wrap_content_in_system_reminder_tag', () => {
      // Arrange
      const docPath = 'doc/example.md';

      // Act
      const result = buildDocumentAddedReminder(docPath);

      // Assert
      expect(result).toContain('<system-reminder>');
      expect(result).toContain('</system-reminder>');
    });

    it('should_handle_absolute_path', () => {
      // Arrange
      const docPath = 'C:/WorkSpace/estelle2/doc/example.md';

      // Act
      const result = buildDocumentAddedReminder(docPath);

      // Assert
      expect(result).toContain(docPath);
    });

    it('should_handle_empty_path', () => {
      // Arrange
      const docPath = '';

      // Act
      const result = buildDocumentAddedReminder(docPath);

      // Assert
      expect(typeof result).toBe('string');
    });
  });

  describe('buildDocumentRemovedReminder', () => {
    it('should_include_document_path_when_provided', () => {
      // Arrange
      const docPath = 'doc/example.md';

      // Act
      const result = buildDocumentRemovedReminder(docPath);

      // Assert
      expect(result).toContain('doc/example.md');
    });

    it('should_indicate_document_was_removed', () => {
      // Arrange
      const docPath = 'doc/example.md';

      // Act
      const result = buildDocumentRemovedReminder(docPath);

      // Assert
      expect(result).toMatch(/제거|삭제|해제/);
    });

    it('should_wrap_content_in_system_reminder_tag', () => {
      // Arrange
      const docPath = 'doc/example.md';

      // Act
      const result = buildDocumentRemovedReminder(docPath);

      // Assert
      expect(result).toContain('<system-reminder>');
      expect(result).toContain('</system-reminder>');
    });

    it('should_handle_absolute_path', () => {
      // Arrange
      const docPath = 'C:/WorkSpace/estelle2/doc/example.md';

      // Act
      const result = buildDocumentRemovedReminder(docPath);

      // Assert
      expect(result).toContain(docPath);
    });

    it('should_handle_empty_path', () => {
      // Arrange
      const docPath = '';

      // Act
      const result = buildDocumentRemovedReminder(docPath);

      // Assert
      expect(typeof result).toBe('string');
    });
  });

  describe('buildConversationRenamedReminder', () => {
    it('should_include_old_name_when_provided', () => {
      // Arrange
      const oldName = '이전 대화';
      const newName = '새 대화';

      // Act
      const result = buildConversationRenamedReminder(oldName, newName);

      // Assert
      expect(result).toContain('이전 대화');
    });

    it('should_include_new_name_when_provided', () => {
      // Arrange
      const oldName = '이전 대화';
      const newName = '새 대화';

      // Act
      const result = buildConversationRenamedReminder(oldName, newName);

      // Assert
      expect(result).toContain('새 대화');
    });

    it('should_indicate_name_was_changed', () => {
      // Arrange
      const oldName = '이전 대화';
      const newName = '새 대화';

      // Act
      const result = buildConversationRenamedReminder(oldName, newName);

      // Assert
      expect(result).toMatch(/변경|바꿈|수정/);
    });

    it('should_wrap_content_in_system_reminder_tag', () => {
      // Arrange
      const oldName = '이전 대화';
      const newName = '새 대화';

      // Act
      const result = buildConversationRenamedReminder(oldName, newName);

      // Assert
      expect(result).toContain('<system-reminder>');
      expect(result).toContain('</system-reminder>');
    });

    it('should_handle_empty_old_name', () => {
      // Arrange
      const oldName = '';
      const newName = '새 대화';

      // Act
      const result = buildConversationRenamedReminder(oldName, newName);

      // Assert
      expect(result).toContain('새 대화');
      expect(typeof result).toBe('string');
    });

    it('should_handle_empty_new_name', () => {
      // Arrange
      const oldName = '이전 대화';
      const newName = '';

      // Act
      const result = buildConversationRenamedReminder(oldName, newName);

      // Assert
      expect(result).toContain('이전 대화');
      expect(typeof result).toBe('string');
    });

    it('should_handle_special_characters_in_names', () => {
      // Arrange
      const oldName = '테스트 <대화> & "특수"';
      const newName = '새로운 <대화> & "이름"';

      // Act
      const result = buildConversationRenamedReminder(oldName, newName);

      // Assert
      expect(result).toContain(oldName);
      expect(result).toContain(newName);
    });
  });
});
