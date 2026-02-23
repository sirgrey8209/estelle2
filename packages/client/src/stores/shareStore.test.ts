/**
 * @file shareStore.test.ts
 * @description ShareStore 테스트 - 공유 링크 상태 관리
 *
 * TDD 2-TEST 단계: 실패하는 테스트 작성
 * - shareStore는 아직 구현되지 않음
 * - import 에러는 의도된 것
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { StoreMessage } from '@estelle/core';
import { useShareStore } from './shareStore';

// ============================================================================
// Test Helpers
// ============================================================================

function createUserMessage(id: string, content: string): StoreMessage {
  return {
    id,
    role: 'user',
    type: 'text',
    content,
    timestamp: Date.now(),
  };
}

function createAssistantMessage(id: string, content: string): StoreMessage {
  return {
    id,
    role: 'assistant',
    type: 'text',
    content,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('shareStore', () => {
  beforeEach(() => {
    // 각 테스트 전에 스토어 초기화
    useShareStore.getState().reset();
  });

  // ==========================================================================
  // 초기 상태
  // ==========================================================================

  describe('초기 상태', () => {
    it('should_have_null_shareId_when_initialized', () => {
      // Arrange & Act
      const state = useShareStore.getState();

      // Assert
      expect(state.shareId).toBeNull();
    });

    it('should_have_null_conversationId_when_initialized', () => {
      // Arrange & Act
      const state = useShareStore.getState();

      // Assert
      expect(state.conversationId).toBeNull();
    });

    it('should_have_empty_messages_when_initialized', () => {
      // Arrange & Act
      const state = useShareStore.getState();

      // Assert
      expect(state.messages).toEqual([]);
    });

    it('should_have_disconnected_state_when_initialized', () => {
      // Arrange & Act
      const state = useShareStore.getState();

      // Assert
      expect(state.isConnected).toBe(false);
    });

    it('should_have_unauthenticated_state_when_initialized', () => {
      // Arrange & Act
      const state = useShareStore.getState();

      // Assert
      expect(state.isAuthenticated).toBe(false);
    });

    it('should_have_null_error_when_initialized', () => {
      // Arrange & Act
      const state = useShareStore.getState();

      // Assert
      expect(state.error).toBeNull();
    });
  });

  // ==========================================================================
  // shareId 관리
  // ==========================================================================

  describe('setShareId', () => {
    it('should_set_shareId_when_valid_id_provided', () => {
      // Arrange
      const { setShareId } = useShareStore.getState();

      // Act
      setShareId('abc123');

      // Assert
      expect(useShareStore.getState().shareId).toBe('abc123');
    });

    it('should_update_shareId_when_called_multiple_times', () => {
      // Arrange
      const { setShareId } = useShareStore.getState();

      // Act
      setShareId('first');
      setShareId('second');

      // Assert
      expect(useShareStore.getState().shareId).toBe('second');
    });

    it('should_clear_shareId_when_empty_string_provided', () => {
      // Arrange
      const { setShareId } = useShareStore.getState();
      setShareId('abc123');

      // Act
      setShareId('');

      // Assert
      expect(useShareStore.getState().shareId).toBe('');
    });
  });

  // ==========================================================================
  // conversationId 관리
  // ==========================================================================

  describe('setConversationId', () => {
    it('should_set_conversationId_when_valid_id_provided', () => {
      // Arrange
      const { setConversationId } = useShareStore.getState();

      // Act
      setConversationId(12345);

      // Assert
      expect(useShareStore.getState().conversationId).toBe(12345);
    });

    it('should_set_conversationId_to_null_when_null_provided', () => {
      // Arrange
      const { setConversationId } = useShareStore.getState();
      setConversationId(12345);

      // Act
      setConversationId(null);

      // Assert
      expect(useShareStore.getState().conversationId).toBeNull();
    });
  });

  // ==========================================================================
  // 연결 상태 관리
  // ==========================================================================

  describe('setConnected', () => {
    it('should_set_connected_true_when_connected', () => {
      // Arrange
      const { setConnected } = useShareStore.getState();

      // Act
      setConnected(true);

      // Assert
      expect(useShareStore.getState().isConnected).toBe(true);
    });

    it('should_set_connected_false_when_disconnected', () => {
      // Arrange
      const { setConnected } = useShareStore.getState();
      setConnected(true);

      // Act
      setConnected(false);

      // Assert
      expect(useShareStore.getState().isConnected).toBe(false);
    });

    it('should_reset_authenticated_when_disconnected', () => {
      // Arrange
      const { setConnected, setAuthenticated } = useShareStore.getState();
      setConnected(true);
      setAuthenticated(true);

      // Act
      setConnected(false);

      // Assert
      expect(useShareStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ==========================================================================
  // 인증 상태 관리
  // ==========================================================================

  describe('setAuthenticated', () => {
    it('should_set_authenticated_true_when_authenticated', () => {
      // Arrange
      const { setAuthenticated } = useShareStore.getState();

      // Act
      setAuthenticated(true);

      // Assert
      expect(useShareStore.getState().isAuthenticated).toBe(true);
    });

    it('should_set_authenticated_false_when_unauthenticated', () => {
      // Arrange
      const { setAuthenticated } = useShareStore.getState();
      setAuthenticated(true);

      // Act
      setAuthenticated(false);

      // Assert
      expect(useShareStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ==========================================================================
  // 에러 관리
  // ==========================================================================

  describe('setError', () => {
    it('should_set_error_message_when_error_occurs', () => {
      // Arrange
      const { setError } = useShareStore.getState();

      // Act
      setError('Connection failed');

      // Assert
      expect(useShareStore.getState().error).toBe('Connection failed');
    });

    it('should_clear_error_when_null_provided', () => {
      // Arrange
      const { setError } = useShareStore.getState();
      setError('Some error');

      // Act
      setError(null);

      // Assert
      expect(useShareStore.getState().error).toBeNull();
    });

    it('should_update_error_when_new_error_occurs', () => {
      // Arrange
      const { setError } = useShareStore.getState();
      setError('First error');

      // Act
      setError('Second error');

      // Assert
      expect(useShareStore.getState().error).toBe('Second error');
    });
  });

  // ==========================================================================
  // 메시지 관리
  // ==========================================================================

  describe('addMessage', () => {
    it('should_add_message_to_empty_list', () => {
      // Arrange
      const { addMessage } = useShareStore.getState();
      const message = createUserMessage('msg-1', 'Hello');

      // Act
      addMessage(message);

      // Assert
      const messages = useShareStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');
    });

    it('should_append_message_to_existing_list', () => {
      // Arrange
      const { addMessage } = useShareStore.getState();
      addMessage(createUserMessage('msg-1', 'First'));

      // Act
      addMessage(createAssistantMessage('msg-2', 'Second'));

      // Assert
      const messages = useShareStore.getState().messages;
      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[1].id).toBe('msg-2');
    });

    it('should_preserve_message_order', () => {
      // Arrange
      const { addMessage } = useShareStore.getState();

      // Act
      addMessage(createUserMessage('msg-1', 'First'));
      addMessage(createAssistantMessage('msg-2', 'Second'));
      addMessage(createUserMessage('msg-3', 'Third'));

      // Assert
      const messages = useShareStore.getState().messages;
      expect(messages.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });
  });

  describe('setMessages', () => {
    it('should_replace_messages_with_new_list', () => {
      // Arrange
      const { addMessage, setMessages } = useShareStore.getState();
      addMessage(createUserMessage('old-1', 'Old'));

      // Act
      setMessages([
        createUserMessage('new-1', 'New First'),
        createAssistantMessage('new-2', 'New Second'),
      ]);

      // Assert
      const messages = useShareStore.getState().messages;
      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('new-1');
      expect(messages[1].id).toBe('new-2');
    });

    it('should_set_empty_list_when_empty_array_provided', () => {
      // Arrange
      const { addMessage, setMessages } = useShareStore.getState();
      addMessage(createUserMessage('msg-1', 'Message'));

      // Act
      setMessages([]);

      // Assert
      expect(useShareStore.getState().messages).toEqual([]);
    });

    it('should_handle_large_message_list', () => {
      // Arrange
      const { setMessages } = useShareStore.getState();
      const largeList = Array.from({ length: 100 }, (_, i) =>
        createUserMessage(`msg-${i}`, `Message ${i}`)
      );

      // Act
      setMessages(largeList);

      // Assert
      expect(useShareStore.getState().messages).toHaveLength(100);
    });
  });

  // ==========================================================================
  // reset
  // ==========================================================================

  describe('reset', () => {
    it('should_reset_all_state_to_initial_values', () => {
      // Arrange
      const store = useShareStore.getState();
      store.setShareId('abc123');
      store.setConversationId(12345);
      store.setConnected(true);
      store.setAuthenticated(true);
      store.setError('Some error');
      store.addMessage(createUserMessage('msg-1', 'Hello'));

      // Act
      store.reset();

      // Assert
      const state = useShareStore.getState();
      expect(state.shareId).toBeNull();
      expect(state.conversationId).toBeNull();
      expect(state.isConnected).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
      expect(state.messages).toEqual([]);
    });

    it('should_allow_setting_new_values_after_reset', () => {
      // Arrange
      const store = useShareStore.getState();
      store.setShareId('old');
      store.reset();

      // Act
      store.setShareId('new');

      // Assert
      expect(useShareStore.getState().shareId).toBe('new');
    });
  });

  // ==========================================================================
  // 엣지 케이스
  // ==========================================================================

  describe('엣지 케이스', () => {
    it('should_handle_special_characters_in_shareId', () => {
      // Arrange
      const { setShareId } = useShareStore.getState();

      // Act
      setShareId('abc-123_XYZ');

      // Assert
      expect(useShareStore.getState().shareId).toBe('abc-123_XYZ');
    });

    it('should_handle_zero_conversationId', () => {
      // Arrange
      const { setConversationId } = useShareStore.getState();

      // Act
      setConversationId(0);

      // Assert
      expect(useShareStore.getState().conversationId).toBe(0);
    });

    it('should_handle_negative_conversationId', () => {
      // Arrange
      const { setConversationId } = useShareStore.getState();

      // Act
      setConversationId(-1);

      // Assert
      expect(useShareStore.getState().conversationId).toBe(-1);
    });

    it('should_handle_empty_error_string', () => {
      // Arrange
      const { setError } = useShareStore.getState();

      // Act
      setError('');

      // Assert
      expect(useShareStore.getState().error).toBe('');
    });

    it('should_handle_unicode_in_error_message', () => {
      // Arrange
      const { setError } = useShareStore.getState();

      // Act
      setError('Error occurred');

      // Assert
      expect(useShareStore.getState().error).toBe('Error occurred');
    });

    it('should_handle_message_with_empty_content', () => {
      // Arrange
      const { addMessage } = useShareStore.getState();
      const emptyMessage = createUserMessage('msg-empty', '');

      // Act
      addMessage(emptyMessage);

      // Assert
      const messages = useShareStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect((messages[0] as any).content).toBe('');
    });
  });

  // ==========================================================================
  // 상태 연동 테스트
  // ==========================================================================

  describe('상태 연동', () => {
    it('should_maintain_independent_state_updates', () => {
      // Arrange
      const store = useShareStore.getState();

      // Act - 여러 상태 동시 업데이트
      store.setShareId('share-123');
      store.setConversationId(9999);
      store.setConnected(true);
      store.addMessage(createUserMessage('msg-1', 'Test'));

      // Assert - 각 상태가 독립적으로 유지됨
      const state = useShareStore.getState();
      expect(state.shareId).toBe('share-123');
      expect(state.conversationId).toBe(9999);
      expect(state.isConnected).toBe(true);
      expect(state.messages).toHaveLength(1);
    });

    it('should_not_affect_messages_when_connection_state_changes', () => {
      // Arrange
      const store = useShareStore.getState();
      store.addMessage(createUserMessage('msg-1', 'Hello'));

      // Act
      store.setConnected(true);
      store.setConnected(false);

      // Assert - 메시지는 영향받지 않음
      expect(useShareStore.getState().messages).toHaveLength(1);
    });

    it('should_not_affect_shareId_when_conversationId_changes', () => {
      // Arrange
      const store = useShareStore.getState();
      store.setShareId('share-xyz');

      // Act
      store.setConversationId(12345);

      // Assert
      expect(useShareStore.getState().shareId).toBe('share-xyz');
    });
  });
});
