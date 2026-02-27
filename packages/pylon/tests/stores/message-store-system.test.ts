/**
 * @file message-store-system.test.ts
 * @description MessageStore - 시스템 메시지 관련 테스트
 *
 * continue_task 기능을 위한 addSystemMessage 메서드 테스트.
 * SystemMessage 타입과 addSystemMessage 메서드가 아직 구현되지 않았으므로
 * 이 테스트는 실패해야 합니다.
 *
 * 테스트 케이스:
 * - addSystemMessage: 시스템 메시지 추가 (정상/엣지/에러)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 구현되지 않은 메서드 import - 컴파일/런타임 에러 예상
import {
  MessageStore,
  // 아직 존재하지 않는 타입 - import 에러 예상
  type SystemMessage,
} from '../../src/stores/message-store.js';

// Core 타입에서도 SystemMessage import 시도 - 아직 존재하지 않음
import type { SystemMessage as CoreSystemMessage } from '@estelle/core';

// ============================================================================
// 테스트 유틸리티
// ============================================================================

/**
 * 임시 DB 경로 생성
 */
function createTempDbPath(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'message-store-system-test-'));
  return path.join(tempDir, 'messages.db');
}

/**
 * 임시 디렉토리 정리
 */
function cleanupTempDir(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ============================================================================
// addSystemMessage 테스트
// ============================================================================
describe('MessageStore - addSystemMessage', () => {
  let store: MessageStore;
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    store = new MessageStore(dbPath);
  });

  afterEach(() => {
    store.close();
    cleanupTempDir(dbPath);
  });

  // ============================================================================
  // 정상 케이스 테스트
  // ============================================================================
  describe('success cases', () => {
    it('should_add_system_message_when_valid_content', () => {
      // Arrange
      const sessionId = 1;
      const content = '[세션 재시작] 작업을 계속합니다.';

      // Act
      // addSystemMessage 메서드가 아직 구현되지 않았으므로 에러 발생 예상
      const messages = store.addSystemMessage(sessionId, content);

      // Assert
      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThan(0);

      const lastMessage = messages[messages.length - 1] as SystemMessage;
      expect(lastMessage.role).toBe('system');
      expect(lastMessage.type).toBe('system');
      expect(lastMessage.content).toBe(content);
    });

    it('should_generate_unique_id_for_system_message', () => {
      // Arrange
      const sessionId = 1;

      // Act
      store.addSystemMessage(sessionId, 'Message 1');
      store.addSystemMessage(sessionId, 'Message 2');

      // Assert
      const messages = store.getMessages(sessionId);
      const ids = messages.map(m => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should_add_timestamp_automatically', () => {
      // Arrange
      const sessionId = 1;
      const before = Date.now();

      // Act
      store.addSystemMessage(sessionId, 'Test message');

      // Assert
      const after = Date.now();
      const messages = store.getMessages(sessionId);
      const msg = messages[0];
      expect(msg.timestamp).toBeGreaterThanOrEqual(before);
      expect(msg.timestamp).toBeLessThanOrEqual(after);
    });

    it('should_return_updated_messages_array', () => {
      // Arrange
      const sessionId = 1;
      store.addUserMessage(sessionId, 'User message');

      // Act
      const result = store.addSystemMessage(sessionId, 'System message');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('text');
      expect(result[1].type).toBe('system');
    });

    it('should_persist_system_message_across_store_instances', () => {
      // Arrange
      const sessionId = 1;
      const content = '[세션 재시작] 이유: 토큰 한도 초과';

      // Act
      store.addSystemMessage(sessionId, content);
      store.close();

      // Assert - 새 인스턴스에서 확인
      const store2 = new MessageStore(dbPath);
      const messages = store2.getMessages(sessionId);
      expect(messages).toHaveLength(1);

      const msg = messages[0] as SystemMessage;
      expect(msg.type).toBe('system');
      expect(msg.content).toBe(content);

      store2.close();
    });
  });

  // ============================================================================
  // 엣지 케이스 테스트
  // ============================================================================
  describe('edge cases', () => {
    it('should_handle_empty_content', () => {
      // Arrange
      const sessionId = 1;

      // Act
      const messages = store.addSystemMessage(sessionId, '');

      // Assert - 빈 내용도 저장 가능해야 함
      expect(messages).toHaveLength(1);
      const msg = messages[0] as SystemMessage;
      expect(msg.content).toBe('');
    });

    it('should_handle_very_long_content', () => {
      // Arrange
      const sessionId = 1;
      const longContent = 'x'.repeat(10000);

      // Act
      const messages = store.addSystemMessage(sessionId, longContent);

      // Assert
      expect(messages).toHaveLength(1);
      const msg = messages[0] as SystemMessage;
      expect(msg.content).toBe(longContent);
    });

    it('should_handle_special_characters_in_content', () => {
      // Arrange
      const sessionId = 1;
      const specialContent = '[세션 재시작] 이유: "토큰 한도 초과"\n새 세션을 시작합니다.\t\r\n';

      // Act
      const messages = store.addSystemMessage(sessionId, specialContent);

      // Assert
      const msg = messages[0] as SystemMessage;
      expect(msg.content).toBe(specialContent);
    });

    it('should_handle_unicode_content', () => {
      // Arrange
      const sessionId = 1;
      const unicodeContent = '[세션 재시작] 한글, 日本語, Emoji: 🚀💻✅';

      // Act
      const messages = store.addSystemMessage(sessionId, unicodeContent);

      // Assert
      const msg = messages[0] as SystemMessage;
      expect(msg.content).toBe(unicodeContent);
    });

    it('should_handle_multiple_system_messages_in_sequence', () => {
      // Arrange
      const sessionId = 1;

      // Act
      store.addSystemMessage(sessionId, 'System 1');
      store.addSystemMessage(sessionId, 'System 2');
      store.addSystemMessage(sessionId, 'System 3');

      // Assert
      const messages = store.getMessages(sessionId);
      expect(messages).toHaveLength(3);
      messages.forEach(msg => {
        expect(msg.type).toBe('system');
        expect(msg.role).toBe('system');
      });
    });

    it('should_interleave_with_other_message_types', () => {
      // Arrange
      const sessionId = 1;

      // Act - 다양한 메시지 타입 혼합
      store.addUserMessage(sessionId, 'User 1');
      store.addAssistantText(sessionId, 'Assistant 1');
      store.addSystemMessage(sessionId, '[세션 재시작]');
      store.addUserMessage(sessionId, 'User 2');

      // Assert
      const messages = store.getMessages(sessionId);
      expect(messages).toHaveLength(4);
      expect(messages[0].type).toBe('text');
      expect(messages[0].role).toBe('user');
      expect(messages[1].type).toBe('text');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].type).toBe('system');
      expect(messages[2].role).toBe('system');
      expect(messages[3].type).toBe('text');
      expect(messages[3].role).toBe('user');
    });
  });

  // ============================================================================
  // 에러 케이스 테스트
  // ============================================================================
  describe('error cases', () => {
    it('should_handle_non_existent_session_gracefully', () => {
      // Arrange
      const nonExistentSessionId = 99999;

      // Act
      const messages = store.addSystemMessage(nonExistentSessionId, 'Test');

      // Assert - 새 세션 생성되어야 함
      expect(messages).toHaveLength(1);
      expect(store.getCount(nonExistentSessionId)).toBe(1);
    });

    it('should_handle_negative_session_id', () => {
      // Arrange
      const negativeSessionId = -1;

      // Act
      const messages = store.addSystemMessage(negativeSessionId, 'Test');

      // Assert
      expect(messages).toHaveLength(1);
      expect(store.getCount(negativeSessionId)).toBe(1);
    });
  });
});

// ============================================================================
// SystemMessage 타입 검증 테스트
// ============================================================================
describe('SystemMessage Type', () => {
  it('should_have_correct_type_structure', () => {
    // 이 테스트는 SystemMessage 타입이 올바르게 정의되었는지 확인합니다.
    // 타입이 존재하지 않으면 컴파일 에러가 발생합니다.

    // 타입 체크를 위한 더미 객체
    const dummySystemMessage: SystemMessage = {
      id: 'msg_123',
      role: 'system',
      type: 'system',
      content: 'Test content',
      timestamp: Date.now(),
    };

    // Assert
    expect(dummySystemMessage.role).toBe('system');
    expect(dummySystemMessage.type).toBe('system');
    expect(typeof dummySystemMessage.content).toBe('string');
  });

  it('should_be_compatible_with_core_system_message', () => {
    // Core 패키지의 SystemMessage 타입과 호환되어야 함
    const coreMessage: CoreSystemMessage = {
      id: 'msg_456',
      role: 'system',
      type: 'system',
      content: 'Core test',
      timestamp: Date.now(),
    };

    expect(coreMessage.type).toBe('system');
  });
});
