import { describe, it, expect, beforeEach } from 'vitest';
import { useClaudeStore, StoreMessage, PendingRequest } from './claudeStore';
import type { UserTextMessage, AssistantTextMessage } from '@estelle/core';

describe('claudeStore', () => {
  beforeEach(() => {
    useClaudeStore.getState().reset();
  });

  describe('초기 상태', () => {
    it('should have idle initial state', () => {
      const state = useClaudeStore.getState();

      expect(state.status).toBe('idle');
      expect(state.messages).toEqual([]);
      expect(state.pendingRequests).toEqual([]);
      expect(state.textBuffer).toBe('');
    });
  });

  describe('상태 관리', () => {
    it('should update status', () => {
      const { setStatus } = useClaudeStore.getState();

      setStatus('working');

      expect(useClaudeStore.getState().status).toBe('working');
    });

    it('should track work start time when status changes to working', () => {
      const { setStatus } = useClaudeStore.getState();
      const before = Date.now();

      setStatus('working');

      const state = useClaudeStore.getState();
      expect(state.workStartTime).toBeGreaterThanOrEqual(before);
      expect(state.workStartTime).toBeLessThanOrEqual(Date.now());
    });

    it('should clear work start time when status changes to idle', () => {
      const { setStatus } = useClaudeStore.getState();

      setStatus('working');
      setStatus('idle');

      expect(useClaudeStore.getState().workStartTime).toBeNull();
    });
  });

  describe('메시지 관리', () => {
    const userMessage: UserTextMessage = {
      id: 'msg-1',
      role: 'user',
      type: 'text',
      content: 'Hello',
      timestamp: Date.now(),
    };

    const assistantMessage: AssistantTextMessage = {
      id: 'msg-2',
      role: 'assistant',
      type: 'text',
      content: 'Hi there!',
      timestamp: Date.now(),
    };

    it('should add message', () => {
      const { addMessage } = useClaudeStore.getState();

      addMessage(userMessage);

      expect(useClaudeStore.getState().messages).toHaveLength(1);
      expect(useClaudeStore.getState().messages[0]).toEqual(userMessage);
    });

    it('should add multiple messages in order', () => {
      const { addMessage } = useClaudeStore.getState();

      addMessage(userMessage);
      addMessage(assistantMessage);

      const messages = useClaudeStore.getState().messages;
      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[1].id).toBe('msg-2');
    });

    it('should set messages (replace all)', () => {
      const { addMessage, setMessages } = useClaudeStore.getState();

      addMessage(userMessage);
      setMessages([assistantMessage]);

      const messages = useClaudeStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-2');
    });

    it('should clear messages', () => {
      const { addMessage, clearMessages } = useClaudeStore.getState();

      addMessage(userMessage);
      addMessage(assistantMessage);
      clearMessages();

      expect(useClaudeStore.getState().messages).toEqual([]);
    });
  });

  describe('텍스트 버퍼 (스트리밍)', () => {
    it('should append to text buffer', () => {
      const { appendTextBuffer } = useClaudeStore.getState();

      appendTextBuffer('Hello ');
      appendTextBuffer('World');

      expect(useClaudeStore.getState().textBuffer).toBe('Hello World');
    });

    it('should clear text buffer', () => {
      const { appendTextBuffer, clearTextBuffer } = useClaudeStore.getState();

      appendTextBuffer('Hello');
      clearTextBuffer();

      expect(useClaudeStore.getState().textBuffer).toBe('');
    });

    it('should flush text buffer to message', () => {
      const { appendTextBuffer, flushTextBuffer } = useClaudeStore.getState();

      appendTextBuffer('Hello World');
      flushTextBuffer();

      const state = useClaudeStore.getState();
      expect(state.textBuffer).toBe('');
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].type).toBe('text');
      expect(state.messages[0].role).toBe('assistant');
      expect((state.messages[0] as AssistantTextMessage).content).toBe('Hello World');
    });

    it('should not flush empty buffer', () => {
      const { flushTextBuffer } = useClaudeStore.getState();

      flushTextBuffer();

      expect(useClaudeStore.getState().messages).toHaveLength(0);
    });
  });

  describe('권한/질문 요청 관리', () => {
    const permissionRequest: PendingRequest = {
      type: 'permission',
      toolUseId: 'tool-1',
      toolName: 'write_file',
      toolInput: { path: '/test.txt', content: 'test' },
    };

    const questionRequest: PendingRequest = {
      type: 'question',
      toolUseId: 'tool-2',
      question: 'Which framework?',
      options: ['React', 'Vue', 'Angular'],
    };

    it('should add pending request', () => {
      const { addPendingRequest } = useClaudeStore.getState();

      addPendingRequest(permissionRequest);

      expect(useClaudeStore.getState().pendingRequests).toHaveLength(1);
    });

    it('should remove pending request by toolUseId', () => {
      const { addPendingRequest, removePendingRequest } = useClaudeStore.getState();

      addPendingRequest(permissionRequest);
      addPendingRequest(questionRequest);
      removePendingRequest('tool-1');

      const requests = useClaudeStore.getState().pendingRequests;
      expect(requests).toHaveLength(1);
      expect(requests[0].toolUseId).toBe('tool-2');
    });

    it('should check if has pending requests', () => {
      const { addPendingRequest } = useClaudeStore.getState();

      expect(useClaudeStore.getState().hasPendingRequests).toBe(false);

      addPendingRequest(permissionRequest);

      expect(useClaudeStore.getState().hasPendingRequests).toBe(true);
    });
  });

  describe('데스크 전환 시 캐시', () => {
    const msg1: UserTextMessage = {
      id: 'msg-1',
      role: 'user',
      type: 'text',
      content: 'Hello',
      timestamp: Date.now(),
    };

    it('should cache messages when switching desk', () => {
      const { addMessage, switchDesk, setMessages } = useClaudeStore.getState();

      // desk1에 메시지 추가
      addMessage(msg1);

      // desk2로 전환 (메시지 캐시됨)
      switchDesk('desk1', 'desk2');

      // desk2는 빈 상태
      expect(useClaudeStore.getState().messages).toHaveLength(0);

      // desk1로 다시 전환
      switchDesk('desk2', 'desk1');

      // 캐시된 메시지 복원
      expect(useClaudeStore.getState().messages).toHaveLength(1);
      expect(useClaudeStore.getState().messages[0].id).toBe('msg-1');
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const { setStatus, addMessage, appendTextBuffer, addPendingRequest, reset } =
        useClaudeStore.getState();

      setStatus('working');
      addMessage({
        id: 'msg-1',
        role: 'user',
        type: 'text',
        content: 'test',
        timestamp: Date.now(),
      } as UserTextMessage);
      appendTextBuffer('test');
      addPendingRequest({
        type: 'permission',
        toolUseId: 'tool-1',
        toolName: 'test',
        toolInput: {},
      });

      reset();

      const state = useClaudeStore.getState();
      expect(state.status).toBe('idle');
      expect(state.messages).toEqual([]);
      expect(state.textBuffer).toBe('');
      expect(state.pendingRequests).toEqual([]);
    });
  });
});
