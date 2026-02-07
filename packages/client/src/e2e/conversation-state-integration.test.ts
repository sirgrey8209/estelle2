/**
 * @file conversation-state-integration.test.ts
 * @description 대화별 상태 통합 테스트
 *
 * conversationStore와 컴포넌트 통합을 검증합니다.
 * - 대화 전환 시 상태 격리
 * - 앱 재시작 시 상태 복원
 * - Stop 버튼 표시 로직
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageType, StoreMessage } from '@estelle/core';
import { useConversationStore } from '../stores/conversationStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { routeMessage } from '../hooks/useMessageRouter';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../services/relaySender', () => ({
  selectConversation: vi.fn(),
}));

vi.mock('../stores/relayStore', () => ({
  useRelayStore: {
    getState: () => ({
      setDesksLoaded: vi.fn(),
    }),
  },
}));

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      setUsageSummary: vi.fn(),
    }),
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function createMockWorkspace(id: string, convs: Array<{ id: string; name: string; status?: string }>) {
  return {
    workspaceId: id,
    name: `Workspace ${id}`,
    workingDir: `/work/${id}`,
    permissionMode: 'default' as const,
    isActive: true,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    conversations: convs.map((c) => ({
      conversationId: c.id,
      name: c.name,
      status: (c.status || 'idle') as 'idle' | 'working' | 'waiting' | 'error',
      unread: false,
      permissionMode: 'default' as const,
      createdAt: Date.now(),
      claudeSessionId: null,
    })),
  };
}

function setupWorkspaceWithConversations() {
  const pylonId = 1;
  useWorkspaceStore.getState().setWorkspaces(pylonId, [
    createMockWorkspace('ws-1', [
      { id: 'conv-1', name: 'Conversation 1' },
      { id: 'conv-2', name: 'Conversation 2' },
    ]),
  ]);
  return pylonId;
}

function selectConversation(convId: string) {
  const pylonId = 1;
  useWorkspaceStore.getState().selectConversation(pylonId, 'ws-1', convId);
  useConversationStore.getState().setCurrentConversation(convId);
}

// ============================================================================
// Tests
// ============================================================================

describe('대화별 상태 통합 테스트', () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
    useWorkspaceStore.getState().reset();
  });

  describe('대화 전환 시 상태 격리', () => {
    it('대화 전환 시 이전 대화의 status가 유지됨', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      // Act: conv-1에서 working 상태로 변경
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: { type: 'state', state: 'working' },
        },
      });

      // conv-2로 전환
      selectConversation('conv-2');

      // Assert: conv-1은 여전히 working
      const conv1State = useConversationStore.getState().getState('conv-1');
      expect(conv1State?.status).toBe('working');

      // conv-2는 idle
      const conv2State = useConversationStore.getState().getState('conv-2');
      expect(conv2State?.status).toBe('idle');
    });

    it('대화 전환 시 이전 대화의 messages가 유지됨', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      // Act: conv-1에 메시지 추가
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: { type: 'text', text: 'Hello from conv-1' },
        },
      });
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: { type: 'textComplete' },
        },
      });

      // conv-2로 전환 후 메시지 추가
      selectConversation('conv-2');
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: { type: 'text', text: 'Hello from conv-2' },
        },
      });
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: { type: 'textComplete' },
        },
      });

      // Assert: 각 대화에 올바른 메시지가 있음
      const conv1State = useConversationStore.getState().getState('conv-1');
      const conv2State = useConversationStore.getState().getState('conv-2');

      expect(conv1State?.messages).toHaveLength(1);
      expect((conv1State?.messages[0] as any).content).toBe('Hello from conv-1');

      expect(conv2State?.messages).toHaveLength(1);
      expect((conv2State?.messages[0] as any).content).toBe('Hello from conv-2');
    });

    it('대화 전환 시 pendingRequests가 격리됨', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      // Act: conv-1에서 권한 요청
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: {
            type: 'permission_request',
            toolUseId: 'tool-1',
            toolName: 'Bash',
            toolInput: { command: 'ls' },
          },
        },
      });

      // conv-2로 전환
      selectConversation('conv-2');

      // Assert: conv-1에는 pendingRequest가 있고, conv-2에는 없음
      expect(useConversationStore.getState().hasPendingRequests('conv-1')).toBe(true);
      expect(useConversationStore.getState().hasPendingRequests('conv-2')).toBe(false);
    });
  });

  describe('getCurrentState 동작', () => {
    it('getCurrentState는 현재 선택된 대화의 상태 반환', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      // Act
      useConversationStore.getState().setStatus('conv-1', 'working');

      // Assert
      const current = useConversationStore.getState().getCurrentState();
      expect(current?.status).toBe('working');
    });

    it('대화 전환 후 getCurrentState는 새 대화의 상태 반환', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');
      useConversationStore.getState().setStatus('conv-1', 'working');

      // Act
      selectConversation('conv-2');
      useConversationStore.getState().setStatus('conv-2', 'permission');

      // Assert
      const current = useConversationStore.getState().getCurrentState();
      expect(current?.status).toBe('permission');
    });
  });

  describe('HISTORY_RESULT 처리', () => {
    it('HISTORY_RESULT는 현재 대화에 메시지 설정', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      const historyMessages: StoreMessage[] = [
        {
          id: 'hist-1',
          role: 'user',
          type: 'text',
          content: 'History message 1',
          timestamp: Date.now() - 1000,
        },
        {
          id: 'hist-2',
          role: 'assistant',
          type: 'text',
          content: 'History message 2',
          timestamp: Date.now(),
        },
      ];

      // Act
      routeMessage({
        type: MessageType.HISTORY_RESULT,
        payload: { messages: historyMessages },
      });

      // Assert
      const state = useConversationStore.getState().getState('conv-1');
      expect(state?.messages).toHaveLength(2);
      expect((state?.messages[0] as any).content).toBe('History message 1');
    });

    it('HISTORY_RESULT는 다른 대화에 영향 없음', () => {
      // Arrange
      setupWorkspaceWithConversations();

      // conv-1에 메시지 추가
      selectConversation('conv-1');
      useConversationStore.getState().addMessage('conv-1', {
        id: 'msg-1',
        role: 'user',
        type: 'text',
        content: 'Original message',
        timestamp: Date.now(),
      });

      // conv-2 선택 후 히스토리 로드
      selectConversation('conv-2');
      routeMessage({
        type: MessageType.HISTORY_RESULT,
        payload: {
          messages: [{
            id: 'hist-1',
            role: 'user',
            type: 'text',
            content: 'Conv-2 history',
            timestamp: Date.now(),
          }],
        },
      });

      // Assert: conv-1의 메시지는 그대로
      const conv1State = useConversationStore.getState().getState('conv-1');
      expect(conv1State?.messages).toHaveLength(1);
      expect((conv1State?.messages[0] as any).content).toBe('Original message');

      // conv-2에는 히스토리 메시지
      const conv2State = useConversationStore.getState().getState('conv-2');
      expect(conv2State?.messages).toHaveLength(1);
      expect((conv2State?.messages[0] as any).content).toBe('Conv-2 history');
    });
  });

  describe('Stop 버튼 표시 로직', () => {
    it('현재 대화가 working이면 isWorking = true', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      // Act
      useConversationStore.getState().setStatus('conv-1', 'working');

      // Assert: InputBar가 사용할 로직
      const currentState = useConversationStore.getState().getCurrentState();
      const isWorking = currentState?.status === 'working';
      expect(isWorking).toBe(true);
    });

    it('다른 대화가 working이어도 현재 대화가 idle이면 isWorking = false', () => {
      // Arrange
      setupWorkspaceWithConversations();

      // conv-1을 working으로 설정
      selectConversation('conv-1');
      useConversationStore.getState().setStatus('conv-1', 'working');

      // Act: conv-2로 전환 (idle 상태)
      selectConversation('conv-2');

      // Assert
      const currentState = useConversationStore.getState().getCurrentState();
      const isWorking = currentState?.status === 'working';
      expect(isWorking).toBe(false);
    });
  });

  describe('앱 재시작 시나리오', () => {
    it('워크스페이스 로드 후 대화 상태 초기화', () => {
      // Arrange: 워크스페이스 로드
      const pylonId = 1;
      routeMessage({
        type: MessageType.WORKSPACE_LIST_RESULT,
        payload: {
          deviceId: pylonId,
          deviceName: 'Test Pylon',
          workspaces: [
            createMockWorkspace('ws-1', [
              { id: 'conv-1', name: 'Conv 1', status: 'working' },
            ]),
          ],
          activeWorkspaceId: 'ws-1',
          activeConversationId: 'conv-1',
        },
      });

      // Act: 대화 선택
      useConversationStore.getState().setCurrentConversation('conv-1');

      // Assert: 초기 상태는 idle (히스토리 로드 전)
      const state = useConversationStore.getState().getState('conv-1');
      expect(state?.status).toBe('idle');
      expect(state?.messages).toEqual([]);
    });

    it('CLAUDE_EVENT state로 실제 상태 동기화', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      // Act: Pylon에서 현재 상태 전송
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: { type: 'state', state: 'working' },
        },
      });

      // Assert
      const state = useConversationStore.getState().getState('conv-1');
      expect(state?.status).toBe('working');
    });
  });

  describe('textBuffer 스트리밍', () => {
    it('text 이벤트가 현재 대화의 textBuffer에 추가됨', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      // Act
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: { event: { type: 'text', text: 'Hello ' } },
      });
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: { event: { type: 'text', text: 'World' } },
      });

      // Assert
      const state = useConversationStore.getState().getState('conv-1');
      expect(state?.textBuffer).toBe('Hello World');
    });

    it('textComplete 이벤트가 textBuffer를 메시지로 변환', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: { event: { type: 'text', text: 'Complete message' } },
      });

      // Act
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: { event: { type: 'textComplete' } },
      });

      // Assert
      const state = useConversationStore.getState().getState('conv-1');
      expect(state?.textBuffer).toBe('');
      expect(state?.messages).toHaveLength(1);
      expect((state?.messages[0] as any).content).toBe('Complete message');
    });
  });

  describe('tool 이벤트 처리', () => {
    it('toolInfo 이벤트가 tool_start 메시지 추가', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      // Act
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: {
            type: 'toolInfo',
            toolUseId: 'tool-1',
            toolName: 'Bash',
            toolInput: { command: 'ls -la' },
          },
        },
      });

      // Assert
      const state = useConversationStore.getState().getState('conv-1');
      expect(state?.messages).toHaveLength(1);
      expect(state?.messages[0].type).toBe('tool_start');
      expect((state?.messages[0] as any).toolName).toBe('Bash');
    });

    it('toolComplete 이벤트가 tool_start를 tool_complete로 교체', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');

      // tool_start 추가
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: {
            type: 'toolInfo',
            toolUseId: 'tool-1',
            toolName: 'Bash',
            toolInput: { command: 'ls' },
          },
        },
      });

      // Act: tool_complete
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: {
            type: 'toolComplete',
            toolUseId: 'tool-1',
            toolName: 'Bash',
            success: true,
            toolOutput: 'file1.txt\nfile2.txt',
          },
        },
      });

      // Assert
      const state = useConversationStore.getState().getState('conv-1');
      expect(state?.messages).toHaveLength(1);
      expect(state?.messages[0].type).toBe('tool_complete');
      expect((state?.messages[0] as any).success).toBe(true);
    });
  });

  describe('result 이벤트 처리', () => {
    it('result 이벤트가 상태를 idle로 변경하고 result 메시지 추가', () => {
      // Arrange
      setupWorkspaceWithConversations();
      selectConversation('conv-1');
      useConversationStore.getState().setStatus('conv-1', 'working');

      // Act
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          event: {
            type: 'result',
            duration_ms: 1500,
            usage: {
              inputTokens: 100,
              outputTokens: 50,
              cacheReadInputTokens: 10,
            },
          },
        },
      });

      // Assert
      const state = useConversationStore.getState().getState('conv-1');
      expect(state?.status).toBe('idle');
      expect(state?.messages).toHaveLength(1);
      expect(state?.messages[0].type).toBe('result');
    });
  });
});
