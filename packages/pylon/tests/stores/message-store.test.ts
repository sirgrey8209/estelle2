/**
 * @file message-store.test.ts
 * @description MessageStore 테스트 (SQLite 기반)
 *
 * 세션별 메시지 히스토리 저장 기능을 테스트합니다.
 * SQLite를 사용하여 즉시 저장하고, 필요한 메시지만 쿼리합니다.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  MessageStore,
  summarizeToolInput,
  summarizeOutput,
  truncateObjectValues,
  type StoreMessage,
  type UserTextMessage,
  type AssistantTextMessage,
  type ToolStartMessage,
  type ToolCompleteMessage,
  type ErrorMessage,
  type ResultMessage,
  type AbortedMessage,
  type FileAttachmentMessage,
} from '../../src/stores/message-store.js';

// ============================================================================
// 테스트 유틸리티
// ============================================================================

/**
 * 임시 DB 경로 생성
 */
function createTempDbPath(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'message-store-test-'));
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
// SQLite 초기화 테스트
// ============================================================================
describe('MessageStore - SQLite 초기화', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
  });

  afterEach(() => {
    cleanupTempDir(dbPath);
  });

  it('should create DB file at the specified path', () => {
    // Given: DB 경로
    // When: MessageStore 생성
    const store = new MessageStore(dbPath);

    // Then: DB 파일이 생성됨
    expect(fs.existsSync(dbPath)).toBe(true);

    store.close();
  });

  it('should create messages table with correct schema', () => {
    // Given: MessageStore 생성
    const store = new MessageStore(dbPath);

    // When: 메시지 추가 시도 (스키마가 없으면 실패)
    store.addUserMessage(1, 'test message');

    // Then: 메시지가 정상적으로 저장됨
    const messages = store.getMessages(1);
    expect(messages).toHaveLength(1);

    store.close();
  });

  it('should persist data across store instances', () => {
    // Given: 메시지가 저장된 상태
    const store1 = new MessageStore(dbPath);
    store1.addUserMessage(1, 'persisted message');
    store1.close();

    // When: 새 인스턴스로 다시 열기
    const store2 = new MessageStore(dbPath);
    const messages = store2.getMessages(1);

    // Then: 이전 데이터가 유지됨
    expect(messages).toHaveLength(1);
    expect((messages[0] as UserTextMessage).content).toBe('persisted message');

    store2.close();
  });

  it('should support in-memory database with :memory:', () => {
    // Given: 메모리 DB 사용
    const store = new MessageStore(':memory:');

    // When: 메시지 추가
    store.addUserMessage(1, 'in-memory message');

    // Then: 정상 동작
    expect(store.getCount(1)).toBe(1);

    store.close();
  });
});

