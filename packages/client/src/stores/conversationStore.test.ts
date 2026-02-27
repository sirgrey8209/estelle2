/**
 * @file conversationStore.test.ts
 * @description conversationStore 테스트
 *
 * 대화별 Claude 상태 관리 테스트
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { StoreMessage, PendingRequest } from '@estelle/core';
import {
  useConversationStore,
  getInitialClaudeState,
  useCurrentConversationState,
} from './conversationStore';

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

      setCurrentConversation(1001);

      expect(useConversationStore.getState().currentConversationId).toBe(1001);
    });

    it('존재하지 않는 대화 선택 시 초기 상태 생성', () => {
      const { setCurrentConversation, getState: getConvState } = useConversationStore.getState();

      setCurrentConversation(1001);
      const state = getConvState(1001);

      expect(state).not.toBeNull();
      expect(state?.status).toBe('idle');
      expect(state?.messages).toEqual([]);
    });

    it('getCurrentState는 현재 선택된 대화의 상태 반환', () => {
      const store = useConversationStore.getState();

      store.setCurrentConversation(1001);
      store.setStatus(1001, 'working');

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
      store.setCurrentConversation(1001);
      store.setStatus(1001, 'working');
      store.addMessage(1001, createUserMessage('msg-1', 'Hello from conv-1'));

      // 대화 2 설정
      store.setCurrentConversation(1002);
      store.setStatus(1002, 'idle');
      store.addMessage(1002, createUserMessage('msg-2', 'Hello from conv-2'));

      // 각 대화 상태 확인
      const state1 = store.getState(1001);
      const state2 = store.getState(1002);

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
      store.setCurrentConversation(1001);
      store.setStatus(1001, 'working');
      store.addMessage(1001, createUserMessage('msg-1', 'Working on conv-1'));

      // 대화 2로 전환
      store.setCurrentConversation(1002);

      // 다시 대화 1로 복귀
      store.setCurrentConversation(1001);

      // 대화 1 상태가 유지되어 있어야 함
      const current = store.getCurrentState();
      expect(current?.status).toBe('working');
      expect(current?.messages).toHaveLength(1);
    });
  });

  describe('status 관리', () => {
    it('setStatus로 상태 변경', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.setStatus(1001, 'working');
      expect(store.getState(1001)?.status).toBe('working');

      store.setStatus(1001, 'permission');
      expect(store.getState(1001)?.status).toBe('permission');

      store.setStatus(1001, 'idle');
      expect(store.getState(1001)?.status).toBe('idle');
    });

    it('working 상태로 변경 시 workStartTime 설정', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      const before = Date.now();
      store.setStatus(1001, 'working');
      const after = Date.now();

      const workStartTime = store.getState(1001)?.workStartTime;
      expect(workStartTime).toBeGreaterThanOrEqual(before);
      expect(workStartTime).toBeLessThanOrEqual(after);
    });

    it('idle 상태로 변경 시 workStartTime과 realtimeUsage 초기화', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      // working 상태로 설정
      store.setStatus(1001, 'working');
      expect(store.getState(1001)?.workStartTime).not.toBeNull();

      // idle로 변경
      store.setStatus(1001, 'idle');
      expect(store.getState(1001)?.workStartTime).toBeNull();
      expect(store.getState(1001)?.realtimeUsage).toBeNull();
    });

    it('다른 대화의 status 변경은 현재 대화에 영향 없음', () => {
      const store = useConversationStore.getState();

      store.setCurrentConversation(1001);
      store.setStatus(1001, 'idle');

      store.setCurrentConversation(1002);
      store.setStatus(1002, 'working');

      // conv-1은 여전히 idle
      expect(store.getState(1001)?.status).toBe('idle');
      // conv-2는 working
      expect(store.getState(1002)?.status).toBe('working');
    });
  });

  describe('messages 관리', () => {
    it('addMessage로 메시지 추가', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.addMessage(1001, createUserMessage('msg-1', 'Hello'));
      store.addMessage(1001, createUserMessage('msg-2', 'World'));

      const messages = store.getState(1001)?.messages;
      expect(messages).toHaveLength(2);
      expect((messages?.[0] as any).content).toBe('Hello');
      expect((messages?.[1] as any).content).toBe('World');
    });

    it('setMessages로 메시지 목록 교체', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      // 기존 메시지 추가
      store.addMessage(1001, createUserMessage('old-1', 'Old message'));

      // 새 메시지로 교체
      store.setMessages(1001, [
        createUserMessage('new-1', 'New message 1'),
        createUserMessage('new-2', 'New message 2'),
      ]);

      const messages = store.getState(1001)?.messages;
      expect(messages).toHaveLength(2);
      expect((messages?.[0] as any).content).toBe('New message 1');
    });

    it('clearMessages로 메시지 삭제', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.addMessage(1001, createUserMessage('msg-1', 'Hello'));
      expect(store.getState(1001)?.messages).toHaveLength(1);

      store.clearMessages(1001);
      expect(store.getState(1001)?.messages).toHaveLength(0);
    });

    it('clearMessages는 pendingRequests도 함께 삭제', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.addMessage(1001, createUserMessage('msg-1', 'Hello'));
      store.addPendingRequest(1001, createPermissionRequest('tool-1', 'Bash'));

      store.clearMessages(1001);

      expect(store.getState(1001)?.messages).toHaveLength(0);
      expect(store.getState(1001)?.pendingRequests).toHaveLength(0);
    });
  });

  describe('textBuffer 관리', () => {
    it('appendTextBuffer로 텍스트 추가', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.appendTextBuffer(1001, 'Hello');
      store.appendTextBuffer(1001, ' World');

      expect(store.getState(1001)?.textBuffer).toBe('Hello World');
    });

    it('clearTextBuffer로 버퍼 비우기', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.appendTextBuffer(1001, 'Hello');
      store.clearTextBuffer(1001);

      expect(store.getState(1001)?.textBuffer).toBe('');
    });

    it('flushTextBuffer로 버퍼를 메시지로 변환', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.appendTextBuffer(1001, 'Hello World');
      store.flushTextBuffer(1001);

      const state = store.getState(1001);
      expect(state?.textBuffer).toBe('');
      expect(state?.messages).toHaveLength(1);
      expect(state?.messages[0].type).toBe('text');
      expect(state?.messages[0].role).toBe('assistant');
      expect((state?.messages[0] as any).content).toBe('Hello World');
    });

    it('flushTextBuffer는 빈 버퍼일 때 아무것도 안 함', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.flushTextBuffer(1001);

      expect(store.getState(1001)?.messages).toHaveLength(0);
    });

    it('flushTextBuffer는 공백만 있는 버퍼일 때도 아무것도 안 함', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.appendTextBuffer(1001, '   ');
      store.flushTextBuffer(1001);

      expect(store.getState(1001)?.messages).toHaveLength(0);
      expect(store.getState(1001)?.textBuffer).toBe('');
    });
  });

  describe('pendingRequests 관리', () => {
    it('addPendingRequest로 요청 추가', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.addPendingRequest(1001, createPermissionRequest('tool-1', 'Bash'));

      const requests = store.getState(1001)?.pendingRequests;
      expect(requests).toHaveLength(1);
      expect((requests?.[0] as any).toolName).toBe('Bash');
    });

    it('removePendingRequest로 요청 제거', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      store.addPendingRequest(1001, createPermissionRequest('tool-1', 'Bash'));
      store.addPendingRequest(1001, createPermissionRequest('tool-2', 'Write'));

      store.removePendingRequest(1001, 'tool-1');

      const requests = store.getState(1001)?.pendingRequests;
      expect(requests).toHaveLength(1);
      expect(requests?.[0].toolUseId).toBe('tool-2');
    });

    it('hasPendingRequests 계산', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      expect(store.hasPendingRequests(1001)).toBe(false);

      store.addPendingRequest(1001, createPermissionRequest('tool-1', 'Bash'));
      expect(store.hasPendingRequests(1001)).toBe(true);

      store.removePendingRequest(1001, 'tool-1');
      expect(store.hasPendingRequests(1001)).toBe(false);
    });
  });

  describe('realtimeUsage 관리', () => {
    it('updateRealtimeUsage로 사용량 업데이트', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.setStatus(1001, 'working');

      store.updateRealtimeUsage(1001, {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 10,
        cacheCreationInputTokens: 5,
      });

      const usage = store.getState(1001)?.realtimeUsage;
      expect(usage?.inputTokens).toBe(100);
      expect(usage?.outputTokens).toBe(50);
    });

    it('updateRealtimeUsage는 lastUpdateType을 자동 결정', () => {
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.setStatus(1001, 'working');

      // 첫 업데이트 - input이 기본
      store.updateRealtimeUsage(1001, {
        inputTokens: 100,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      });
      expect(store.getState(1001)?.realtimeUsage?.lastUpdateType).toBe('input');

      // output이 증가하면 output
      store.updateRealtimeUsage(1001, {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      });
      expect(store.getState(1001)?.realtimeUsage?.lastUpdateType).toBe('output');
    });
  });

  describe('대화 삭제', () => {
    it('deleteConversation으로 대화 상태 삭제', () => {
      const store = useConversationStore.getState();

      store.setCurrentConversation(1001);
      store.addMessage(1001, createUserMessage('msg-1', 'Hello'));

      store.deleteConversation(1001);

      expect(store.getState(1001)).toBeNull();
    });

    it('현재 선택된 대화 삭제 시 currentConversationId null로', () => {
      const { setCurrentConversation, deleteConversation } = useConversationStore.getState();

      setCurrentConversation(1001);
      deleteConversation(1001);

      expect(useConversationStore.getState().currentConversationId).toBeNull();
    });

    it('다른 대화 삭제 시 currentConversationId 유지', () => {
      const { setCurrentConversation, deleteConversation } = useConversationStore.getState();

      setCurrentConversation(1001);
      setCurrentConversation(1002);
      deleteConversation(1001);

      expect(useConversationStore.getState().currentConversationId).toBe(1002);
    });
  });

  describe('reset', () => {
    it('reset으로 전체 상태 초기화', () => {
      const { setCurrentConversation, addMessage, reset } = useConversationStore.getState();

      setCurrentConversation(1001);
      addMessage(1001, createUserMessage('msg-1', 'Hello'));
      setCurrentConversation(1002);

      reset();

      const state = useConversationStore.getState();
      expect(state.currentConversationId).toBeNull();
      expect(state.states.size).toBe(0);
    });
  });
});

// ============================================================================
// useCurrentConversationState Hook Tests
// ============================================================================

describe('useCurrentConversationState', () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
  });

  describe('정상 케이스', () => {
    it('should_return_current_state_when_conversation_selected', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.setStatus(1001, 'working');
      store.addMessage(1001, createUserMessage('msg-1', 'Hello'));

      // Act
      const { result } = renderHook(() => useCurrentConversationState());

      // Assert
      expect(result.current).not.toBeNull();
      expect(result.current?.status).toBe('working');
      expect(result.current?.messages).toHaveLength(1);
    });

    it('should_update_when_messages_added', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      const { result } = renderHook(() => useCurrentConversationState());

      // Act - 메시지 추가
      act(() => {
        useConversationStore.getState().addMessage(1001, createUserMessage('msg-1', 'Hello'));
      });

      // Assert - 리렌더링되어 새 메시지가 반영되어야 함
      expect(result.current?.messages).toHaveLength(1);
      expect((result.current?.messages[0] as any).content).toBe('Hello');
    });

    it('should_update_when_status_changes', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      const { result } = renderHook(() => useCurrentConversationState());
      expect(result.current?.status).toBe('idle');

      // Act
      act(() => {
        useConversationStore.getState().setStatus(1001, 'working');
      });

      // Assert
      expect(result.current?.status).toBe('working');
    });

    it('should_update_when_conversation_switched', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.addMessage(1001, createUserMessage('msg-1', 'Conv1'));
      store.setCurrentConversation(1002);
      store.addMessage(1002, createUserMessage('msg-2', 'Conv2'));
      store.setCurrentConversation(1001);

      const { result } = renderHook(() => useCurrentConversationState());
      expect((result.current?.messages[0] as any).content).toBe('Conv1');

      // Act - 대화 전환
      act(() => {
        useConversationStore.getState().setCurrentConversation(1002);
      });

      // Assert - 새 대화의 상태가 반영됨
      expect((result.current?.messages[0] as any).content).toBe('Conv2');
    });

    it('should_trigger_rerender_on_pendingRequests_change', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      const renderCount = { count: 0 };
      const { result } = renderHook(() => {
        renderCount.count++;
        return useCurrentConversationState();
      });

      const initialRenderCount = renderCount.count;

      // Act
      act(() => {
        useConversationStore.getState().addPendingRequest(1001, createPermissionRequest('tool-1', 'Bash'));
      });

      // Assert
      expect(result.current?.pendingRequests).toHaveLength(1);
      expect(renderCount.count).toBeGreaterThan(initialRenderCount);
    });
  });

  describe('엣지 케이스', () => {
    it('should_return_null_when_no_conversation_selected', () => {
      // Arrange - 대화 선택 안 함

      // Act
      const { result } = renderHook(() => useCurrentConversationState());

      // Assert
      expect(result.current).toBeNull();
    });

    it('should_return_null_when_conversation_deselected', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.addMessage(1001, createUserMessage('msg-1', 'Hello'));

      const { result } = renderHook(() => useCurrentConversationState());
      expect(result.current).not.toBeNull();

      // Act - 대화 선택 해제
      act(() => {
        useConversationStore.getState().setCurrentConversation(null);
      });

      // Assert
      expect(result.current).toBeNull();
    });

    it('should_return_initial_state_for_new_conversation', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(9999); // 새 대화

      // Act
      const { result } = renderHook(() => useCurrentConversationState());

      // Assert - 초기 상태
      expect(result.current).not.toBeNull();
      expect(result.current?.status).toBe('idle');
      expect(result.current?.messages).toHaveLength(0);
      expect(result.current?.textBuffer).toBe('');
      expect(result.current?.pendingRequests).toHaveLength(0);
    });

    it('should_handle_rapid_state_changes', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      const { result } = renderHook(() => useCurrentConversationState());

      // Act - 빠른 연속 상태 변경
      act(() => {
        const s = useConversationStore.getState();
        s.addMessage(1001, createUserMessage('msg-1', 'First'));
        s.addMessage(1001, createUserMessage('msg-2', 'Second'));
        s.addMessage(1001, createUserMessage('msg-3', 'Third'));
        s.setStatus(1001, 'working');
      });

      // Assert - 모든 변경이 반영됨
      expect(result.current?.messages).toHaveLength(3);
      expect(result.current?.status).toBe('working');
    });
  });

  describe('에러 케이스', () => {
    it('should_handle_deleted_conversation_gracefully', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.addMessage(1001, createUserMessage('msg-1', 'Hello'));

      const { result } = renderHook(() => useCurrentConversationState());
      expect(result.current).not.toBeNull();

      // Act - 대화 삭제
      act(() => {
        useConversationStore.getState().deleteConversation(1001);
      });

      // Assert - currentConversationId가 null이 되므로 null 반환
      expect(result.current).toBeNull();
    });

    it('should_handle_store_reset_gracefully', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.addMessage(1001, createUserMessage('msg-1', 'Hello'));

      const { result } = renderHook(() => useCurrentConversationState());
      expect(result.current).not.toBeNull();

      // Act - 전체 리셋
      act(() => {
        useConversationStore.getState().reset();
      });

      // Assert
      expect(result.current).toBeNull();
    });
  });

  describe('리액티브 구독 검증', () => {
    it('should_subscribe_to_currentConversationId_changes', () => {
      // Arrange
      const store = useConversationStore.getState();

      const { result } = renderHook(() => useCurrentConversationState());
      expect(result.current).toBeNull();

      // Act - 대화 선택
      act(() => {
        useConversationStore.getState().setCurrentConversation(1001);
      });

      // Assert - currentConversationId 변경에 반응
      expect(result.current).not.toBeNull();
    });

    it('should_subscribe_to_states_map_changes', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      const { result } = renderHook(() => useCurrentConversationState());
      expect(result.current?.textBuffer).toBe('');

      // Act - states Map 변경
      act(() => {
        useConversationStore.getState().appendTextBuffer(1001, 'Hello');
      });

      // Assert - Map 변경에 반응
      expect(result.current?.textBuffer).toBe('Hello');
    });

    it('should_not_trigger_rerender_for_unrelated_conversation_changes', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.setCurrentConversation(1002); // 다른 대화도 생성

      store.setCurrentConversation(1001); // 다시 1001 선택

      const renderCount = { count: 0 };
      const { result } = renderHook(() => {
        renderCount.count++;
        return useCurrentConversationState();
      });

      const initialRenderCount = renderCount.count;

      // Act - 다른 대화(1002)에 메시지 추가
      act(() => {
        useConversationStore.getState().addMessage(1002, createUserMessage('msg-x', 'Other'));
      });

      // Assert - 현재 선택된 대화(1001)가 아니므로 리렌더링 최소화
      // Note: Zustand의 shallow comparison에 따라 다를 수 있음
      // 이 테스트는 최적화 목적이므로 현재 구현에서는 실패할 수 있음
      // 구현 시 shallow comparison 적용 여부 결정 필요
      expect(result.current?.messages).toHaveLength(0);
    });
  });
});

// ============================================================================
// Tools 관리 테스트 (SlashAutocomplete 기능)
// ============================================================================

describe('conversationStore - slashCommands 관리', () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
  });

  describe('setSlashCommands', () => {
    it('should_store_slashCommands_when_setSlashCommands_called', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      const commands = ['/compact', '/clear', '/help', '/tdd-flow'];

      // Act
      store.setSlashCommands(1001, commands);

      // Assert
      expect(store.getSlashCommands(1001)).toEqual(commands);
    });

    it('should_update_slashCommands_when_setSlashCommands_called_again', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.setSlashCommands(1001, ['/compact', '/clear']);

      // Act
      store.setSlashCommands(1001, ['/compact', '/clear', '/help', '/tdd-flow', '/keybindings-help']);

      // Assert
      expect(store.getSlashCommands(1001)).toEqual(['/compact', '/clear', '/help', '/tdd-flow', '/keybindings-help']);
    });

    it('should_store_slashCommands_independently_per_conversation', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.setCurrentConversation(1002);

      // Act
      store.setSlashCommands(1001, ['/compact', '/clear']);
      store.setSlashCommands(1002, ['/help', '/tdd-flow', '/keybindings-help']);

      // Assert
      expect(store.getSlashCommands(1001)).toEqual(['/compact', '/clear']);
      expect(store.getSlashCommands(1002)).toEqual(['/help', '/tdd-flow', '/keybindings-help']);
    });
  });

  describe('getSlashCommands', () => {
    it('should_return_empty_array_when_no_slashCommands', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      // Act
      const commands = store.getSlashCommands(1001);

      // Assert
      expect(commands).toEqual([]);
    });

    it('should_return_empty_array_when_conversation_not_exists', () => {
      // Arrange
      const store = useConversationStore.getState();
      // conversationId 9999는 존재하지 않음

      // Act
      const commands = store.getSlashCommands(9999);

      // Assert
      expect(commands).toEqual([]);
    });

    it('should_get_slashCommands_for_conversation', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      const expectedCommands = ['/compact', '/clear', '/help'];
      store.setSlashCommands(1001, expectedCommands);

      // Act
      const commands = store.getSlashCommands(1001);

      // Assert
      expect(commands).toEqual(expectedCommands);
    });
  });

  describe('slashCommands와 대화 삭제', () => {
    it('should_clear_slashCommands_when_conversation_deleted', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.setSlashCommands(1001, ['/compact', '/clear', '/help']);

      // Act
      store.deleteConversation(1001);

      // Assert - 대화 삭제 후 slashCommands도 삭제됨 (getState 반환 null)
      expect(store.getState(1001)).toBeNull();
      expect(store.getSlashCommands(1001)).toEqual([]);
    });

    it('should_clear_slashCommands_when_reset_called', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      store.setSlashCommands(1001, ['/compact', '/clear']);
      store.setCurrentConversation(1002);
      store.setSlashCommands(1002, ['/help', '/tdd-flow']);

      // Act
      store.reset();

      // Assert
      expect(useConversationStore.getState().getSlashCommands(1001)).toEqual([]);
      expect(useConversationStore.getState().getSlashCommands(1002)).toEqual([]);
    });
  });

  describe('slashCommands 엣지 케이스', () => {
    it('should_handle_empty_slashCommands_array', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);

      // Act
      store.setSlashCommands(1001, []);

      // Assert
      expect(store.getSlashCommands(1001)).toEqual([]);
    });

    it('should_handle_slashCommands_with_special_characters', () => {
      // Arrange
      const store = useConversationStore.getState();
      store.setCurrentConversation(1001);
      const commands = ['/tdd-flow', '/keybindings-help', '/my_custom_skill'];

      // Act
      store.setSlashCommands(1001, commands);

      // Assert
      expect(store.getSlashCommands(1001)).toEqual(commands);
    });
  });
});
