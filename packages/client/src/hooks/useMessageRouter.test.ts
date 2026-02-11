/**
 * @file useMessageRouter.test.ts
 * @description 메시지 라우터 훅 테스트
 *
 * Relay에서 수신한 메시지를 적절한 Store에 디스패치합니다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageType } from '@estelle/core';
import type { RelayMessage } from '../services/relayService';

// Entity ID 상수
const ENTITY_ID = 1001;

// Store mock - 모킹을 먼저 선언
const mockWorkspaceStore = {
  connectedPylons: [] as Array<{ deviceId: number; deviceName: string }>,
  workspacesByPylon: new Map<number, unknown[]>(),
  selectedConversation: null as { entityId: number; conversationId: string } | null,
  setWorkspaces: vi.fn(),
  updateConversationStatus: vi.fn(),
  addConnectedPylon: vi.fn(),
};

// conversationStore mock
const mockConversationStore = {
  states: new Map<number, unknown>(),
  currentEntityId: null as number | null,
  setMessages: vi.fn(),
  setStatus: vi.fn(),
  appendTextBuffer: vi.fn(),
  flushTextBuffer: vi.fn(),
  clearTextBuffer: vi.fn(),
  addMessage: vi.fn(),
  addPendingRequest: vi.fn(),
  updateRealtimeUsage: vi.fn(),
  prependMessages: vi.fn(),
  setCurrentConversation: vi.fn(),
  getState: vi.fn(() => ({ messages: [] })),
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

// 모킹 후에 import
const { routeMessage } = await import('./useMessageRouter');

describe('routeMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceStore.connectedPylons = [];
    mockWorkspaceStore.selectedConversation = null;
    mockConversationStore.currentEntityId = null;
    mockSyncStore.getConversationSync.mockReturnValue(null);
  });

  describe('workspace messages', () => {
    it('should route workspace_list_result to workspaceStore.setWorkspaces', () => {
      const message: RelayMessage = {
        type: MessageType.WORKSPACE_LIST_RESULT,
        payload: {
          deviceId: 1,
          deviceName: 'Test Device',
          workspaces: [
            {
              workspaceId: 'ws-1',
              name: 'Workspace 1',
              workingDir: '/test',
              isActive: true,
              conversations: [{ entityId: ENTITY_ID, conversationId: 'conv-1', status: 'idle' }],
            },
          ],
        },
      };

      routeMessage(message);

      // Pylon 정보 저장 확인
      expect(mockWorkspaceStore.addConnectedPylon).toHaveBeenCalledWith({
        deviceId: 1,
        deviceName: 'Test Device',
      });

      // setWorkspaces 호출 확인 (3번째 인자는 activeInfo, 없으면 undefined)
      expect(mockWorkspaceStore.setWorkspaces).toHaveBeenCalledWith(1, message.payload.workspaces, undefined);

      // syncOrchestrator 알림 확인
      expect(mockSyncOrchestrator.onWorkspaceListReceived).toHaveBeenCalledWith(null);
    });

    it('should handle string deviceId', () => {
      const message: RelayMessage = {
        type: MessageType.WORKSPACE_LIST_RESULT,
        payload: {
          deviceId: '1',
          deviceName: 'Test Device',
          workspaces: [],
        },
      };

      routeMessage(message);

      expect(mockWorkspaceStore.addConnectedPylon).toHaveBeenCalledWith({
        deviceId: 1,
        deviceName: 'Test Device',
      });
    });

    it('should pass selectedEntityId to syncOrchestrator when conversation is selected', () => {
      mockWorkspaceStore.selectedConversation = { entityId: ENTITY_ID, conversationId: 'conv-1' };

      const message: RelayMessage = {
        type: MessageType.WORKSPACE_LIST_RESULT,
        payload: {
          deviceId: 1,
          deviceName: 'Test Device',
          workspaces: [],
        },
      };

      routeMessage(message);

      expect(mockSyncOrchestrator.onWorkspaceListReceived).toHaveBeenCalledWith(ENTITY_ID);
    });
  });

  describe('conversation messages', () => {
    it('should route conversation_status to workspaceStore.updateConversationStatus', () => {
      mockWorkspaceStore.connectedPylons = [{ deviceId: 1, deviceName: 'Test' }];

      const message: RelayMessage = {
        type: MessageType.CONVERSATION_STATUS,
        payload: {
          entityId: ENTITY_ID,
          status: 'working',
        },
      };

      routeMessage(message);

      expect(mockWorkspaceStore.updateConversationStatus).toHaveBeenCalledWith(
        1,
        ENTITY_ID,
        'working',
        undefined
      );
    });

    it('should route history_result to conversationStore.setMessages', () => {
      mockWorkspaceStore.selectedConversation = { entityId: ENTITY_ID, conversationId: 'conv-1' };

      const message: RelayMessage = {
        type: MessageType.HISTORY_RESULT,
        payload: {
          entityId: ENTITY_ID,
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
          totalCount: 2,
        },
      };

      routeMessage(message);

      // setMessages는 이제 paging 정보 없이 호출됨 (syncStore에서 관리)
      expect(mockConversationStore.setMessages).toHaveBeenCalledWith(ENTITY_ID, message.payload.messages);
    });
  });

  describe('claude messages', () => {
    it('should route claude_event text to conversationStore', () => {
      mockWorkspaceStore.selectedConversation = { entityId: ENTITY_ID, conversationId: 'conv-1' };

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          entityId: ENTITY_ID,
          event: {
            type: 'text',
            text: 'Hello from Claude',
          },
        },
      };

      routeMessage(message);

      expect(mockConversationStore.appendTextBuffer).toHaveBeenCalledWith(ENTITY_ID, 'Hello from Claude');
    });

    it('should route claude_event state to conversationStore.setStatus', () => {
      mockWorkspaceStore.selectedConversation = { entityId: ENTITY_ID, conversationId: 'conv-1' };

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          entityId: ENTITY_ID,
          event: {
            type: 'state',
            state: 'working',
          },
        },
      };

      routeMessage(message);

      expect(mockConversationStore.setStatus).toHaveBeenCalledWith(ENTITY_ID, 'working');
    });

    it('should route claude_event textComplete to conversationStore.flushTextBuffer', () => {
      mockWorkspaceStore.selectedConversation = { entityId: ENTITY_ID, conversationId: 'conv-1' };

      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          entityId: ENTITY_ID,
          event: {
            type: 'textComplete',
          },
        },
      };

      routeMessage(message);

      expect(mockConversationStore.flushTextBuffer).toHaveBeenCalledWith(ENTITY_ID);
    });
  });

  describe('syncStore update', () => {
    it('should set syncStore range on initial HISTORY_RESULT', () => {
      mockWorkspaceStore.selectedConversation = { entityId: ENTITY_ID, conversationId: 'conv-1' };

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      routeMessage({
        type: MessageType.HISTORY_RESULT,
        payload: {
          entityId: ENTITY_ID,
          messages,
          totalCount: 10,
        },
      });

      // totalCount=10, loadedCount=2 → syncedFrom=8, syncedTo=10
      expect(mockSyncStore.setConversationSync).toHaveBeenCalledWith(ENTITY_ID, 8, 10, 10);
      expect(mockSyncStore.setConversationPhase).toHaveBeenCalledWith(ENTITY_ID, 'synced');
    });

    it('should extend syncedFrom on paging HISTORY_RESULT', () => {
      mockWorkspaceStore.selectedConversation = { entityId: ENTITY_ID, conversationId: 'conv-1' };

      const messages = [
        { role: 'user', content: 'Older message 1' },
        { role: 'user', content: 'Older message 2' },
      ];

      routeMessage({
        type: MessageType.HISTORY_RESULT,
        payload: {
          entityId: ENTITY_ID,
          messages,
          loadBefore: 20,  // 인덱스 20 이전 메시지 로드
          totalCount: 50,
        },
      });

      // loadBefore=20, loadedCount=2 → newSyncedFrom = 20 - 2 = 18
      expect(mockSyncStore.extendSyncedFrom).toHaveBeenCalledWith(ENTITY_ID, 18);
      // 페이징에서는 setConversationPhase 호출 안 함
      expect(mockSyncStore.setConversationPhase).not.toHaveBeenCalled();
    });
  });

  describe('unknown messages', () => {
    it('should not throw on unknown message type', () => {
      const message: RelayMessage = {
        type: 'unknown_type',
        payload: {},
      };

      expect(() => routeMessage(message)).not.toThrow();
    });
  });

  // ==========================================================================
  // conversation-cache-cleanup: 대화 캐시 정리 테스트
  // ==========================================================================

  describe('conversation cache cleanup', () => {
    describe('CONVERSATION_CREATE_RESULT', () => {
      it('should_call_deleteConversation_when_conversation_create_result_received', () => {
        // Arrange: entityId 1001로 기존 대화 상태가 캐시되어 있음
        mockConversationStore.states.set(ENTITY_ID, { messages: [{ content: 'old' }] });

        // Act: 같은 entityId로 새 대화 생성 결과 수신
        routeMessage({
          type: MessageType.CONVERSATION_CREATE_RESULT,
          payload: {
            entityId: ENTITY_ID,
            conversationId: 'new-conv-123',
            workspaceId: 'ws-1',
          },
        });

        // Assert: deleteConversation이 호출되어 이전 캐시 제거
        expect(mockConversationStore.deleteConversation).toHaveBeenCalledWith(ENTITY_ID);
      });

      it('should_handle_conversation_create_result_without_entityId', () => {
        // Arrange: entityId 없는 경우

        // Act: entityId 없이 CONVERSATION_CREATE_RESULT 수신
        routeMessage({
          type: MessageType.CONVERSATION_CREATE_RESULT,
          payload: {
            conversationId: 'new-conv-123',
            workspaceId: 'ws-1',
          },
        });

        // Assert: deleteConversation 호출되지 않음
        expect(mockConversationStore.deleteConversation).not.toHaveBeenCalled();
      });

      it('should_call_deleteConversation_even_when_no_cached_state_exists', () => {
        // Arrange: 캐시에 해당 entityId 없음
        mockConversationStore.states.clear();

        // Act: 새 대화 생성 결과 수신
        routeMessage({
          type: MessageType.CONVERSATION_CREATE_RESULT,
          payload: {
            entityId: ENTITY_ID,
            conversationId: 'new-conv-123',
          },
        });

        // Assert: 캐시가 없어도 deleteConversation 호출 (방어적 처리)
        expect(mockConversationStore.deleteConversation).toHaveBeenCalledWith(ENTITY_ID);
      });
    });

    describe('WORKSPACE_LIST_RESULT with deleted conversations', () => {
      it('should_call_deleteConversation_for_removed_conversations', () => {
        // Arrange: 기존에 entityId 1001, 1002가 있었는데 새 목록에는 1002만 있음
        mockWorkspaceStore.workspacesByPylon.set(1, [
          {
            workspaceId: 'ws-1',
            conversations: [
              { entityId: ENTITY_ID, conversationId: 'conv-1' },
              { entityId: 1002, conversationId: 'conv-2' },
            ],
          },
        ]);
        mockConversationStore.states.set(ENTITY_ID, { messages: [] });
        mockConversationStore.states.set(1002, { messages: [] });

        // Act: 새 워크스페이스 목록 수신 (1001 삭제됨)
        routeMessage({
          type: MessageType.WORKSPACE_LIST_RESULT,
          payload: {
            deviceId: 1,
            deviceName: 'Test Device',
            workspaces: [
              {
                workspaceId: 'ws-1',
                conversations: [
                  { entityId: 1002, conversationId: 'conv-2' },
                ],
              },
            ],
          },
        });

        // Assert: 삭제된 대화의 캐시 정리
        expect(mockConversationStore.deleteConversation).toHaveBeenCalledWith(ENTITY_ID);
        expect(mockConversationStore.deleteConversation).not.toHaveBeenCalledWith(1002);
      });

      it('should_call_deleteConversation_for_multiple_removed_conversations', () => {
        // Arrange: entityId 1001, 1002, 1003이 있었는데 새 목록에는 1002만 있음
        mockWorkspaceStore.workspacesByPylon.set(1, [
          {
            workspaceId: 'ws-1',
            conversations: [
              { entityId: ENTITY_ID, conversationId: 'conv-1' },
              { entityId: 1002, conversationId: 'conv-2' },
              { entityId: 1003, conversationId: 'conv-3' },
            ],
          },
        ]);

        // Act: 새 워크스페이스 목록 수신 (1001, 1003 삭제됨)
        routeMessage({
          type: MessageType.WORKSPACE_LIST_RESULT,
          payload: {
            deviceId: 1,
            deviceName: 'Test Device',
            workspaces: [
              {
                workspaceId: 'ws-1',
                conversations: [
                  { entityId: 1002, conversationId: 'conv-2' },
                ],
              },
            ],
          },
        });

        // Assert: 삭제된 대화들의 캐시 정리
        expect(mockConversationStore.deleteConversation).toHaveBeenCalledWith(ENTITY_ID);
        expect(mockConversationStore.deleteConversation).toHaveBeenCalledWith(1003);
        expect(mockConversationStore.deleteConversation).not.toHaveBeenCalledWith(1002);
      });

      it('should_not_call_deleteConversation_when_no_conversations_removed', () => {
        // Arrange: 기존 목록과 동일
        mockWorkspaceStore.workspacesByPylon.set(1, [
          {
            workspaceId: 'ws-1',
            conversations: [
              { entityId: ENTITY_ID, conversationId: 'conv-1' },
            ],
          },
        ]);

        // Act: 동일한 목록 수신
        routeMessage({
          type: MessageType.WORKSPACE_LIST_RESULT,
          payload: {
            deviceId: 1,
            deviceName: 'Test Device',
            workspaces: [
              {
                workspaceId: 'ws-1',
                conversations: [
                  { entityId: ENTITY_ID, conversationId: 'conv-1' },
                ],
              },
            ],
          },
        });

        // Assert: deleteConversation 호출되지 않음
        expect(mockConversationStore.deleteConversation).not.toHaveBeenCalled();
      });

      it('should_handle_first_workspace_list_without_previous_data', () => {
        // Arrange: 이전 데이터 없음 (첫 연결)
        mockWorkspaceStore.workspacesByPylon.clear();

        // Act: 첫 워크스페이스 목록 수신
        routeMessage({
          type: MessageType.WORKSPACE_LIST_RESULT,
          payload: {
            deviceId: 1,
            deviceName: 'Test Device',
            workspaces: [
              {
                workspaceId: 'ws-1',
                conversations: [
                  { entityId: ENTITY_ID, conversationId: 'conv-1' },
                ],
              },
            ],
          },
        });

        // Assert: deleteConversation 호출되지 않음 (비교 대상 없음)
        expect(mockConversationStore.deleteConversation).not.toHaveBeenCalled();
      });

      it('should_handle_workspace_deletion_with_all_conversations', () => {
        // Arrange: 워크스페이스 자체가 삭제된 경우
        mockWorkspaceStore.workspacesByPylon.set(1, [
          {
            workspaceId: 'ws-1',
            conversations: [
              { entityId: ENTITY_ID, conversationId: 'conv-1' },
            ],
          },
          {
            workspaceId: 'ws-2',
            conversations: [
              { entityId: 1002, conversationId: 'conv-2' },
            ],
          },
        ]);

        // Act: ws-1 워크스페이스 자체가 삭제됨
        routeMessage({
          type: MessageType.WORKSPACE_LIST_RESULT,
          payload: {
            deviceId: 1,
            deviceName: 'Test Device',
            workspaces: [
              {
                workspaceId: 'ws-2',
                conversations: [
                  { entityId: 1002, conversationId: 'conv-2' },
                ],
              },
            ],
          },
        });

        // Assert: 삭제된 워크스페이스의 대화 캐시 정리
        expect(mockConversationStore.deleteConversation).toHaveBeenCalledWith(ENTITY_ID);
        expect(mockConversationStore.deleteConversation).not.toHaveBeenCalledWith(1002);
      });
    });
  });

  // ==========================================================================
  // reconnect-state-sync: 재연결 시 상태 동기화 테스트
  // ==========================================================================

  describe('reconnect state sync', () => {
    describe('CONVERSATION_STATUS without convState', () => {
      it('should set status even when convState does not exist', () => {
        // Arrange: convState가 존재하지 않는 상태
        mockWorkspaceStore.connectedPylons = [{ deviceId: 1, deviceName: 'Test' }];
        mockConversationStore.getState.mockReturnValue(null as any); // convState 없음

        // Act: CONVERSATION_STATUS 수신
        routeMessage({
          type: MessageType.CONVERSATION_STATUS,
          payload: {
            entityId: ENTITY_ID,
            status: 'idle',
          },
        });

        // Assert: convState가 없어도 setStatus가 호출되어야 함
        expect(mockConversationStore.setStatus).toHaveBeenCalledWith(ENTITY_ID, 'idle');
      });

      it('should initialize convState and set status when receiving working status', () => {
        // Arrange
        mockWorkspaceStore.connectedPylons = [{ deviceId: 1, deviceName: 'Test' }];
        mockConversationStore.getState.mockReturnValue(null as any);

        // Act
        routeMessage({
          type: MessageType.CONVERSATION_STATUS,
          payload: {
            entityId: ENTITY_ID,
            status: 'working',
          },
        });

        // Assert: 상태가 설정되어야 함
        expect(mockConversationStore.setStatus).toHaveBeenCalledWith(ENTITY_ID, 'working');
      });
    });

    describe('HISTORY_RESULT with currentStatus', () => {
      it('should set status from currentStatus in history_result', () => {
        // Arrange
        mockWorkspaceStore.selectedConversation = { entityId: ENTITY_ID, conversationId: 'conv-1' };

        // Act: currentStatus가 포함된 HISTORY_RESULT 수신
        routeMessage({
          type: MessageType.HISTORY_RESULT,
          payload: {
            entityId: ENTITY_ID,
            messages: [],
            totalCount: 0,
            currentStatus: 'working',
          },
        });

        // Assert: currentStatus로 상태가 설정되어야 함
        expect(mockConversationStore.setStatus).toHaveBeenCalledWith(ENTITY_ID, 'working');
      });

      it('should set idle status when currentStatus is idle', () => {
        // Arrange
        mockWorkspaceStore.selectedConversation = { entityId: ENTITY_ID, conversationId: 'conv-1' };

        // Act
        routeMessage({
          type: MessageType.HISTORY_RESULT,
          payload: {
            entityId: ENTITY_ID,
            messages: [],
            totalCount: 0,
            currentStatus: 'idle',
          },
        });

        // Assert
        expect(mockConversationStore.setStatus).toHaveBeenCalledWith(ENTITY_ID, 'idle');
      });

      it('should set permission status when currentStatus is permission', () => {
        // Arrange
        mockWorkspaceStore.selectedConversation = { entityId: ENTITY_ID, conversationId: 'conv-1' };

        // Act
        routeMessage({
          type: MessageType.HISTORY_RESULT,
          payload: {
            entityId: ENTITY_ID,
            messages: [],
            totalCount: 0,
            currentStatus: 'permission',
          },
        });

        // Assert
        expect(mockConversationStore.setStatus).toHaveBeenCalledWith(ENTITY_ID, 'permission');
      });
    });
  });
});