// ============================================================================
// 마이그레이션 테스트
// ============================================================================
describe('MessageStore - JSON 마이그레이션', () => {
  let dbPath: string;
  let migrationDir: string;
  let backupDir: string;

  beforeEach(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    dbPath = path.join(tempDir, 'messages.db');
    migrationDir = path.join(tempDir, 'messages');
    backupDir = path.join(tempDir, 'messages_backup');
    fs.mkdirSync(migrationDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTempDir(dbPath);
  });

  it('should migrate existing JSON files to SQLite on first run', () => {
    // Given: 기존 JSON 파일이 존재
    const sessionData = {
      sessionId: 1,
      messages: [
        {
          id: 'msg_legacy_1',
          role: 'user',
          type: 'text',
          content: 'legacy message',
          timestamp: Date.now(),
        },
      ],
      updatedAt: Date.now(),
    };
    fs.writeFileSync(
      path.join(migrationDir, '1.json'),
      JSON.stringify(sessionData)
    );

    // When: MessageStore 생성 (마이그레이션 실행)
    const store = new MessageStore(dbPath, migrationDir);

    // Then: JSON 데이터가 SQLite로 마이그레이션됨
    const messages = store.getMessages(1);
    expect(messages).toHaveLength(1);
    expect((messages[0] as UserTextMessage).content).toBe('legacy message');
    expect(messages[0].id).toBe('msg_legacy_1');

    store.close();
  });

  it('should move JSON files to backup folder after migration', () => {
    // Given: 기존 JSON 파일
    const sessionData = {
      sessionId: 1,
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          type: 'text',
          content: 'test',
          timestamp: Date.now(),
        },
      ],
      updatedAt: Date.now(),
    };
    const jsonPath = path.join(migrationDir, '1.json');
    fs.writeFileSync(jsonPath, JSON.stringify(sessionData));

    // When: 마이그레이션 실행
    const store = new MessageStore(dbPath, migrationDir);
    store.close();

    // Then: 원본 JSON 삭제, 백업 폴더로 이동
    expect(fs.existsSync(jsonPath)).toBe(false);
    expect(fs.existsSync(path.join(backupDir, '1.json'))).toBe(true);
  });

  it('should skip migration if already completed', () => {
    // Given: 마이그레이션 완료 상태 (JSON 파일 없음, DB 존재)
    const store1 = new MessageStore(dbPath, migrationDir);
    store1.addUserMessage(1, 'new message');
    store1.close();

    // JSON 파일 다시 생성 (마이그레이션 후에 누군가 생성했다고 가정)
    const lateJson = {
      sessionId: 2,
      messages: [
        {
          id: 'msg_late',
          role: 'user',
          type: 'text',
          content: 'late message',
          timestamp: Date.now(),
        },
      ],
      updatedAt: Date.now(),
    };
    fs.writeFileSync(
      path.join(migrationDir, '2.json'),
      JSON.stringify(lateJson)
    );

    // When: 다시 열기
    const store2 = new MessageStore(dbPath, migrationDir);

    // Then: 기존 DB 데이터 유지, 새 JSON은 마이그레이션되지 않음
    // (마이그레이션은 첫 실행 시에만)
    expect(store2.getCount(1)).toBe(1);
    expect(store2.getCount(2)).toBe(0); // 마이그레이션되지 않음

    store2.close();
  });

  it('should migrate multiple session files', () => {
    // Given: 여러 세션의 JSON 파일
    for (let i = 1; i <= 3; i++) {
      const sessionData = {
        sessionId: i,
        messages: [
          {
            id: `msg_${i}`,
            role: 'user',
            type: 'text',
            content: `message from session ${i}`,
            timestamp: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      };
      fs.writeFileSync(
        path.join(migrationDir, `${i}.json`),
        JSON.stringify(sessionData)
      );
    }

    // When: 마이그레이션 실행
    const store = new MessageStore(dbPath, migrationDir);

    // Then: 모든 세션이 마이그레이션됨
    expect(store.getCount(1)).toBe(1);
    expect(store.getCount(2)).toBe(1);
    expect(store.getCount(3)).toBe(1);
    expect((store.getMessages(2)[0] as UserTextMessage).content).toBe(
      'message from session 2'
    );

    store.close();
  });
});

