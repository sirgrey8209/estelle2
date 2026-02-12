/**
 * @file state-sync.test.ts
 * @description 상태 동기화 문제 재현 테스트
 *
 * 테스트 대상 문제:
 * 1. 대화 시작 시 StatusDot이 노란색(working)으로 안 바뀜
 *    - conversation_status 메시지에 workspaceId가 누락됨 (Phase 5에서 해결 예정)
 * 2. 워크스페이스 갔다오면 히스토리가 날아감
 *    - Phase 3에서 conversationStore로 해결
 * 3. 다른 대화창에 갔는데 Stop 버튼이 떠있음 (상태 격리 문제)
 *    - Phase 3에서 conversationStore로 해결
 * 4. 앱 껐다 켜면 응답 중인데 Stop 버튼이 안 뜸 (재연결 시 상태 복원)
 *    - Phase 5에서 conversation_status 수정으로 해결 예정
 * 5. 히스토리가 제대로 안 나옴
 *    - Phase 3에서 conversationStore로 해결
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageType } from '@estelle/core';
import { routeMessage } from '../hooks/useMessageRouter';
import { useConversationStore } from '../stores/conversationStore';
import { useWorkspaceStore } from '../stores/workspaceStore';

// =========================================
// Mock 설정
// =========================================

// relaySender mock
vi.mock('../services/relaySender', () => ({
  selectConversation: vi.fn(),
}));

// relayStore mock
vi.mock('../stores/relayStore', () => ({
  useRelayStore: {
    getState: () => ({}),
  },
}));

// syncOrchestrator mock
vi.mock('../services/syncOrchestrator', () => ({
  syncOrchestrator: {
    onWorkspaceListReceived: vi.fn(),
  },
}));

// settingsStore mock
vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      setUsageSummary: vi.fn(),
    }),
  },
}));

// =========================================
// 테스트 유틸
// =========================================

function createMockWorkspace(id: string, convs: Array<{ id: string; conversationId: number; name: string; status?: string }>) {
  return {
    workspaceId: id,
    name: `Workspace ${id}`,
    workingDir: `/work/${id}`,
    permissionMode: 'default' as const,
    isActive: true,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    conversations: convs.map((c) => ({
      conversationId: c.conversationId,
      name: c.name,
      status: (c.status || 'idle') as 'idle' | 'working' | 'waiting' | 'error',
      unread: false,
      permissionMode: 'default' as const,
      createdAt: Date.now(),
      claudeSessionId: null,
    })),
  };
}

// =========================================
// 테스트
// =========================================

describe('상태 동기화 문제', () => {
  beforeEach(() => {
    // 스토어 초기화
    useConversationStore.getState().reset();
    useWorkspaceStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('문제 1: 대화 시작 시 StatusDot이 working으로 안 바뀜 (Phase 5 해결됨)', () => {
    /**
     * Phase 5에서 해결됨
     * Pylon이 이제 conversation_status 메시지에 workspaceId를 포함함
     *
     * 아래 테스트는 workspaceId가 없을 때의 방어적 동작을 검증함
     * (실제로 Pylon은 항상 workspaceId를 포함하지만, 방어적 처리 확인용)
     */
    it('conversation_status 메시지에 conversationId가 없으면 상태 업데이트 안됨 (방어적 동작)', () => {
      const pylonId = 1;

      // 워크스페이스 설정
      useWorkspaceStore.getState().setWorkspaces(pylonId, [
        createMockWorkspace('ws-1', [{ id: 'conv-1', conversationId: 1001, name: 'Conversation 1' }]),
      ]);

      // conversation_status 메시지 수신 (conversationId 없음 - 비정상 케이스)
      routeMessage({
        type: MessageType.CONVERSATION_STATUS,
        payload: {
          deviceId: pylonId,
          status: 'working',
          // conversationId 누락!
        },
      });

      // 상태 확인 - conversationId 없이는 업데이트가 안됨
      const conversation = useWorkspaceStore
        .getState()
        .getConversation(pylonId, 1001);

      expect(conversation?.status).toBe('idle');
    });

    it('conversation_status 메시지에 conversationId가 있으면 상태 업데이트 성공', () => {
      const pylonId = 1;

      // 워크스페이스 설정
      useWorkspaceStore.getState().setWorkspaces(pylonId, [
        createMockWorkspace('ws-1', [{ id: 'conv-1', conversationId: 1001, name: 'Conversation 1' }]),
      ]);

      // conversation_status 메시지 수신 (conversationId 포함)
      routeMessage({
        type: MessageType.CONVERSATION_STATUS,
        payload: {
          deviceId: pylonId,
          conversationId: 1001,
          status: 'working',
        },
      });

      // 상태 확인
      const conversation = useWorkspaceStore
        .getState()
        .getConversation(pylonId, 1001);

      expect(conversation?.status).toBe('working');
    });
  });

  describe('문제 2: 워크스페이스 갔다오면 히스토리 날아감 (해결됨)', () => {
    it('conversationStore는 대화별로 메시지를 캐시함', () => {
      const store = useConversationStore.getState();

      // 대화 1에서 메시지 추가
      store.setCurrentConversation(1001);
      store.addMessage(1001, {
        id: 'msg-1',
        role: 'user',
        type: 'text',
        content: 'Hello',
        timestamp: Date.now(),
      });

      expect(store.getState(1001)?.messages).toHaveLength(1);

      // 대화 2로 전환
      store.setCurrentConversation(1002);
      store.addMessage(1002, {
        id: 'msg-2',
        role: 'user',
        type: 'text',
        content: 'World',
        timestamp: Date.now(),
      });

      expect(store.getState(1002)?.messages).toHaveLength(1);

      // 대화 1로 다시 전환
      store.setCurrentConversation(1001);

      // ✅ 캐시된 메시지 복원됨
      const state = useConversationStore.getState();
      expect(state.getState(1001)?.messages).toHaveLength(1);
      expect((state.getState(1001)?.messages[0] as any).content).toBe('Hello');
    });
  });

  describe('문제 3: 다른 대화창에서 Stop 버튼 표시 (해결됨)', () => {
    it('conversationStore는 대화별로 status를 관리함', () => {
      const store = useConversationStore.getState();

      // 대화 1: working 상태
      store.setCurrentConversation(1001);
      store.setStatus(1001, 'working');

      // 대화 2: idle 상태
      store.setCurrentConversation(1002);
      store.setStatus(1002, 'idle');

      // 각 대화의 상태가 독립적으로 유지됨
      const state = useConversationStore.getState();
      expect(state.getState(1001)?.status).toBe('working');
      expect(state.getState(1002)?.status).toBe('idle');

      // ✅ 대화별로 격리됨 - 다른 대화의 Stop 버튼이 표시되지 않음
    });

    it('conversation별 status는 workspaceStore에도 있음', () => {
      const pylonId = 1;

      // 워크스페이스 설정 - 두 대화의 상태가 다름
      useWorkspaceStore.getState().setWorkspaces(pylonId, [
        createMockWorkspace('ws-1', [
          { id: 'conv-1', conversationId: 1001, name: 'Conv 1', status: 'working' },
          { id: 'conv-2', conversationId: 1002, name: 'Conv 2', status: 'idle' },
        ]),
      ]);

      const conv1 = useWorkspaceStore.getState().getConversation(pylonId, 1001);
      const conv2 = useWorkspaceStore.getState().getConversation(pylonId, 1002);

      expect(conv1?.status).toBe('working');
      expect(conv2?.status).toBe('idle');
    });
  });

  describe('문제 5: 히스토리 로드 문제 (해결됨)', () => {
    it('HISTORY_RESULT가 conversationId 기반으로 적용됨', () => {
      // 워크스페이스 설정 (selectConversation이 동작하려면 워크스페이스 데이터가 필요)
      useWorkspaceStore.getState().setWorkspaces(1, [
        createMockWorkspace('ws-1', [{ id: 'conv-1', conversationId: 1001, name: 'Conv 1' }]),
      ]);

      // 대화 1 선택 중
      useWorkspaceStore.getState().selectConversation(1, 1001);

      // 대화 1의 히스토리 도착
      routeMessage({
        type: MessageType.HISTORY_RESULT,
        payload: {
          conversationId: 1001,
          messages: [
            {
              id: 'hist-1',
              role: 'user',
              type: 'text',
              content: 'History message',
              timestamp: Date.now(),
            },
          ],
        },
      });

      // 대화 1에 히스토리가 설정됨 (conversationId 기반)
      const state = useConversationStore.getState();
      expect(state.getState(1001)?.messages).toHaveLength(1);
      expect((state.getState(1001)?.messages[0] as any).content).toBe('History message');
    });
  });
});

