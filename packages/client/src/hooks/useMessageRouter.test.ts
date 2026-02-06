/**
 * @file useMessageRouter.test.ts
 * @description 메시지 라우터 훅 테스트
 *
 * Relay에서 수신한 메시지를 적절한 Store에 디스패치합니다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageType } from '@estelle/core';
import type { RelayMessage } from '../services/relayService';

// Store mock - 모킹을 먼저 선언
const mockWorkspaceStore = {
  connectedPylons: [] as Array<{ deviceId: number; deviceName: string }>,
  setWorkspaces: vi.fn(),
  updateConversationStatus: vi.fn(),
  addConnectedPylon: vi.fn(),
};

const mockClaudeStore = {
  setMessages: vi.fn(),
  handleClaudeEvent: vi.fn(),
  setStatus: vi.fn(),
};

const mockRelayStore = {
  desksLoaded: false,
  setDesksLoaded: vi.fn(),
};

// vi.mock은 호이스팅되므로 순서 주의
vi.mock('../stores/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: () => mockWorkspaceStore,
  },
}));

vi.mock('../stores/claudeStore', () => ({
  useClaudeStore: {
    getState: () => mockClaudeStore,
  },
}));

vi.mock('../stores/relayStore', () => ({
  useRelayStore: {
    getState: () => mockRelayStore,
  },
}));

// selectConversation mock
vi.mock('../services/relaySender', () => ({
  selectConversation: vi.fn(),
}));

// 모킹 후에 import
const { routeMessage } = await import('./useMessageRouter');

describe('routeMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRelayStore.desksLoaded = false;
    mockWorkspaceStore.connectedPylons = [];
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
              conversations: [{ conversationId: 'conv-1', status: 'idle' }],
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
      expect(mockRelayStore.setDesksLoaded).toHaveBeenCalledWith(true);
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
  });

  describe('conversation messages', () => {
    it('should route conversation_status to workspaceStore.updateConversationStatus', () => {
      mockWorkspaceStore.connectedPylons = [{ deviceId: 1, deviceName: 'Test' }];

      const message: RelayMessage = {
        type: MessageType.CONVERSATION_STATUS,
        payload: {
          workspaceId: 'ws-1',
          conversationId: 'conv-1',
          status: 'working',
        },
      };

      routeMessage(message);

      expect(mockWorkspaceStore.updateConversationStatus).toHaveBeenCalledWith(
        1,
        'ws-1',
        'conv-1',
        'working',
        undefined
      );
    });

    it('should route history_result to claudeStore.setMessages', () => {
      const message: RelayMessage = {
        type: MessageType.HISTORY_RESULT,
        payload: {
          conversationId: 'conv-1',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        },
      };

      routeMessage(message);

      expect(mockClaudeStore.setMessages).toHaveBeenCalledWith(message.payload.messages);
    });
  });

  describe('claude messages', () => {
    it('should route claude_event to claudeStore.handleClaudeEvent', () => {
      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: 'conv-1',
          event: {
            type: 'text',
            text: 'Hello from Claude',
          },
        },
      };

      routeMessage(message);

      expect(mockClaudeStore.handleClaudeEvent).toHaveBeenCalledWith(message.payload);
    });

    it('should route claude_event with state to claudeStore', () => {
      const message: RelayMessage = {
        type: MessageType.CLAUDE_EVENT,
        payload: {
          conversationId: 'conv-1',
          event: {
            type: 'state',
            state: 'working',
          },
        },
      };

      routeMessage(message);

      expect(mockClaudeStore.handleClaudeEvent).toHaveBeenCalledWith(message.payload);
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
});