// ============================================================================
// 기존 API 호환성 테스트 (외부 API 유지)
// ============================================================================
describe('MessageStore - API 호환성', () => {
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
  // 초기화 테스트
  // ============================================================================
  describe('초기화', () => {
    it('should have empty initial state', () => {
      expect(store.getCount(1)).toBe(0);
      expect(store.getMessages(1)).toEqual([]);
    });
  });

  // ============================================================================
  // 메시지 추가 테스트
  // ============================================================================
  describe('메시지 추가', () => {
    describe('addUserMessage', () => {
      it('should add user message', () => {
        store.addUserMessage(1, 'Hello, Claude!');

        const messages = store.getMessages(1);
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('user');
        expect(messages[0].type).toBe('text');
        expect((messages[0] as UserTextMessage).content).toBe('Hello, Claude!');
      });

      it('should add user message with attachments', () => {
        const attachments = [
          { filename: 'test.png', path: 'C:\\images\\test.png' },
        ];

        store.addUserMessage(1, 'Check this image', attachments);

        const messages = store.getMessages(1);
        expect(messages).toHaveLength(1);
        const msg = messages[0] as UserTextMessage;
        expect(msg.attachments).toHaveLength(1);
        expect(msg.attachments![0].filename).toBe('test.png');
      });

      it('should add timestamp automatically', () => {
        const before = Date.now();
        store.addUserMessage(1, 'Test');
        const after = Date.now();

        const messages = store.getMessages(1);
        expect(messages[0].timestamp).toBeGreaterThanOrEqual(before);
        expect(messages[0].timestamp).toBeLessThanOrEqual(after);
      });
    });

    describe('addAssistantText', () => {
      it('should add assistant text message', () => {
        store.addAssistantText(1, 'Hello! How can I help?');

        const messages = store.getMessages(1);
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('assistant');
        expect(messages[0].type).toBe('text');
        expect((messages[0] as AssistantTextMessage).content).toBe(
          'Hello! How can I help?'
        );
      });
    });

    describe('addToolStart', () => {
      it('should add tool start message', () => {
        store.addToolStart(1, 'Read', {
          file_path: 'C:\\test\\file.ts',
        });

        const messages = store.getMessages(1);
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('assistant');
        expect(messages[0].type).toBe('tool_start');

        const msg = messages[0] as ToolStartMessage;
        expect(msg.toolName).toBe('Read');
        expect(msg.toolInput.file_path).toBe('C:\\test\\file.ts');
      });

      it('should summarize tool input for file operations', () => {
        const longContent = 'x'.repeat(1000);
        store.addToolStart(1, 'Read', {
          file_path: 'C:\\test\\file.ts',
          extraData: longContent,
        });

        const messages = store.getMessages(1);
        const msg = messages[0] as ToolStartMessage;
        // Read 도구는 file_path만 저장
        expect(msg.toolInput.file_path).toBe('C:\\test\\file.ts');
        expect(msg.toolInput.extraData).toBeUndefined();
      });
    });

    describe('updateToolComplete', () => {
      it('should update tool start to tool complete', () => {
        store.addToolStart(1, 'Read', {
          file_path: 'C:\\test\\file.ts',
        });

        store.updateToolComplete(1, 'Read', true, 'file content');

        const messages = store.getMessages(1);
        expect(messages).toHaveLength(1);
        expect(messages[0].type).toBe('tool_complete');

        const msg = messages[0] as ToolCompleteMessage;
        expect(msg.success).toBe(true);
        expect(msg.output).toBe('file content');
      });

      it('should update with error information', () => {
        store.addToolStart(1, 'Read', {
          file_path: 'C:\\test\\missing.ts',
        });

        store.updateToolComplete(
          1,
          'Read',
          false,
          undefined,
          'File not found'
        );

        const messages = store.getMessages(1);
        const msg = messages[0] as ToolCompleteMessage;
        expect(msg.success).toBe(false);
        expect(msg.error).toBe('File not found');
      });

      it('should summarize long output', () => {
        store.addToolStart(1, 'Bash', { command: 'ls' });

        const longOutput = 'x'.repeat(1000);
        store.updateToolComplete(1, 'Bash', true, longOutput);

        const messages = store.getMessages(1);
        const msg = messages[0] as ToolCompleteMessage;
        // 출력이 요약됨 (MAX_OUTPUT_LENGTH = 500)
        expect(msg.output!.length).toBeLessThan(longOutput.length);
        expect(msg.output).toContain('...');
      });

      it('should find and update the most recent matching tool', () => {
        // 같은 도구 두 번 사용
        store.addToolStart(1, 'Read', { file_path: 'file1.ts' });
        store.addToolStart(1, 'Read', { file_path: 'file2.ts' });

        store.updateToolComplete(1, 'Read', true, 'content2');

        const messages = store.getMessages(1);
        // 마지막 Read 도구만 업데이트됨
        expect((messages[0] as ToolStartMessage).type).toBe('tool_start');
        expect((messages[1] as ToolCompleteMessage).type).toBe('tool_complete');
        expect((messages[1] as ToolCompleteMessage).output).toBe('content2');
      });
    });

    describe('addError', () => {
      it('should add error message', () => {
        store.addError(1, 'Something went wrong');

        const messages = store.getMessages(1);
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('system');
        expect(messages[0].type).toBe('error');
        expect((messages[0] as ErrorMessage).content).toBe(
          'Something went wrong'
        );
      });
    });

    describe('addResult', () => {
      it('should add result message', () => {
        store.addResult(1, {
          durationMs: 1500,
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 10,
        });

        const messages = store.getMessages(1);
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('system');
        expect(messages[0].type).toBe('result');

        const msg = messages[0] as ResultMessage;
        expect(msg.resultInfo.durationMs).toBe(1500);
        expect(msg.resultInfo.inputTokens).toBe(100);
        expect(msg.resultInfo.outputTokens).toBe(50);
        expect(msg.resultInfo.cacheReadTokens).toBe(10);
      });
    });

    describe('addAborted', () => {
      it('should add aborted message', () => {
        store.addAborted(1, 'user');

        const messages = store.getMessages(1);
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('system');
        expect(messages[0].type).toBe('aborted');
        expect((messages[0] as AbortedMessage).reason).toBe('user');
      });
    });

    describe('addFileAttachment', () => {
      it('should add file attachment message', () => {
        store.addFileAttachment(1, {
          path: 'C:\\files\\document.pdf',
          filename: 'document.pdf',
          mimeType: 'application/pdf',
          fileType: 'pdf',
          size: 1024,
          description: 'A PDF document',
        });

        const messages = store.getMessages(1);
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('assistant');
        expect(messages[0].type).toBe('file_attachment');

        const msg = messages[0] as FileAttachmentMessage;
        expect(msg.file.filename).toBe('document.pdf');
        expect(msg.file.size).toBe(1024);
      });
    });
  });

  // ============================================================================
  // 메시지 조회 테스트
  // ============================================================================
  describe('메시지 조회', () => {
    beforeEach(() => {
      // 10개의 메시지 추가
      for (let i = 1; i <= 10; i++) {
        store.addUserMessage(1, `Message ${i}`);
      }
    });

    describe('getMessages', () => {
      it('should return all messages by default', () => {
        const messages = store.getMessages(1);
        expect(messages).toHaveLength(10);
      });

      it('should support limit option', () => {
        const messages = store.getMessages(1, { limit: 5 });
        expect(messages).toHaveLength(5);
        // 최근 5개 메시지 반환 (6~10)
        expect((messages[0] as UserTextMessage).content).toBe('Message 6');
        expect((messages[4] as UserTextMessage).content).toBe('Message 10');
      });

      it('should support loadBefore option', () => {
        // loadBefore=8 -> 인덱스 0~7 (Message 1~8) 중 마지막 3개
        const messages = store.getMessages(1, { limit: 3, loadBefore: 8 });
        expect(messages).toHaveLength(3);
        // 인덱스 5, 6, 7 -> Message 6, 7, 8
        expect((messages[0] as UserTextMessage).content).toBe('Message 6');
        expect((messages[2] as UserTextMessage).content).toBe('Message 8');
      });

      it('should return empty array for non-existent session', () => {
        const messages = store.getMessages(999);
        expect(messages).toEqual([]);
      });
    });

    describe('getLatestMessages', () => {
      it('should return latest N messages', () => {
        const messages = store.getLatestMessages(1, 3);
        expect(messages).toHaveLength(3);
        expect((messages[0] as UserTextMessage).content).toBe('Message 8');
        expect((messages[2] as UserTextMessage).content).toBe('Message 10');
      });

      it('should return all if count exceeds total', () => {
        const messages = store.getLatestMessages(1, 100);
        expect(messages).toHaveLength(10);
      });
    });

    describe('getCount', () => {
      it('should return message count', () => {
        expect(store.getCount(1)).toBe(10);
      });

      it('should return 0 for non-existent session', () => {
        expect(store.getCount(999)).toBe(0);
      });
    });
  });

  // ============================================================================
  // 세션 관리 테스트
  // ============================================================================
  describe('세션 관리', () => {
    describe('clear', () => {
      it('should clear session messages', () => {
        store.addUserMessage(1, 'Message 1');
        store.addUserMessage(1, 'Message 2');

        store.clear(1);

        expect(store.getCount(1)).toBe(0);
        expect(store.getMessages(1)).toEqual([]);
      });

      it('should not affect other sessions', () => {
        store.addUserMessage(1, 'Message 1');
        store.addUserMessage(2, 'Message 2');

        store.clear(1);

        expect(store.getCount(1)).toBe(0);
        expect(store.getCount(2)).toBe(1);
      });
    });

    describe('delete', () => {
      it('should delete session completely', () => {
        store.addUserMessage(1, 'Message 1');

        store.delete(1);

        expect(store.getCount(1)).toBe(0);
      });
    });
  });

  // ============================================================================
  // Share 전용 메서드 테스트
  // ============================================================================
  describe('getSharedMessageHistory', () => {
    it('should return empty array for non-existent session', () => {
      const result = store.getSharedMessageHistory(999);
      expect(result).toEqual([]);
    });

    it('should return all messages in chronological order (oldest first)', () => {
      // Given: 시간순으로 메시지 추가
      store.addUserMessage(1, 'first message');
      store.addAssistantText(1, 'second message');
      store.addUserMessage(1, 'third message');

      // When: getSharedMessageHistory 호출
      const result = store.getSharedMessageHistory(1);

      // Then: 시간순 (오래된 것 -> 최신) 반환
      expect(result).toHaveLength(3);
      expect((result[0] as UserTextMessage).content).toBe('first message');
      expect((result[1] as AssistantTextMessage).content).toBe('second message');
      expect((result[2] as UserTextMessage).content).toBe('third message');
    });

    it('should return a copy of messages (not original reference)', () => {
      store.addUserMessage(1, 'test');

      const result = store.getSharedMessageHistory(1);
      result.push({
        id: 'fake',
        role: 'user',
        type: 'text',
        content: 'fake',
        timestamp: 0,
      } as UserTextMessage);

      // 원본은 영향받지 않아야 함
      expect(store.getCount(1)).toBe(1);
    });

    it('should return all messages without pagination limits', () => {
      // Given: 많은 메시지 추가
      for (let i = 0; i < 250; i++) {
        store.addUserMessage(1, `message ${i}`);
      }

      // When: getSharedMessageHistory 호출
      const result = store.getSharedMessageHistory(1);

      // Then: 전체 메시지 반환 (페이징 제한 없음)
      expect(result).toHaveLength(250);
      expect((result[0] as UserTextMessage).content).toBe('message 0');
      expect((result[249] as UserTextMessage).content).toBe('message 249');
    });
  });
});

