/**
 * @file conversationStore.test.ts
 * @description conversationStore 테스트
 *
 * 대화별 Claude 상태 관리 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { StoreMessage, PendingRequest } from '@estelle/core';
import { useConversationStore, getInitialClaudeState } from './conversationStore';

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

function createPermissionRequest(toolUseId: string, toolName: string): PendingRequest {
  return {
    type: 'permission',
    toolUseId,
    toolName,
    toolInput: {},
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('conversationStore', () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
  });

  describe('초기 상태', () => {
    it('초기 상태는 빈 Map과 null currentConversationId', () => {
      const state = useConversationStore.getState();

      expect(state.currentConversationId).toBeNull();
      expect(state.states.size).toBe(0);
    });

    it('getInitialClaudeState는 올바른 초기값 반환', () => {
      const initial = getInitialClaudeState();

      expect(initial.status).toBe('idle');
      expect(initial.messages).toEqual([]);
      expect(initial.textBuffer).toBe('');
      expect(initial.pendingRequests).toEqual([]);
      expect(initial.workStartTime).toBeNull();
      expect(initial.realtimeUsage).toBeNull();
    });
  });

  describe('대화 선택', () => {
    it('setCurrentConversation으로 현재 대화 설정', () => {
      const { setCurrentConversation } = useConversationStore.getState();

      setCurrentConversation('conv-1');

      expect(useConversationStore.getState().currentConversationId).toBe('conv-1');
    });

    it('존재하지 않는 대화 선택 시 초기 상태 생성', () => {
      const { setCurrentConversation, getState: getConvState } = useConversationStore.getState();

      setCurrentConversation('conv-1');
      const state = getConvState('conv-1');

      expect(state).not.toBeNull();
      expect(state?.status).toBe('idle');
      expect(state?.messages).toEqual([]);
    });

    it('getCurrentState는 현재 선택된 대화의 상태 반환', () => {
      const store = useConversationStore.getState();

      store.setCurrentConversation('conv-1');
      store.setStatus('conv-1', 'working');

      const current = store.getCurrentState();

      expect(current?.status).toBe('working');
    });

    it('getCurrentState는 대화 미선택 시 null 반환', () => {
      const current = useConversationStore.getState().getCurrentState();

      expect(current).toBeNull();
    });
  });

  describe('대화별 상태 독립성', () => {
    it('서로 다른 대화는 독립적인 상태 유지', () => {
      const store = useConversationStore.getState();

      // 대화 1 설정
      store.setCurrentConversation('conv-1');
      store.setStatus('conv-1', 'working');
      store.addMessage('conv-1', createUserMessage('msg-1', 'Hello from conv-1'));

      // 대화 2 설정
      store.setCurrentConversation('conv-2');
      store.setStatus('conv-2', 'idle');
      store.addMessage('conv-2', createUserMessage('msg-2', 'Hello from conv-2'));

      // 각 대화 상태 확인
      const state1 = store.getState('conv-1');
      const state2 = store.getState('conv-2');

      expect(state1?.status).toBe('working');
      expect(state1?.messages).toHaveLength(1);
      expect((state1?.messages[0] as any).content).toBe('Hello from conv-1');

      expect(state2?.status).toBe('idle');
      expect(state2?.messages).toHaveLength(1);
      expect((state2?.messages[0] as any).content).toBe('Hello from conv-2');
    });

    it('대화 전환 시 이전 대화 상태 유지', () => {
      const store = useConversationStore.getState();

      // 대화 1에서 작업
      store.setCurrentConversation('conv-1');
      store.setStatus('conv-1', 'working');
      store.addMessage('conv-1', createUserMessage('msg-1', 'Working on conv-1'));

      // 대화 2로 전환
      store.setCurrentConversation('conv-2');

      // 다시 대화 1로 복귀
      store.setCurrentConversation('conv-1');

      // 대화 1 상태가 유지되어 있어야 함
      const current = store.getCurrentState();
      expect(current?.status).toBe('working');
      expect(current?.messages).toHaveLength(1);
    });
  });

  describe('status 관리', () => {
    it('setStatus로 상태 변경', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.setStatus('conv-1', 'working');
      expect(store.getState('conv-1')?.status).toBe('working');

      store.setStatus('conv-1', 'permission');
      expect(store.getState('conv-1')?.status).toBe('permission');

      store.setStatus('conv-1', 'idle');
      expect(store.getState('conv-1')?.status).toBe('idle');
    });

    it('working 상태로 변경 시 workStartTime 설정', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      const before = Date.now();
      store.setStatus('conv-1', 'working');
      const after = Date.now();

      const workStartTime = store.getState('conv-1')?.workStartTime;
      expect(workStartTime).toBeGreaterThanOrEqual(before);
      expect(workStartTime).toBeLessThanOrEqual(after);
    });

    it('idle 상태로 변경 시 workStartTime과 realtimeUsage 초기화', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      // working 상태로 설정
      store.setStatus('conv-1', 'working');
      expect(store.getState('conv-1')?.workStartTime).not.toBeNull();

      // idle로 변경
      store.setStatus('conv-1', 'idle');
      expect(store.getState('conv-1')?.workStartTime).toBeNull();
      expect(store.getState('conv-1')?.realtimeUsage).toBeNull();
    });

    it('다른 대화의 status 변경은 현재 대화에 영향 없음', () => {
      const store = useConversationStore.getState();

      store.setCurrentConversation('conv-1');
      store.setStatus('conv-1', 'idle');

      store.setCurrentConversation('conv-2');
      store.setStatus('conv-2', 'working');

      // conv-1은 여전히 idle
      expect(store.getState('conv-1')?.status).toBe('idle');
      // conv-2는 working
      expect(store.getState('conv-2')?.status).toBe('working');
    });
  });

  describe('messages 관리', () => {
    it('addMessage로 메시지 추가', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.addMessage('conv-1', createUserMessage('msg-1', 'Hello'));
      store.addMessage('conv-1', createUserMessage('msg-2', 'World'));

      const messages = store.getState('conv-1')?.messages;
      expect(messages).toHaveLength(2);
      expect((messages?.[0] as any).content).toBe('Hello');
      expect((messages?.[1] as any).content).toBe('World');
    });

    it('setMessages로 메시지 목록 교체', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      // 기존 메시지 추가
      store.addMessage('conv-1', createUserMessage('old-1', 'Old message'));

      // 새 메시지로 교체
      store.setMessages('conv-1', [
        createUserMessage('new-1', 'New message 1'),
        createUserMessage('new-2', 'New message 2'),
      ]);

      const messages = store.getState('conv-1')?.messages;
      expect(messages).toHaveLength(2);
      expect((messages?.[0] as any).content).toBe('New message 1');
    });

    it('clearMessages로 메시지 삭제', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.addMessage('conv-1', createUserMessage('msg-1', 'Hello'));
      expect(store.getState('conv-1')?.messages).toHaveLength(1);

      store.clearMessages('conv-1');
      expect(store.getState('conv-1')?.messages).toHaveLength(0);
    });

    it('clearMessages는 pendingRequests도 함께 삭제', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.addMessage('conv-1', createUserMessage('msg-1', 'Hello'));
      store.addPendingRequest('conv-1', createPermissionRequest('tool-1', 'Bash'));

      store.clearMessages('conv-1');

      expect(store.getState('conv-1')?.messages).toHaveLength(0);
      expect(store.getState('conv-1')?.pendingRequests).toHaveLength(0);
    });
  });

  describe('textBuffer 관리', () => {
    it('appendTextBuffer로 텍스트 추가', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.appendTextBuffer('conv-1', 'Hello');
      store.appendTextBuffer('conv-1', ' World');

      expect(store.getState('conv-1')?.textBuffer).toBe('Hello World');
    });

    it('clearTextBuffer로 버퍼 비우기', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.appendTextBuffer('conv-1', 'Hello');
      store.clearTextBuffer('conv-1');

      expect(store.getState('conv-1')?.textBuffer).toBe('');
    });

    it('flushTextBuffer로 버퍼를 메시지로 변환', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.appendTextBuffer('conv-1', 'Hello World');
      store.flushTextBuffer('conv-1');

      const state = store.getState('conv-1');
      expect(state?.textBuffer).toBe('');
      expect(state?.messages).toHaveLength(1);
      expect(state?.messages[0].type).toBe('text');
      expect(state?.messages[0].role).toBe('assistant');
      expect((state?.messages[0] as any).content).toBe('Hello World');
    });

    it('flushTextBuffer는 빈 버퍼일 때 아무것도 안 함', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.flushTextBuffer('conv-1');

      expect(store.getState('conv-1')?.messages).toHaveLength(0);
    });

    it('flushTextBuffer는 공백만 있는 버퍼일 때도 아무것도 안 함', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.appendTextBuffer('conv-1', '   ');
      store.flushTextBuffer('conv-1');

      expect(store.getState('conv-1')?.messages).toHaveLength(0);
      expect(store.getState('conv-1')?.textBuffer).toBe('');
    });
  });

  describe('pendingRequests 관리', () => {
    it('addPendingRequest로 요청 추가', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.addPendingRequest('conv-1', createPermissionRequest('tool-1', 'Bash'));

      const requests = store.getState('conv-1')?.pendingRequests;
      expect(requests).toHaveLength(1);
      expect((requests?.[0] as any).toolName).toBe('Bash');
    });

    it('removePendingRequest로 요청 제거', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      store.addPendingRequest('conv-1', createPermissionRequest('tool-1', 'Bash'));
      store.addPendingRequest('conv-1', createPermissionRequest('tool-2', 'Write'));

      store.removePendingRequest('conv-1', 'tool-1');

      const requests = store.getState('conv-1')?.pendingRequests;
      expect(requests).toHaveLength(1);
      expect(requests?.[0].toolUseId).toBe('tool-2');
    });

    it('hasPendingRequests 계산', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');

      expect(store.hasPendingRequests('conv-1')).toBe(false);

      store.addPendingRequest('conv-1', createPermissionRequest('tool-1', 'Bash'));
      expect(store.hasPendingRequests('conv-1')).toBe(true);

      store.removePendingRequest('conv-1', 'tool-1');
      expect(store.hasPendingRequests('conv-1')).toBe(false);
    });
  });

  describe('realtimeUsage 관리', () => {
    it('updateRealtimeUsage로 사용량 업데이트', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');
      store.setStatus('conv-1', 'working');

      store.updateRealtimeUsage('conv-1', {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 10,
        cacheCreationInputTokens: 5,
      });

      const usage = store.getState('conv-1')?.realtimeUsage;
      expect(usage?.inputTokens).toBe(100);
      expect(usage?.outputTokens).toBe(50);
    });

    it('updateRealtimeUsage는 lastUpdateType을 자동 결정', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation('conv-1');
      store.setStatus('conv-1', 'working');

      // 첫 업데이트 - input이 기본
      store.updateRealtimeUsage('conv-1', {
        inputTokens: 100,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      });
      expect(store.getState('conv-1')?.realtimeUsage?.lastUpdateType).toBe('input');

      // output이 증가하면 output
      store.updateRealtimeUsage('conv-1', {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      });
      expect(store.getState('conv-1')?.realtimeUsage?.lastUpdateType).toBe('output');
    });
  });

  describe('대화 삭제', () => {
    it('deleteConversation으로 대화 상태 삭제', () => {
      const store = useConversationStore.getState();

      store.setCurrentConversation('conv-1');
      store.addMessage('conv-1', createUserMessage('msg-1', 'Hello'));

      store.deleteConversation('conv-1');

      expect(store.getState('conv-1')).toBeNull();
    });

    it('현재 선택된 대화 삭제 시 currentConversationId null로', () => {
      const { setCurrentConversation, deleteConversation } = useConversationStore.getState();

      setCurrentConversation('conv-1');
      deleteConversation('conv-1');

      expect(useConversationStore.getState().currentConversationId).toBeNull();
    });

    it('다른 대화 삭제 시 currentConversationId 유지', () => {
      const { setCurrentConversation, deleteConversation } = useConversationStore.getState();

      setCurrentConversation('conv-1');
      setCurrentConversation('conv-2');
      deleteConversation('conv-1');

      expect(useConversationStore.getState().currentConversationId).toBe('conv-2');
    });
  });

  describe('reset', () => {
    it('reset으로 전체 상태 초기화', () => {
      const { setCurrentConversation, addMessage, reset } = useConversationStore.getState();

      setCurrentConversation('conv-1');
      addMessage('conv-1', createUserMessage('msg-1', 'Hello'));
      setCurrentConversation('conv-2');

      reset();

      const state = useConversationStore.getState();
      expect(state.currentConversationId).toBeNull();
      expect(state.states.size).toBe(0);
    });
  });
});
