/**
 * @file message-store.test.ts
 * @description MessageStore 테스트
 *
 * 세션별 메시지 히스토리 저장 기능을 테스트합니다.
 * 파일 I/O는 분리하여 모킹 없이 순수 로직을 테스트합니다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
  type MessageStoreData,
} from '../../src/stores/message-store.js';

describe('MessageStore', () => {
  let store: MessageStore;

  beforeEach(() => {
    store = new MessageStore();
  });

  // ============================================================================
  // 초기화 테스트
  // ============================================================================
  describe('초기화', () => {
    it('should have empty initial state', () => {
      expect(store.getCount(1)).toBe(0);
      expect(store.getMessages(1)).toEqual([]);
    });

    it('should initialize from existing data', () => {
      const existingData: MessageStoreData = {
        sessions: {
          1: {
            sessionId: 1,
            messages: [
              {
                id: 'msg_existing_1',
                role: 'user',
                type: 'text',
                content: 'Hello',
                timestamp: Date.now(),
              },
            ],
            updatedAt: Date.now(),
          },
        },
      };

      const loadedStore = new MessageStore(existingData);

      expect(loadedStore.getCount(1)).toBe(1);
      expect((loadedStore.getMessages(1)[0] as UserTextMessage).content).toBe('Hello');
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
        // loadBefore=8 → 인덱스 0~7 (Message 1~8) 중 마지막 3개
        const messages = store.getMessages(1, { limit: 3, loadBefore: 8 });
        expect(messages).toHaveLength(3);
        // 인덱스 5, 6, 7 → Message 6, 7, 8
        expect((messages[0] as UserTextMessage).content).toBe('Message 6');
        expect((messages[2] as UserTextMessage).content).toBe('Message 8');
      });

      it('should return empty array for non-existent session', () => {
        const messages = store.getMessages('non-existent');
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
        expect(store.getCount('non-existent')).toBe(0);
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

    describe('hasDirtyData / getDirtySessions', () => {
      it('should track dirty sessions', () => {
        expect(store.hasDirtyData()).toBe(false);

        store.addUserMessage(1, 'Message 1');

        expect(store.hasDirtyData()).toBe(true);
        expect(store.getDirtySessions()).toContain(1);
      });

      it('should clear dirty flag after markClean', () => {
        store.addUserMessage(1, 'Message 1');
        expect(store.hasDirtyData()).toBe(true);

        store.markClean(1);

        expect(store.hasDirtyData()).toBe(false);
        expect(store.getDirtySessions()).not.toContain(1);
      });
    });
  });

  // ============================================================================
  // 최대 메시지 수 제한 테스트
  // ============================================================================
  describe('최대 메시지 수 제한', () => {
    it('should trim messages when exceeding max', () => {
      // MAX_MESSAGES_PER_SESSION = 200
      for (let i = 1; i <= 210; i++) {
        store.addUserMessage(1, `Message ${i}`);
      }

      // trimMessages 호출 후 확인
      const trimmed = store.trimMessages(1);
      expect(trimmed).toBe(true);
      expect(store.getCount(1)).toBeLessThanOrEqual(200);
    });

    it('should keep recent messages when trimming', () => {
      for (let i = 1; i <= 210; i++) {
        store.addUserMessage(1, `Message ${i}`);
      }

      store.trimMessages(1);
      const messages = store.getMessages(1);

      // 최신 메시지가 남아있어야 함
      const lastMsg = messages[messages.length - 1] as UserTextMessage;
      expect(lastMsg.content).toBe('Message 210');
    });
  });

  // ============================================================================
  // 데이터 직렬화 테스트
  // ============================================================================
  describe('데이터 직렬화', () => {
    describe('toJSON', () => {
      it('should export all session data', () => {
        store.addUserMessage(1, 'Hello');
        store.addUserMessage(2, 'World');

        const data = store.toJSON();

        expect(data.sessions[1]).toBeDefined();
        expect(data.sessions[2]).toBeDefined();
        expect(data.sessions[1].messages).toHaveLength(1);
      });
    });

    describe('getSessionData', () => {
      it('should return single session data for file save', () => {
        store.addUserMessage(1, 'Hello');

        const data = store.getSessionData(1);

        expect(data).not.toBeNull();
        expect(data!.sessionId).toBe(1);
        expect(data!.messages).toHaveLength(1);
        expect(data!.updatedAt).toBeDefined();
      });

      it('should return null for non-existent session', () => {
        const data = store.getSessionData('non-existent');
        expect(data).toBeNull();
      });
    });

    describe('loadSessionData', () => {
      it('should load session data from external source', () => {
        const sessionData = {
          sessionId: 1,
          messages: [
            {
              id: 'msg_loaded_1',
              role: 'user' as const,
              type: 'text' as const,
              content: 'Loaded message',
              timestamp: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        };

        store.loadSessionData(1, sessionData);

        expect(store.getCount(1)).toBe(1);
        expect((store.getMessages(1)[0] as UserTextMessage).content).toBe(
          'Loaded message'
        );
      });
    });

    describe('fromJSON', () => {
      it('should restore from exported data', () => {
        store.addUserMessage(1, 'Test');
        const exported = store.toJSON();

        const restored = MessageStore.fromJSON(exported);

        expect(restored.getCount(1)).toBe(1);
        expect(
          (restored.getMessages(1)[0] as UserTextMessage).content
        ).toBe('Test');
      });
    });
  });
});

// ============================================================================
// 유틸리티 함수 테스트
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
      expect((result.old_string as string)).toContain('...');
      expect((result.new_string as string).length).toBeLessThan(longString.length);
      expect((result.new_string as string)).toContain('...');
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
      expect((result.content as string)).toContain('...');
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