// ============================================================================
// 제거된 API 테스트 (SQLite 전환으로 불필요)
// ============================================================================
// 아래 테스트들은 SQLite 기반으로 전환되면서 제거된 API들입니다.
// 참조용으로 주석 처리하여 보존합니다.

/*
describe('MessageStore - 제거된 API (참조용)', () => {
  // hasDirtyData / getDirtySessions / markClean / markAllClean
  // - SQLite는 즉시 저장하므로 dirty 추적 불필요

  describe('hasDirtyData / getDirtySessions', () => {
    it('should track dirty sessions', () => {
      // ...dirty 추적 테스트 제거
    });

    it('should clear dirty flag after markClean', () => {
      // ...dirty 추적 테스트 제거
    });
  });

  // trimMessages
  // - DB에서 직접 처리 가능

  describe('trimMessages', () => {
    it('should trim messages when exceeding max', () => {
      // ...trim 테스트 제거 (DB에서 처리)
    });
  });

  // toJSON / fromJSON
  // - 마이그레이션 도구에서만 사용, 제거

  describe('toJSON / fromJSON', () => {
    it('should export all session data', () => {
      // ...직렬화 테스트 제거
    });

    it('should restore from exported data', () => {
      // ...직렬화 테스트 제거
    });
  });

  // getSessionData / loadSessionData
  // - DB가 곧 저장소, 파일 I/O 분리 불필요

  describe('getSessionData / loadSessionData', () => {
    it('should return single session data for file save', () => {
      // ...세션 데이터 테스트 제거
    });

    it('should load session data from external source', () => {
      // ...세션 데이터 테스트 제거
    });
  });

  // hasCache / unloadCache
  // - 메모리 캐시 불필요 (DB 쿼리 기반)

  describe('hasCache / unloadCache', () => {
    it('should check cache existence', () => {
      // ...캐시 테스트 제거
    });

    it('should unload cache', () => {
      // ...캐시 테스트 제거
    });
  });
});
*/

