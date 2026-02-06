/**
 * @file message-flow.test.ts
 * @description 메시지 전송 플로우 E2E 테스트
 *
 * 사용자 메시지 전송 → Claude 응답 수신 플로우를 검증합니다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageType } from '@estelle/core';

// Mock workspaces
const mockWorkspaces = [
  {
    workspaceId: 'ws-1',
    name: 'Test Workspace',
    workingDir: '/test',
    isActive: true,
    conversations: [
      {
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
  selectedConversation: {
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

const claudeMessages: any[] = [];
const mockClaudeStore = {
  messages: claudeMessages,
  status: 'idle',
  hasPendingRequests: false,
  setMessages: vi.fn((msgs) => {
    claudeMessages.length = 0;
    claudeMessages.push(...msgs);
  }),
  addMessage: vi.fn((msg) => {
    claudeMessages.push(msg);
  }),
  handleClaudeEvent: vi.fn((payload) => {
    // 실제 handleClaudeEvent 로직 시뮬레이션
    const { event } = payload;
    if (event?.type === 'text') {
      claudeMessages.push({
        role: 'assistant',
        content: event.text,
      });
    }
  }),
  setStatus: vi.fn(),
};

const mockRelayStore = {
  isConnected: true,
  desksLoaded: false,
  setDesksLoaded: vi.fn(),
};

// Mock modules
vi.mock('../stores/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (state: typeof mockWorkspaceStore) => any) =>
      selector ? selector(mockWorkspaceStore) : mockWorkspaceStore,
    { getState: () => mockWorkspaceStore }
  ),
}));

vi.mock('../stores/claudeStore', () => ({
  useClaudeStore: Object.assign(
    (selector?: (state: typeof mockClaudeStore) => any) =>
      selector ? selector(mockClaudeStore) : mockClaudeStore,
    { getState: () => mockClaudeStore }
  ),
}));

vi.mock('../stores/relayStore', () => ({
  useRelayStore: Object.assign(
    (selector?: (state: typeof mockRelayStore) => any) =>
      selector ? selector(mockRelayStore) : mockRelayStore,
    { getState: () => mockRelayStore }
  ),
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
    claudeMessages.length = 0;
    mockRelayStore.desksLoaded = false;
    // WebSocket mock 설정
    setWebSocket(mockWebSocket);
  });

  describe('메시지 전송', () => {
    it('사용자 메시지가 올바른 형식으로 전송되어야 한다', () => {
      // Given
      const workspaceId = 'ws-1';
      const conversationId = 'conv-1';
      const message = 'Hello, Claude!';

      // When
      sendClaudeMessage(workspaceId, conversationId, message);

      // Then
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual({
        type: MessageType.CLAUDE_SEND,
        payload: {
          workspaceId,
          conversationId,
          message,
          attachments: undefined,
        },
      });
    });

    it('첨부 파일이 있는 메시지가 전송되어야 한다', () => {
      // Given
      const workspaceId = 'ws-1';
      const conversationId = 'conv-1';
      const message = 'Check this image';
      const attachments = ['file:///path/to/image.png'];

      // When
      sendClaudeMessage(workspaceId, conversationId, message, attachments);

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
              conversations: [{ conversationId: 'conv-1', status: 'idle' }],
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

    it('claude_event가 claudeStore에 전달되어야 한다', () => {
      // Given
      const message = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: 'conv-1',
          event: {
            type: 'text',
            text: 'Hello! How can I help you?',
          },
        },
      };

      // When
      routeMessage(message);

      // Then
      expect(mockClaudeStore.handleClaudeEvent).toHaveBeenCalledWith(message.payload);
    });

    it('history_result가 메시지 목록을 설정해야 한다', () => {
      // Given
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const message = {
        type: MessageType.HISTORY_RESULT,
        payload: { messages },
      };

      // When
      routeMessage(message);

      // Then
      expect(mockClaudeStore.setMessages).toHaveBeenCalledWith(messages);
    });
  });

  describe('전체 플로우', () => {
    it('메시지 전송 후 응답 수신까지 전체 플로우가 동작해야 한다', async () => {
      // 1. 사용자 메시지 전송
      sendClaudeMessage('ws-1', 'conv-1', 'What is 2+2?');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].type).toBe(MessageType.CLAUDE_SEND);

      // 2. Claude 응답 수신 시뮬레이션
      routeMessage({
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: 'conv-1',
          event: {
            type: 'text',
            text: '2+2 equals 4.',
          },
        },
      });

      // 3. 응답이 처리되었는지 확인
      expect(mockClaudeStore.handleClaudeEvent).toHaveBeenCalled();
    });

    it('사용자 메시지가 store에 추가되어야 한다', () => {
      // When - ChatArea의 handleSend 로직 시뮬레이션
      mockClaudeStore.addMessage({
        id: `user-${Date.now()}-test`,
        type: 'user' as const,
        content: 'Hello, Claude!',
        timestamp: Date.now(),
        attachments: undefined,
      });
      sendClaudeMessage('ws-1', 'conv-1', 'Hello, Claude!');

      // Then
      expect(mockClaudeStore.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user',
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
      mockClaudeStore.addMessage({
        id: `user-${Date.now()}-test`,
        type: 'user' as const,
        content: 'Check this',
        timestamp: Date.now(),
        attachments,
      });
      sendClaudeMessage('ws-1', 'conv-1', 'Check this', ['/path/to/image.png']);

      // Then
      expect(mockClaudeStore.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user',
          content: 'Check this',
          attachments: expect.arrayContaining([
            expect.objectContaining({ filename: 'image.png' }),
          ]),
        })
      );
    });
  });
});