describe('conversationStore.status와 conversation.status 동기화', () => {
  beforeEach(() => {
    useConversationStore.getState().reset();
    useWorkspaceStore.getState().reset();
  });

  it('CLAUDE_EVENT state 이벤트 수신 시 conversationStore.status가 변경됨', () => {
    const pylonId = 1;

    // 워크스페이스 설정
    useWorkspaceStore.getState().setWorkspaces(pylonId, [
      createMockWorkspace('ws-1', [{ id: 'conv-1', conversationId: 1001, name: 'Conv 1', status: 'idle' }]),
    ]);

    // 현재 대화 선택 (selectConversation은 workspaces에 있는 대화만 선택 가능)
    useWorkspaceStore.getState().selectConversation(pylonId, 1001);

    // CLAUDE_EVENT 수신
    routeMessage({
      type: MessageType.CLAUDE_EVENT,
      payload: {
        event: {
          type: 'state',
          state: 'working',
        },
      },
    });

    const state = useConversationStore.getState();
    expect(state.getState(1001)?.status).toBe('working');
  });

  it('CLAUDE_EVENT text 이벤트가 textBuffer에 추가됨', () => {
    const pylonId = 1;

    // 워크스페이스 설정
    useWorkspaceStore.getState().setWorkspaces(pylonId, [
      createMockWorkspace('ws-1', [{ id: 'conv-1', conversationId: 1001, name: 'Conv 1', status: 'idle' }]),
    ]);

    // 현재 대화 선택
    useWorkspaceStore.getState().selectConversation(pylonId, 1001);

    // CLAUDE_EVENT 수신
    routeMessage({
      type: MessageType.CLAUDE_EVENT,
      payload: {
        event: {
          type: 'text',
          text: 'Hello',
        },
      },
    });

    routeMessage({
      type: MessageType.CLAUDE_EVENT,
      payload: {
        event: {
          type: 'text',
          text: ' World',
        },
      },
    });

    const state = useConversationStore.getState();
    expect(state.getState(1001)?.textBuffer).toBe('Hello World');
  });
});
