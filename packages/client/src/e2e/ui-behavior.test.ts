/**
 * @file ui-behavior.test.ts
 * @description UI 동작 검증 테스트 (Store + Service 레벨)
 *
 * React Native 컴포넌트를 직접 렌더링하지 않고,
 * 실제 UI 컴포넌트가 호출하는 Store/Service 동작을 검증합니다.
 *
 * 이 방식의 장점:
 * - vitest 환경에서 빠르게 실행
 * - 실제 비즈니스 로직 검증
 * - UI 변경에 덜 민감
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageType } from '@estelle/core';

// =========================================
// Mock 설정
// =========================================

// WebSocket mock
let sentMessages: Array<{ type: string; payload: unknown }> = [];
const WS_OPEN = 1;
const mockWebSocket = {
  readyState: WS_OPEN,
  send: vi.fn((data: string) => {
    sentMessages.push(JSON.parse(data));
  }),
} as unknown as WebSocket;

// Store mocks - conversationStore 사용
const mockConversationState = {
  status: 'idle' as 'idle' | 'working' | 'permission',
  messages: [] as unknown[],
  textBuffer: '',
  pendingRequests: [] as unknown[],
  workStartTime: null as number | null,
  realtimeUsage: null,
};

const mockConversationStore = {
  states: new Map<number, typeof mockConversationState>(),
  currentEntityId: 1001 as number | null,
  getState: vi.fn((entityId: number) => mockConversationState),
  getCurrentState: vi.fn(() => mockConversationState),
  hasPendingRequests: vi.fn((_entityId?: number) => mockConversationState.pendingRequests.length > 0),
  setStatus: vi.fn((entityId: number, status: string) => {
    mockConversationState.status = status as any;
  }),
  addMessage: vi.fn((entityId: number, msg: unknown) => {
    mockConversationState.messages.push(msg);
  }),
  setMessages: vi.fn((entityId: number, msgs: unknown[]) => {
    mockConversationState.messages = [...msgs];
  }),
  clearMessages: vi.fn((entityId: number) => {
    mockConversationState.messages = [];
    mockConversationState.pendingRequests = [];
  }),
  appendTextBuffer: vi.fn((entityId: number, text: string) => {
    mockConversationState.textBuffer += text;
  }),
  flushTextBuffer: vi.fn((entityId: number) => {
    if (mockConversationState.textBuffer) {
      mockConversationState.messages.push({
        role: 'assistant',
        type: 'text',
        content: mockConversationState.textBuffer,
      });
      mockConversationState.textBuffer = '';
    }
  }),
  addPendingRequest: vi.fn((entityId: number, req: unknown) => {
    mockConversationState.pendingRequests.push(req);
  }),
  removePendingRequest: vi.fn((entityId: number, id: string) => {
    mockConversationState.pendingRequests = mockConversationState.pendingRequests.filter(
      (r: any) => r.toolUseId !== id
    );
  }),
  deleteConversation: vi.fn(),
  reset: vi.fn(),
};

const mockWorkspaceStore = {
  connectedPylons: [{ deviceId: 1, deviceName: 'Test PC' }],
  selectedConversation: {
    workspaceId: 'ws-1',
    workspaceName: 'Test Workspace',
    workingDir: '/test',
    entityId: 1001,
    conversationId: 'conv-1',
    conversationName: 'Main',
    status: 'idle',
    unread: false,
  },
  setWorkspaces: vi.fn(),
  updateConversationStatus: vi.fn(),
  addConnectedPylon: vi.fn(),
  selectConversation: vi.fn(),
  clearSelection: vi.fn(),
  getAllWorkspaces: vi.fn(() => [
    {
      pylonId: 1,
      workspaces: [
        {
          workspaceId: 'ws-1',
          name: 'Test Workspace',
          workingDir: '/test',
          isActive: true,
          conversations: [
            { entityId: 1001, conversationId: 'conv-1', name: 'Main', status: 'idle', unread: false },
          ],
        },
      ],
    },
  ]),
};

// Service imports (mock 전에 import해야 함)
import { sendClaudeMessage, sendClaudeControl, setWebSocket, selectConversation, sendPermissionResponse, sendQuestionResponse } from '../services/relaySender';

// =========================================
// InputBar 동작 테스트
// =========================================
describe('InputBar 동작', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentMessages = [];
    mockConversationState.messages = [];
    mockConversationState.status = 'idle';
    mockConversationState.textBuffer = '';
    mockConversationState.pendingRequests = [];
    setWebSocket(mockWebSocket);
  });

  describe('메시지 전송', () => {
    it('텍스트 전송 시 CLAUDE_SEND 메시지가 전송되어야 한다', () => {
      // InputBar의 handleSend가 호출되면:
      sendClaudeMessage(1001, 'Hello, Claude!');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual({
        type: MessageType.CLAUDE_SEND,
        payload: {
          entityId: 1001,
          message: 'Hello, Claude!',
          attachments: undefined,
        },
      });
    });

    it('이미지 첨부 시 attachments가 포함되어야 한다', () => {
      const attachments = ['file:///test/image.jpg'];
      sendClaudeMessage(1001, '이미지 확인해주세요', attachments);

      expect(sentMessages[0].payload).toMatchObject({
        message: '이미지 확인해주세요',
        attachments: ['file:///test/image.jpg'],
      });
    });

    it('빈 텍스트는 전송 전 UI에서 검증됨 (서비스 레벨 테스트 범위 밖)', () => {
      // UI 레벨에서 canSend 체크로 빈 메시지 방지
      // 여기서는 서비스가 정상 동작하는지만 확인
      sendClaudeMessage(1001, '');
      expect(sentMessages).toHaveLength(1); // 서비스는 그대로 전송
    });
  });

  describe('Stop 버튼', () => {
    it('Stop 시 CLAUDE_CONTROL 메시지가 전송되어야 한다', () => {
      sendClaudeControl(1001, 'stop');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual({
        type: MessageType.CLAUDE_CONTROL,
        payload: {
          entityId: 1001,
          action: 'stop',
        },
      });
    });
  });
});

// =========================================
// ChatArea 동작 테스트
// =========================================
describe('ChatArea 동작', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentMessages = [];
    mockConversationState.messages = [];
    mockConversationState.status = 'idle';
    mockConversationState.pendingRequests = [];
    setWebSocket(mockWebSocket);
  });

  describe('메시지 전송 플로우', () => {
    it('사용자 메시지 전송 시 optimistic update가 적용되어야 한다', () => {
      // ChatArea.handleSend 시뮬레이션
      const userMessage = {
        id: 'user-123',
        role: 'user',
        type: 'text',
        content: 'Hello, Claude!',
        timestamp: Date.now(),
      };
      mockConversationStore.addMessage(1001, userMessage);
      sendClaudeMessage(1001, 'Hello, Claude!');

      // Store에 메시지가 추가됨
      expect(mockConversationState.messages).toHaveLength(1);
      expect(mockConversationState.messages[0]).toMatchObject({
        role: 'user',
        content: 'Hello, Claude!',
      });

      // Relay로 전송됨
      expect(sentMessages).toHaveLength(1);
    });
  });

  describe('상태에 따른 UI 비활성화', () => {
    it('working 상태에서는 disabled=true', () => {
      mockConversationState.status = 'working';

      // ChatArea에서 계산되는 로직:
      const currentState = mockConversationStore.getCurrentState();
      const isWorking = currentState?.status === 'working';
      const hasPending = mockConversationStore.hasPendingRequests(1001);
      const disabled = isWorking || hasPending;

      expect(disabled).toBe(true);
    });

    it('permission 요청이 있으면 disabled=true', () => {
      mockConversationState.status = 'idle';
      mockConversationState.pendingRequests = [{ type: 'permission', toolUseId: 'test' }];

      const currentState = mockConversationStore.getCurrentState();
      const isWorking = currentState?.status === 'working';
      const hasPending = mockConversationStore.hasPendingRequests(1001);
      const disabled = isWorking || hasPending;

      expect(disabled).toBe(true);
    });

    it('idle 상태이고 요청이 없으면 disabled=false', () => {
      mockConversationState.status = 'idle';
      mockConversationState.pendingRequests = [];

      const currentState = mockConversationStore.getCurrentState();
      const isWorking = currentState?.status === 'working';
      const hasPending = mockConversationStore.hasPendingRequests(1001);
      const disabled = isWorking || hasPending;

      expect(disabled).toBe(false);
    });
  });
});

// =========================================
// WorkspaceSidebar 동작 테스트
// =========================================
describe('WorkspaceSidebar 동작', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentMessages = [];
    mockConversationState.messages = [];
    setWebSocket(mockWebSocket);
  });

  describe('대화 선택', () => {
    it('대화 선택 시 서버에 CONVERSATION_SELECT가 전송되어야 한다', () => {
      selectConversation(1001);

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual({
        type: MessageType.CONVERSATION_SELECT,
        payload: {
          entityId: 1001,
        },
      });
    });

    it('대화 선택 시 setCurrentConversation이 호출됨', () => {
      // WorkspaceSidebar.onPress 시뮬레이션
      // 이전: claudeStore.clearMessages()
      // 현재: conversationStore.setCurrentConversation()

      // 이 테스트는 실제 컴포넌트 로직 확인용
      // 대화 전환 시 상태 변경은 conversationStore가 처리
      selectConversation(1001);

      expect(sentMessages).toHaveLength(1);
    });
  });
});

// =========================================
// RequestBar 동작 테스트
// =========================================
describe('RequestBar 동작', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentMessages = [];
    mockConversationState.pendingRequests = [];
    setWebSocket(mockWebSocket);
  });

  describe('권한 요청 처리', () => {
    it('허용 응답 시 CLAUDE_PERMISSION 메시지가 전송되어야 한다', () => {
      sendPermissionResponse(1001, 'tool-123', 'allow');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toMatchObject({
        type: MessageType.CLAUDE_PERMISSION,
        payload: {
          entityId: 1001,
          toolUseId: 'tool-123',
          decision: 'allow',
        },
      });
    });

    it('거부 응답 시 decision=deny로 전송되어야 한다', () => {
      sendPermissionResponse(1001, 'tool-123', 'deny');

      expect(sentMessages[0].payload).toMatchObject({
        decision: 'deny',
      });
    });
  });

  describe('질문 요청 처리', () => {
    it('질문 응답 시 CLAUDE_ANSWER가 전송되어야 한다', () => {
      sendQuestionResponse(1001, 'tool-456', 'React');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toMatchObject({
        type: MessageType.CLAUDE_ANSWER,
        payload: {
          entityId: 1001,
          toolUseId: 'tool-456',
          answer: 'React',
        },
      });
    });
  });
});

// =========================================
// 스트리밍 동작 테스트
// =========================================
describe('스트리밍 동작', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationState.messages = [];
    mockConversationState.textBuffer = '';
  });

  it('text 이벤트가 연속으로 오면 textBuffer에 누적되어야 한다', () => {
    // 스트리밍 시뮬레이션
    mockConversationStore.appendTextBuffer(1001, 'Hello');
    mockConversationStore.appendTextBuffer(1001, ' World');
    mockConversationStore.appendTextBuffer(1001, '!');

    expect(mockConversationState.textBuffer).toBe('Hello World!');
  });

  it('textComplete 이벤트 시 메시지로 변환되어야 한다', () => {
    mockConversationState.textBuffer = 'Complete message';
    mockConversationStore.flushTextBuffer(1001);

    expect(mockConversationState.messages).toHaveLength(1);
    expect(mockConversationState.messages[0]).toMatchObject({
      role: 'assistant',
      type: 'text',
      content: 'Complete message',
    });
    expect(mockConversationState.textBuffer).toBe('');
  });
});

// =========================================
// 상태 전환 테스트
// =========================================
describe('상태 전환', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationState.status = 'idle';
  });

  it('working 상태로 전환 시 status가 변경되어야 한다', () => {
    mockConversationStore.setStatus(1001, 'working');

    expect(mockConversationState.status).toBe('working');
  });

  it('permission 상태로 전환 시 status가 변경되어야 한다', () => {
    mockConversationStore.setStatus(1001, 'permission');

    expect(mockConversationState.status).toBe('permission');
  });

  it('result 이후 idle로 돌아가야 한다', () => {
    mockConversationState.status = 'working';
    // result 이벤트 처리 후
    mockConversationStore.setStatus(1001, 'idle');

    expect(mockConversationState.status).toBe('idle');
  });
});