// ============================================================================
// 유틸리티 함수 테스트 (변경 없음)
// ============================================================================
describe('MessageStore 유틸리티 함수', () => {
  describe('summarizeToolInput', () => {
    it('should return only file_path for Read tool', () => {
      const input = {
        file_path: 'C:\\test\\file.ts',
        extraData: 'should be removed',
      };

      const result = summarizeToolInput('Read', input);

      expect(result.file_path).toBe('C:\\test\\file.ts');
      expect(result.extraData).toBeUndefined();
    });

    it('should return file_path, old_string, new_string for Edit tool', () => {
      const input = {
        file_path: 'C:\\test\\file.ts',
        old_string: 'old content',
        new_string: 'new content',
      };

      const result = summarizeToolInput('Edit', input);

      expect(result.file_path).toBe('C:\\test\\file.ts');
      expect(result.old_string).toBe('old content');
      expect(result.new_string).toBe('new content');
    });

    it('should truncate long old_string/new_string for Edit tool', () => {
      const longString = 'x'.repeat(600);
      const input = {
        file_path: 'C:\\test\\file.ts',
        old_string: longString,
        new_string: longString,
      };

      const result = summarizeToolInput('Edit', input);

      expect(result.file_path).toBe('C:\\test\\file.ts');
      expect((result.old_string as string).length).toBeLessThan(longString.length);
      expect(result.old_string as string).toContain('...');
      expect((result.new_string as string).length).toBeLessThan(longString.length);
      expect(result.new_string as string).toContain('...');
    });

    it('should return file_path and content for Write tool', () => {
      const input = {
        file_path: 'C:\\test\\file.ts',
        content: 'file content here',
      };

      const result = summarizeToolInput('Write', input);

      expect(result.file_path).toBe('C:\\test\\file.ts');
      expect(result.content).toBe('file content here');
    });

    it('should truncate long content for Write tool', () => {
      const longContent = 'x'.repeat(600);
      const input = {
        file_path: 'C:\\test\\file.ts',
        content: longContent,
      };

      const result = summarizeToolInput('Write', input);

      expect(result.file_path).toBe('C:\\test\\file.ts');
      expect((result.content as string).length).toBeLessThan(longContent.length);
      expect(result.content as string).toContain('...');
    });

    it('should return notebook_path for NotebookEdit tool', () => {
      const input = {
        notebook_path: 'C:\\test\\notebook.ipynb',
        cell_number: 5,
      };

      const result = summarizeToolInput('NotebookEdit', input);

      expect(result.notebook_path).toBe('C:\\test\\notebook.ipynb');
    });

    it('should truncate Bash command and include description', () => {
      const longCommand = 'x'.repeat(500);
      const input = {
        command: longCommand,
        description: 'Run test',
      };

      const result = summarizeToolInput('Bash', input);

      expect(result.description).toBe('Run test');
      expect(result.command!.length).toBeLessThan(longCommand.length);
      expect(result.command).toContain('...');
    });

    it('should keep only first line of Bash command', () => {
      const input = {
        command: 'line1\nline2\nline3',
      };

      const result = summarizeToolInput('Bash', input);

      expect(result.command).toBe('line1');
      expect(result.command).not.toContain('\n');
    });

    it('should return pattern and path for Glob/Grep', () => {
      const input = {
        pattern: '**/*.ts',
        path: 'C:\\project',
        extraOption: 'should be removed',
      };

      const resultGlob = summarizeToolInput('Glob', input);
      const resultGrep = summarizeToolInput('Grep', input);

      expect(resultGlob.pattern).toBe('**/*.ts');
      expect(resultGlob.path).toBe('C:\\project');
      expect(resultGlob.extraOption).toBeUndefined();

      expect(resultGrep.pattern).toBe('**/*.ts');
      expect(resultGrep.path).toBe('C:\\project');
    });

    it('should truncate string values for other tools', () => {
      const longValue = 'x'.repeat(500);
      const input = {
        shortValue: 'short',
        longValue: longValue,
      };

      const result = summarizeToolInput('OtherTool', input);

      expect(result.shortValue).toBe('short');
      expect(result.longValue.length).toBeLessThan(longValue.length);
      expect(result.longValue).toContain('...');
    });

    it('should return empty object if null or undefined', () => {
      expect(summarizeToolInput('Read', null)).toEqual({});
      expect(summarizeToolInput('Read', undefined)).toEqual({});
    });
  });

  describe('summarizeOutput', () => {
    it('should return short output as-is', () => {
      const output = 'Short output';

      const result = summarizeOutput(output);

      expect(result).toBe('Short output');
    });

    it('should truncate long output', () => {
      const longOutput = 'x'.repeat(1000);

      const result = summarizeOutput(longOutput);

      expect(result.length).toBeLessThan(longOutput.length);
      expect(result).toContain('...');
      expect(result).toContain('chars total');
    });

    it('should return non-string values as-is', () => {
      expect(summarizeOutput(null)).toBeNull();
      expect(summarizeOutput(undefined)).toBeUndefined();
      expect(summarizeOutput(123)).toBe(123);
    });
  });

  describe('truncateObjectValues', () => {
    it('should truncate long string values', () => {
      const obj = {
        short: 'short',
        long: 'x'.repeat(500),
      };

      const result = truncateObjectValues(obj, 100);

      expect(result.short).toBe('short');
      expect(result.long.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(result.long).toContain('...');
    });

    it('should handle nested objects', () => {
      const obj = {
        nested: {
          value: 'x'.repeat(200),
        },
      };

      const result = truncateObjectValues(obj, 50);

      expect(result.nested.value.length).toBeLessThanOrEqual(53);
    });

    it('should preserve non-string values', () => {
      const obj = {
        number: 123,
        boolean: true,
        nullValue: null,
      };

      const result = truncateObjectValues(obj, 50);

      expect(result.number).toBe(123);
      expect(result.boolean).toBe(true);
      expect(result.nullValue).toBeNull();
    });

    it('should return non-object values as-is', () => {
      expect(truncateObjectValues(null, 50)).toBeNull();
      expect(truncateObjectValues('string', 50)).toBe('string');
      expect(truncateObjectValues(123, 50)).toBe(123);
    });
  });
});
