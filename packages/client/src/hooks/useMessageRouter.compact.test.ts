/**
 * @file useMessageRouter.compact.test.ts
 * @description Compact 이벤트 라우팅 테스트
 *
 * Pylon에서 전송되는 compactStart, compactComplete 이벤트를
 * 클라이언트에서 tool_start, tool_complete 메시지로 변환하는 기능을 테스트합니다.
 *
 * TDD: 2-TEST 단계 - 구현 전 테스트 작성
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageType } from '@estelle/core';
import type { RelayMessage } from '../services/relayService';
import type { StoreMessage } from '@estelle/core';

// Conversation ID 상수
const CONVERSATION_ID = 1001;

// Store mock
const mockWorkspaceStore = {
  connectedPylons: [] as Array<{ deviceId: number; deviceName: string }>,
  workspacesByPylon: new Map<number, unknown[]>(),
  selectedConversation: null as { conversationId: number } | null,
  setWorkspaces: vi.fn(),
  updateConversationStatus: vi.fn(),
  addConnectedPylon: vi.fn(),
};

// conversationStore mock - 메시지 저장 추적용
const addedMessages: StoreMessage[] = [];
const mockConversationStore = {
  states: new Map<number, { messages: StoreMessage[] }>(),
  currentConversationId: null as number | null,
  setMessages: vi.fn((convId: number, messages: StoreMessage[]) => {
    mockConversationStore.states.set(convId, { messages: [...messages] });
  }),
  setStatus: vi.fn(),
  appendTextBuffer: vi.fn(),
  flushTextBuffer: vi.fn(),
  clearTextBuffer: vi.fn(),
  clearMessages: vi.fn(),
  addMessage: vi.fn((convId: number, message: StoreMessage) => {
    addedMessages.push(message);
  }),
  addPendingRequest: vi.fn(),
  updateRealtimeUsage: vi.fn(),
  prependMessages: vi.fn(),
  setCurrentConversation: vi.fn(),
  getState: vi.fn((convId: number) => {
    return mockConversationStore.states.get(convId) || { messages: [] };
  }),
  deleteConversation: vi.fn(),
};

// vi.mock은 호이스팅되므로 순서 주의
vi.mock('../stores/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: () => mockWorkspaceStore,
  },
}));

vi.mock('../stores/conversationStore', () => ({
  useConversationStore: {
    getState: () => mockConversationStore,
  },
}));

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      setUsageSummary: vi.fn(),
      setAccountStatus: vi.fn(),
    }),
  },
}));

// syncStore mock
const mockSyncStore = {
  setConversationSync: vi.fn(),
  extendSyncedFrom: vi.fn(),
  extendSyncedTo: vi.fn(),
  setConversationPhase: vi.fn(),
  setLoadingMore: vi.fn(),
  getConversationSync: vi.fn(() => null as any),
  workspaceSync: null,
};

vi.mock('../stores/syncStore', () => ({
  useSyncStore: {
    getState: () => mockSyncStore,
  },
}));

// syncOrchestrator mock
const mockSyncOrchestrator = {
  onWorkspaceListReceived: vi.fn(),
};

vi.mock('../services/syncOrchestrator', () => ({
  syncOrchestrator: mockSyncOrchestrator,
}));

// InputBar mock
vi.mock('../components/chat/InputBar', () => ({
  clearDraftText: vi.fn(),
}));

// debugStore mock
vi.mock('../stores/debugStore', () => ({
  debugLog: vi.fn(),
}));

// 모킹 후에 import
const { routeMessage } = await import('./useMessageRouter');

describe('routeMessage - Compact Events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addedMessages.length = 0;
    mockWorkspaceStore.connectedPylons = [];
    mockWorkspaceStore.selectedConversation = null;
    mockConversationStore.currentConversationId = null;
    mockConversationStore.states.clear();
    mockSyncStore.getConversationSync.mockReturnValue(null);
  });

  // ============================================================================
  // compactStart 이벤트 라우팅 테스트
  // ============================================================================
  describe('compactStart event routing', () => {
    it('should_add_tool_start_message_when_compactStart_received', () => {
      // Arrange
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: {
            type: 'compactStart',
          },
        },
      };

      // Act
      routeMessage(message);

      // Assert: tool_start 메시지가 추가되어야 함
      expect(mockConversationStore.addMessage).toHaveBeenCalled();
      const addedMessage = addedMessages.find((m) => m.type === 'tool_start');
      expect(addedMessage).toBeDefined();
      expect(addedMessage?.toolName).toBe('Compact');
    });

    it('should_set_role_as_assistant_for_compactStart_tool_message', () => {
      // Arrange
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: {
            type: 'compactStart',
          },
        },
      };

      // Act
      routeMessage(message);

      // Assert: role이 assistant이어야 함 (기존 tool 메시지와 동일)
      const addedMessage = addedMessages.find((m) => m.type === 'tool_start');
      expect(addedMessage?.role).toBe('assistant');
    });

    it('should_generate_unique_id_for_compactStart_message', () => {
      // Arrange
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };

      // Act: 두 번 호출
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: { type: 'compactStart' },
        },
      });
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: { type: 'compactStart' },
        },
      });

      // Assert: ID가 다르게 생성되어야 함
      const toolStartMessages = addedMessages.filter((m) => m.type === 'tool_start');
      expect(toolStartMessages).toHaveLength(2);
      expect(toolStartMessages[0].id).not.toBe(toolStartMessages[1].id);
    });
  });

  // ============================================================================
  // compactComplete 이벤트 라우팅 테스트
  // ============================================================================
  describe('compactComplete event routing', () => {
    it('should_replace_tool_start_with_tool_complete_when_compactComplete_received', () => {
      // Arrange: tool_start 메시지가 이미 있는 상태
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };
      const toolStartId = 'compact-tool-123';
      mockConversationStore.states.set(CONVERSATION_ID, {
        messages: [
          {
            id: toolStartId,
            role: 'assistant',
            type: 'tool_start',
            timestamp: Date.now(),
            toolName: 'Compact',
            toolInput: {},
          } as StoreMessage,
        ],
      });

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: {
            type: 'compactComplete',
            preTokens: 168833,
            trigger: 'auto',
          },
        },
      };

      // Act
      routeMessage(message);

      // Assert: setMessages가 호출되어 tool_start가 tool_complete로 교체
      expect(mockConversationStore.setMessages).toHaveBeenCalled();
    });

    it('should_include_preTokens_in_tool_complete_output', () => {
      // Arrange
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };
      const toolStartId = 'compact-tool-123';
      mockConversationStore.states.set(CONVERSATION_ID, {
        messages: [
          {
            id: toolStartId,
            role: 'assistant',
            type: 'tool_start',
            timestamp: Date.now(),
            toolName: 'Compact',
            toolInput: {},
          } as StoreMessage,
        ],
      });

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: {
            type: 'compactComplete',
            preTokens: 200000,
            trigger: 'auto',
          },
        },
      };

      // Act
      routeMessage(message);

      // Assert: output에 토큰 정보가 포함되어야 함
      const setMessagesCall = mockConversationStore.setMessages.mock.calls[0];
      if (setMessagesCall) {
        const messages = setMessagesCall[1] as StoreMessage[];
        const toolCompleteMsg = messages.find((m) => m.type === 'tool_complete');
        expect(toolCompleteMsg?.output).toContain('200000');
        // 또는 output이 토큰 수를 포맷팅한 형태
        expect(toolCompleteMsg?.output).toContain('200,000');
      }
    });

    it('should_set_success_true_for_compactComplete', () => {
      // Arrange
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };
      mockConversationStore.states.set(CONVERSATION_ID, {
        messages: [
          {
            id: 'compact-tool-123',
            role: 'assistant',
            type: 'tool_start',
            timestamp: Date.now(),
            toolName: 'Compact',
            toolInput: {},
          } as StoreMessage,
        ],
      });

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: {
            type: 'compactComplete',
            preTokens: 168833,
          },
        },
      };

      // Act
      routeMessage(message);

      // Assert: success가 true여야 함
      const setMessagesCall = mockConversationStore.setMessages.mock.calls[0];
      if (setMessagesCall) {
        const messages = setMessagesCall[1] as StoreMessage[];
        const toolCompleteMsg = messages.find((m) => m.type === 'tool_complete');
        expect(toolCompleteMsg?.success).toBe(true);
      }
    });

    it('should_add_new_tool_complete_if_no_matching_tool_start', () => {
      // Arrange: tool_start가 없는 상태
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };
      mockConversationStore.states.set(CONVERSATION_ID, {
        messages: [],
      });

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: {
            type: 'compactComplete',
            preTokens: 168833,
          },
        },
      };

      // Act
      routeMessage(message);

      // Assert: addMessage로 tool_complete가 추가되어야 함
      expect(mockConversationStore.addMessage).toHaveBeenCalled();
      const addedMessage = addedMessages.find((m) => m.type === 'tool_complete');
      expect(addedMessage).toBeDefined();
      expect(addedMessage?.toolName).toBe('Compact');
    });
  });

  // ============================================================================
  // compactStart + compactComplete 시퀀스 테스트
  // ============================================================================
  describe('compact event sequence', () => {
    it('should_handle_compactStart_then_compactComplete_sequence', () => {
      // Arrange
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };
      mockConversationStore.states.set(CONVERSATION_ID, { messages: [] });

      // Act: compactStart -> compactComplete 순서
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: { type: 'compactStart' },
        },
      });

      // compactStart로 추가된 메시지를 states에 반영
      const startMessage = addedMessages[0];
      if (startMessage) {
        mockConversationStore.states.set(CONVERSATION_ID, {
          messages: [startMessage],
        });
      }

      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: {
            type: 'compactComplete',
            preTokens: 168833,
          },
        },
      });

      // Assert: tool_start가 tool_complete로 교체되어야 함
      expect(mockConversationStore.setMessages).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================
  describe('edge cases', () => {
    it('should_ignore_compactStart_when_no_conversation_selected', () => {
      // Arrange: 선택된 대화가 없음
      mockWorkspaceStore.selectedConversation = null;

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: undefined,
          event: { type: 'compactStart' },
        },
      };

      // Act
      routeMessage(message);

      // Assert: addMessage가 호출되지 않아야 함
      expect(mockConversationStore.addMessage).not.toHaveBeenCalled();
    });

    it('should_handle_compactComplete_without_preTokens', () => {
      // Arrange
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };
      mockConversationStore.states.set(CONVERSATION_ID, {
        messages: [
          {
            id: 'compact-tool-123',
            role: 'assistant',
            type: 'tool_start',
            timestamp: Date.now(),
            toolName: 'Compact',
            toolInput: {},
          } as StoreMessage,
        ],
      });

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: {
            type: 'compactComplete',
            // preTokens 없음
          },
        },
      };

      // Act
      routeMessage(message);

      // Assert: 에러 없이 처리되어야 함
      expect(mockConversationStore.setMessages).toHaveBeenCalled();
    });

    it('should_format_preTokens_with_comma_separator', () => {
      // Arrange
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };
      mockConversationStore.states.set(CONVERSATION_ID, {
        messages: [
          {
            id: 'compact-tool-123',
            role: 'assistant',
            type: 'tool_start',
            timestamp: Date.now(),
            toolName: 'Compact',
            toolInput: {},
          } as StoreMessage,
        ],
      });

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: {
            type: 'compactComplete',
            preTokens: 1234567,
          },
        },
      };

      // Act
      routeMessage(message);

      // Assert: 숫자가 포맷팅되어야 함 (예: 1,234,567)
      const setMessagesCall = mockConversationStore.setMessages.mock.calls[0];
      if (setMessagesCall) {
        const messages = setMessagesCall[1] as StoreMessage[];
        const toolCompleteMsg = messages.find((m) => m.type === 'tool_complete');
        expect(toolCompleteMsg?.output).toContain('1,234,567');
      }
    });
  });

  // ============================================================================
  // toolInput 확인 테스트
  // ============================================================================
  describe('toolInput for compact events', () => {
    it('should_set_empty_toolInput_for_compactStart', () => {
      // Arrange
      mockWorkspaceStore.selectedConversation = { conversationId: CONVERSATION_ID };

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: CONVERSATION_ID,
          event: { type: 'compactStart' },
        },
      };

      // Act
      routeMessage(message);

      // Assert: toolInput이 빈 객체여야 함
      const addedMessage = addedMessages.find((m) => m.type === 'tool_start');
      expect(addedMessage?.toolInput).toEqual({});
    });
  });
});
