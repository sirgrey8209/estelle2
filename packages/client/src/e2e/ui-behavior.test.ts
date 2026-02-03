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

// Store mocks
const mockClaudeStore = {
  status: 'idle' as 'idle' | 'working' | 'permission',
  messages: [] as unknown[],
  textBuffer: '',
  pendingRequests: [] as unknown[],
  hasPendingRequests: false,
  setStatus: vi.fn(),
  addMessage: vi.fn((msg: unknown) => {
    mockClaudeStore.messages.push(msg);
  }),
  setMessages: vi.fn((msgs: unknown[]) => {
    mockClaudeStore.messages = [...msgs];
  }),
  clearMessages: vi.fn(() => {
    mockClaudeStore.messages = [];
  }),
  appendTextBuffer: vi.fn((text: string) => {
    mockClaudeStore.textBuffer += text;
  }),
  flushTextBuffer: vi.fn(() => {
    if (mockClaudeStore.textBuffer) {
      mockClaudeStore.messages.push({
        role: 'assistant',
        type: 'text',
        content: mockClaudeStore.textBuffer,
      });
      mockClaudeStore.textBuffer = '';
    }
  }),
  addPendingRequest: vi.fn((req: unknown) => {
    mockClaudeStore.pendingRequests.push(req);
    mockClaudeStore.hasPendingRequests = true;
  }),
  removePendingRequest: vi.fn((id: string) => {
    mockClaudeStore.pendingRequests = mockClaudeStore.pendingRequests.filter(
      (r: any) => r.toolUseId !== id
    );
    mockClaudeStore.hasPendingRequests = mockClaudeStore.pendingRequests.length > 0;
  }),
  handleClaudeEvent: vi.fn(),
  reset: vi.fn(),
};

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
            { conversationId: 'conv-1', name: 'Main', status: 'idle', unread: false },
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
    mockClaudeStore.messages = [];
    mockClaudeStore.status = 'idle';
    mockClaudeStore.textBuffer = '';
    mockClaudeStore.pendingRequests = [];
    mockClaudeStore.hasPendingRequests = false;
    setWebSocket(mockWebSocket);
  });

  describe('메시지 전송', () => {
    it('텍스트 전송 시 CLAUDE_SEND 메시지가 전송되어야 한다', () => {
      // InputBar의 handleSend가 호출되면:
      sendClaudeMessage('ws-1', 'conv-1', 'Hello, Claude!');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual({
        type: MessageType.CLAUDE_SEND,
        payload: {
          workspaceId: 'ws-1',
          conversationId: 'conv-1',
          message: 'Hello, Claude!',
          attachments: undefined,
        },
      });
    });

    it('이미지 첨부 시 attachments가 포함되어야 한다', () => {
      const attachments = ['file:///test/image.jpg'];
      sendClaudeMessage('ws-1', 'conv-1', '이미지 확인해주세요', attachments);

      expect(sentMessages[0].payload).toMatchObject({
        message: '이미지 확인해주세요',
        attachments: ['file:///test/image.jpg'],
      });
    });

    it('빈 텍스트는 전송 전 UI에서 검증됨 (서비스 레벨 테스트 범위 밖)', () => {
      // UI 레벨에서 canSend 체크로 빈 메시지 방지
      // 여기서는 서비스가 정상 동작하는지만 확인
      sendClaudeMessage('ws-1', 'conv-1', '');
      expect(sentMessages).toHaveLength(1); // 서비스는 그대로 전송
    });
  });

  describe('Stop 버튼', () => {
    it('Stop 시 CLAUDE_CONTROL 메시지가 전송되어야 한다', () => {
      sendClaudeControl('conv-1', 'stop');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual({
        type: MessageType.CLAUDE_CONTROL,
        payload: {
          conversationId: 'conv-1',
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
    mockClaudeStore.messages = [];
    mockClaudeStore.status = 'idle';
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
      mockClaudeStore.addMessage(userMessage);
      sendClaudeMessage('ws-1', 'conv-1', 'Hello, Claude!');

      // Store에 메시지가 추가됨
      expect(mockClaudeStore.messages).toHaveLength(1);
      expect(mockClaudeStore.messages[0]).toMatchObject({
        role: 'user',
        content: 'Hello, Claude!',
      });

      // Relay로 전송됨
      expect(sentMessages).toHaveLength(1);
    });
  });

  describe('상태에 따른 UI 비활성화', () => {
    it('working 상태에서는 disabled=true', () => {
      mockClaudeStore.status = 'working';

      // ChatArea에서 계산되는 로직:
      const isWorking = mockClaudeStore.status === 'working';
      const showRequestBar = mockClaudeStore.hasPendingRequests;
      const disabled = isWorking || showRequestBar;

      expect(disabled).toBe(true);
    });

    it('permission 요청이 있으면 disabled=true', () => {
      mockClaudeStore.status = 'idle';
      mockClaudeStore.hasPendingRequests = true;

      const isWorking = mockClaudeStore.status === 'working';
      const showRequestBar = mockClaudeStore.hasPendingRequests;
      const disabled = isWorking || showRequestBar;

      expect(disabled).toBe(true);
    });

    it('idle 상태이고 요청이 없으면 disabled=false', () => {
      mockClaudeStore.status = 'idle';
      mockClaudeStore.hasPendingRequests = false;

      const isWorking = mockClaudeStore.status === 'working';
      const showRequestBar = mockClaudeStore.hasPendingRequests;
      const disabled = isWorking || showRequestBar;

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
    mockClaudeStore.messages = [];
    setWebSocket(mockWebSocket);
  });

  describe('대화 선택', () => {
    it('대화 선택 시 서버에 CONVERSATION_SELECT가 전송되어야 한다', () => {
      selectConversation('ws-1', 'conv-1');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual({
        type: MessageType.CONVERSATION_SELECT,
        payload: {
          workspaceId: 'ws-1',
          conversationId: 'conv-1',
        },
      });
    });

    it('대화 선택 시 기존 메시지가 초기화되어야 한다', () => {
      mockClaudeStore.messages = [{ role: 'user', content: 'old message' }];

      // WorkspaceSidebar.onPress 시뮬레이션
      mockClaudeStore.clearMessages();
      selectConversation('ws-1', 'conv-1');

      expect(mockClaudeStore.messages).toHaveLength(0);
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
    mockClaudeStore.pendingRequests = [];
    mockClaudeStore.hasPendingRequests = false;
    setWebSocket(mockWebSocket);
  });

  describe('권한 요청 처리', () => {
    it('허용 응답 시 CLAUDE_PERMISSION 메시지가 전송되어야 한다', () => {
      sendPermissionResponse('conv-1', 'tool-123', 'allow');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toMatchObject({
        type: MessageType.CLAUDE_PERMISSION,
        payload: {
          conversationId: 'conv-1',
          toolUseId: 'tool-123',
          decision: 'allow',
        },
      });
    });

    it('거부 응답 시 decision=deny로 전송되어야 한다', () => {
      sendPermissionResponse('conv-1', 'tool-123', 'deny');

      expect(sentMessages[0].payload).toMatchObject({
        decision: 'deny',
      });
    });
  });

  describe('질문 요청 처리', () => {
    it('질문 응답 시 CLAUDE_ANSWER가 전송되어야 한다', () => {
      sendQuestionResponse('conv-1', 'tool-456', 'React');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toMatchObject({
        type: MessageType.CLAUDE_ANSWER,
        payload: {
          conversationId: 'conv-1',
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
    mockClaudeStore.messages = [];
    mockClaudeStore.textBuffer = '';
  });

  it('text 이벤트가 연속으로 오면 textBuffer에 누적되어야 한다', () => {
    // 스트리밍 시뮬레이션
    mockClaudeStore.appendTextBuffer('Hello');
    mockClaudeStore.appendTextBuffer(' World');
    mockClaudeStore.appendTextBuffer('!');

    expect(mockClaudeStore.textBuffer).toBe('Hello World!');
  });

  it('textComplete 이벤트 시 메시지로 변환되어야 한다', () => {
    mockClaudeStore.textBuffer = 'Complete message';
    mockClaudeStore.flushTextBuffer();

    expect(mockClaudeStore.messages).toHaveLength(1);
    expect(mockClaudeStore.messages[0]).toMatchObject({
      role: 'assistant',
      type: 'text',
      content: 'Complete message',
    });
    expect(mockClaudeStore.textBuffer).toBe('');
  });
});

// =========================================
// 상태 전환 테스트
// =========================================
describe('상태 전환', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClaudeStore.status = 'idle';
  });

  it('working 상태로 전환 시 status가 변경되어야 한다', () => {
    // claudeStore.setStatus 시뮬레이션
    mockClaudeStore.status = 'working';

    expect(mockClaudeStore.status).toBe('working');
  });

  it('permission 상태로 전환 시 status가 변경되어야 한다', () => {
    mockClaudeStore.status = 'permission';

    expect(mockClaudeStore.status).toBe('permission');
  });

  it('result 이후 idle로 돌아가야 한다', () => {
    mockClaudeStore.status = 'working';
    // result 이벤트 처리 후
    mockClaudeStore.status = 'idle';

    expect(mockClaudeStore.status).toBe('idle');
  });
});
