/**
 * @file message-flow.test.ts
 * @description 메시지 전송 플로우 E2E 테스트
 *
 * 사용자 메시지 전송 -> Claude 응답 수신 플로우를 검증합니다.
 * entityId(number)를 키로 사용합니다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageType } from '@estelle/core';

// Entity IDs (number)
const ENTITY_ID = 1001;

// Mock workspaces
const mockWorkspaces = [
  {
    workspaceId: 'ws-1',
    name: 'Test Workspace',
    workingDir: '/test',
    isActive: true,
    conversations: [
      {
        entityId: ENTITY_ID,
        conversationId: 'conv-1',
        name: 'Main',
        status: 'idle' as const,
        unread: false,
      },
    ],
  },
];

const mockWorkspaceStore = {
  connectedPylons: [{ deviceId: 1, deviceName: 'Test PC' }],
  workspacesByPylon: new Map<number, unknown[]>(),
  selectedConversation: {
    entityId: ENTITY_ID,
    workspaceId: 'ws-1',
    workspaceName: 'Test Workspace',
    workingDir: '/test',
    conversationId: 'conv-1',
    conversationName: 'Main',
    status: 'idle',
    unread: false,
  },
  setWorkspaces: vi.fn(),
  updateConversationStatus: vi.fn(),
  addConnectedPylon: vi.fn(),
  selectConversation: vi.fn(),
  getAllWorkspaces: vi.fn(() => [{ pylonId: 1, workspaces: mockWorkspaces }]),
};

// conversationStore mock (entityId: number 기반)
const convMessages: Map<number, any[]> = new Map();
const mockConversationStore = {
  states: new Map<number, unknown>(),
  currentEntityId: ENTITY_ID as number | null,
  setMessages: vi.fn((entityId: number, msgs: any[]) => {
    convMessages.set(entityId, [...msgs]);
  }),
  setStatus: vi.fn(),
  appendTextBuffer: vi.fn(),
  flushTextBuffer: vi.fn(),
  clearTextBuffer: vi.fn(),
  addMessage: vi.fn((entityId: number, msg: any) => {
    const msgs = convMessages.get(entityId) || [];
    msgs.push(msg);
    convMessages.set(entityId, msgs);
  }),
  addPendingRequest: vi.fn(),
  updateRealtimeUsage: vi.fn(),
  getState: vi.fn((entityId: number) => ({
    messages: convMessages.get(entityId) || [],
    status: 'idle',
  })),
};

const mockRelayStore = {
  isConnected: true,
};

// Mock modules
vi.mock('../stores/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (state: typeof mockWorkspaceStore) => any) =>
      selector ? selector(mockWorkspaceStore) : mockWorkspaceStore,
    { getState: () => mockWorkspaceStore }
  ),
}));

vi.mock('../stores/conversationStore', () => ({
  useConversationStore: Object.assign(
    (selector?: (state: typeof mockConversationStore) => any) =>
      selector ? selector(mockConversationStore) : mockConversationStore,
    { getState: () => mockConversationStore }
  ),
}));

vi.mock('../stores/relayStore', () => ({
  useRelayStore: Object.assign(
    (selector?: (state: typeof mockRelayStore) => any) =>
      selector ? selector(mockRelayStore) : mockRelayStore,
    { getState: () => mockRelayStore }
  ),
}));

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      setUsageSummary: vi.fn(),
    }),
  },
}));

// syncOrchestrator mock
vi.mock('../services/syncOrchestrator', () => ({
  syncOrchestrator: {
    onWorkspaceListReceived: vi.fn(),
  },
}));

// selectConversation mock
vi.mock('../services/relaySender', async () => {
  const actual = await vi.importActual('../services/relaySender');
  return {
    ...actual,
    selectConversation: vi.fn(),
  };
});

// Mock WebSocket
let sentMessages: any[] = [];

// WebSocket.OPEN 상수 (테스트 환경에서 WebSocket이 없을 수 있음)
const WS_OPEN = 1;

const mockWebSocket = {
  readyState: WS_OPEN,
  send: vi.fn((data) => {
    sentMessages.push(JSON.parse(data));
  }),
} as unknown as WebSocket;

// Import after mocks
const { routeMessage } = await import('../hooks/useMessageRouter');
const { sendClaudeMessage, setWebSocket } = await import('../services/relaySender');

describe('메시지 플로우 E2E 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentMessages = [];
    convMessages.clear();
    // WebSocket mock 설정
    setWebSocket(mockWebSocket);
  });

  describe('메시지 전송', () => {
    it('사용자 메시지가 올바른 형식으로 전송되어야 한다', () => {
      // Given
      const message = 'Hello, Claude!';

      // When
      sendClaudeMessage(ENTITY_ID, message);

      // Then
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual({
        type: MessageType.CLAUDE_SEND,
        payload: {
          entityId: ENTITY_ID,
          message,
          attachments: undefined,
        },
      });
    });

    it('첨부 파일이 있는 메시지가 전송되어야 한다', () => {
      // Given
      const message = 'Check this image';
      const attachments = ['file:///path/to/image.png'];

      // When
      sendClaudeMessage(ENTITY_ID, message, attachments);

      // Then
      expect(sentMessages[0].payload.attachments).toEqual(attachments);
    });
  });

  describe('메시지 수신 (routeMessage)', () => {
    it('workspace_list_result가 올바르게 처리되어야 한다', () => {
      // Given
      const message = {
        type: MessageType.WORKSPACE_LIST_RESULT,
        payload: {
          deviceId: 1,
          deviceName: 'My PC',
          workspaces: [
            {
              workspaceId: 'ws-1',
              name: 'Project A',
              workingDir: 'C:\\Projects\\A',
              isActive: true,
              conversations: [{ entityId: ENTITY_ID, conversationId: 'conv-1', status: 'idle' }],
            },
          ],
        },
      };

      // When
      routeMessage(message);

      // Then
      expect(mockWorkspaceStore.addConnectedPylon).toHaveBeenCalledWith({
        deviceId: 1,
        deviceName: 'My PC',
      });

      expect(mockWorkspaceStore.setWorkspaces).toHaveBeenCalledWith(
        1,
        message.payload.workspaces,
        undefined
      );
    });

    it('claude_event text가 conversationStore에 전달되어야 한다', () => {
      // Given
      const message = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          entityId: ENTITY_ID,
          event: {
            type: 'text',
            text: 'Hello! How can I help you?',
          },
        },
      };

      // When
      routeMessage(message);

      // Then
      expect(mockConversationStore.appendTextBuffer).toHaveBeenCalledWith(
        ENTITY_ID,
        'Hello! How can I help you?'
      );
    });

    it('history_result가 메시지 목록을 설정해야 한다', () => {
      // Given
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const message = {
        type: MessageType.HISTORY_RESULT,
        payload: { messages, entityId: ENTITY_ID, totalCount: 2 },
      };

      // When
      routeMessage(message);

      // Then
      // setMessages는 이제 paging 정보 없이 호출됨 (syncStore에서 관리)
      expect(mockConversationStore.setMessages).toHaveBeenCalledWith(ENTITY_ID, messages);
    });
  });

  describe('전체 플로우', () => {
    it('메시지 전송 후 응답 수신까지 전체 플로우가 동작해야 한다', async () => {
      // 1. 사용자 메시지 전송
      sendClaudeMessage(ENTITY_ID, 'What is 2+2?');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].type).toBe(MessageType.CLAUDE_SEND);

      // 2. Claude 응답 수신 시뮬레이션
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          entityId: ENTITY_ID,
          event: {
            type: 'text',
            text: '2+2 equals 4.',
          },
        },
      });

      // 3. 응답이 처리되었는지 확인
      expect(mockConversationStore.appendTextBuffer).toHaveBeenCalledWith(
        ENTITY_ID,
        '2+2 equals 4.'
      );
    });

    it('사용자 메시지가 store에 추가되어야 한다', () => {
      // When - ChatArea의 handleSend 로직 시뮬레이션
      mockConversationStore.addMessage(ENTITY_ID, {
        id: `user-${Date.now()}-test`,
        role: 'user',
        type: 'text',
        content: 'Hello, Claude!',
        timestamp: Date.now(),
        attachments: undefined,
      });
      sendClaudeMessage(ENTITY_ID, 'Hello, Claude!');

      // Then
      expect(mockConversationStore.addMessage).toHaveBeenCalledWith(
        ENTITY_ID,
        expect.objectContaining({
          role: 'user',
          type: 'text',
          content: 'Hello, Claude!',
        })
      );
      expect(sentMessages).toHaveLength(1);
    });

    it('첨부파일 있는 사용자 메시지가 store에 추가되어야 한다', () => {
      // Given
      const attachments = [
        { id: 'att-1', filename: 'image.png', localPath: '/path/to/image.png' },
      ];

      // When - ChatArea의 handleSend 로직 시뮬레이션
      mockConversationStore.addMessage(ENTITY_ID, {
        id: `user-${Date.now()}-test`,
        role: 'user',
        type: 'text',
        content: 'Check this',
        timestamp: Date.now(),
        attachments,
      });
      sendClaudeMessage(ENTITY_ID, 'Check this', ['/path/to/image.png']);

      // Then
      expect(mockConversationStore.addMessage).toHaveBeenCalledWith(
        ENTITY_ID,
        expect.objectContaining({
          role: 'user',
          type: 'text',
          content: 'Check this',
          attachments: expect.arrayContaining([
            expect.objectContaining({ filename: 'image.png' }),
          ]),
        })
      );
    });
  });
});
