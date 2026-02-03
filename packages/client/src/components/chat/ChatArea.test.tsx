/**
 * @file ChatArea.test.tsx
 * @description ChatArea 컴포넌트 동작 테스트
 *
 * 테스트 범위:
 * - 메시지 전송 플로우 (optimistic update + Relay 전송)
 * - 중지 기능
 * - 상태에 따른 UI 표시
 * - RequestBar 표시 조건
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { View, Text, Pressable } from 'react-native';
import { render, fireEvent, screen } from '../../test/jestTestUtils';
import { ChatArea } from './ChatArea';
import {
  createMockClaudeStore,
  createMockWorkspaceStore,
  createMockSelectedConversation,
} from '../../test/jestTestUtils';

// Mock relaySender
const mockSendClaudeMessage = jest.fn();
const mockSendClaudeControl = jest.fn();

jest.mock('../../services/relaySender', () => ({
  sendClaudeMessage: (...args: unknown[]) => mockSendClaudeMessage(...args),
  sendClaudeControl: (...args: unknown[]) => mockSendClaudeControl(...args),
}));

// Store mocks
let mockClaudeStore: ReturnType<typeof createMockClaudeStore>;
let mockWorkspaceStore: ReturnType<typeof createMockWorkspaceStore>;

jest.mock('../../stores', () => ({
  useClaudeStore: Object.assign(
    (selector?: (state: unknown) => unknown) =>
      selector ? selector(mockClaudeStore) : mockClaudeStore,
    { getState: () => mockClaudeStore }
  ),
  useWorkspaceStore: Object.assign(
    (selector?: (state: unknown) => unknown) =>
      selector ? selector(mockWorkspaceStore) : mockWorkspaceStore,
    { getState: () => mockWorkspaceStore }
  ),
}));

// Mock child components for isolation
const MockView = require('react-native').View;
const MockText = require('react-native').Text;
const MockPressable = require('react-native').Pressable;

jest.mock('./MessageList', () => ({
  MessageList: () => <MockView testID="message-list"><MockText>MessageList</MockText></MockView>,
}));

jest.mock('./ChatHeader', () => ({
  ChatHeader: ({ showSessionMenu }: { showSessionMenu?: boolean }) => (
    <MockView testID="chat-header"><MockText>ChatHeader {showSessionMenu && '(with menu)'}</MockText></MockView>
  ),
}));

jest.mock('../requests/RequestBar', () => ({
  RequestBar: () => <MockView testID="request-bar"><MockText>RequestBar</MockText></MockView>,
}));

jest.mock('./InputBar', () => ({
  InputBar: ({
    disabled,
    onSend,
    onStop,
  }: {
    disabled?: boolean;
    onSend?: (text: string, attachments?: unknown[]) => void;
    onStop?: () => void;
  }) => (
    <MockView testID="input-bar">
      <MockPressable
        testID="send-button"
        disabled={disabled}
        onPress={() => onSend?.('Test message')}
      >
        <MockText>전송</MockText>
      </MockPressable>
      <MockPressable testID="stop-button" onPress={() => onStop?.()}>
        <MockText>Stop</MockText>
      </MockPressable>
      <MockText testID="disabled-state">{disabled ? 'disabled' : 'enabled'}</MockText>
    </MockView>
  ),
}));

jest.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: true, isMobile: false }),
}));

// imageUploadStore mock
jest.mock('../../stores/imageUploadStore', () => ({
  useImageUploadStore: () => ({
    attachedImage: null,
    hasActiveUpload: false,
    setAttachedImage: jest.fn(),
  }),
}));

describe('ChatArea', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClaudeStore = createMockClaudeStore();
    mockWorkspaceStore = createMockWorkspaceStore({
      selectedConversation: createMockSelectedConversation(),
    });
  });

  describe('기본 렌더링', () => {
    it('MessageList와 InputBar가 렌더링되어야 한다', () => {
      render(<ChatArea />);

      expect(screen.getByTestId('message-list')).toBeTruthy();
      expect(screen.getByTestId('input-bar')).toBeTruthy();
    });

    it('데스크탑에서 ChatHeader가 표시되어야 한다', () => {
      render(<ChatArea />);

      expect(screen.getByTestId('chat-header')).toBeTruthy();
    });
  });

  describe('메시지 전송', () => {
    it('전송 버튼 클릭 시 메시지가 store에 추가되어야 한다', () => {
      render(<ChatArea />);

      fireEvent.press(screen.getByTestId('send-button'));

      expect(mockClaudeStore.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          type: 'text',
          content: 'Test message',
        })
      );
    });

    it('전송 버튼 클릭 시 Relay로 메시지가 전송되어야 한다', () => {
      render(<ChatArea />);

      fireEvent.press(screen.getByTestId('send-button'));

      expect(mockSendClaudeMessage).toHaveBeenCalledWith(
        'ws-1', // workspaceId
        'conv-1', // conversationId
        'Test message',
        undefined // attachments
      );
    });

    it('선택된 대화가 없으면 전송되지 않아야 한다', () => {
      mockWorkspaceStore.selectedConversation = null;

      render(<ChatArea />);

      fireEvent.press(screen.getByTestId('send-button'));

      expect(mockClaudeStore.addMessage).not.toHaveBeenCalled();
      expect(mockSendClaudeMessage).not.toHaveBeenCalled();
    });
  });

  describe('중지 기능', () => {
    it('Stop 버튼 클릭 시 control 메시지가 전송되어야 한다', () => {
      mockClaudeStore.status = 'working';

      render(<ChatArea />);

      fireEvent.press(screen.getByTestId('stop-button'));

      expect(mockSendClaudeControl).toHaveBeenCalledWith('conv-1', 'stop');
    });

    it('선택된 대화가 없으면 중지되지 않아야 한다', () => {
      mockWorkspaceStore.selectedConversation = null;

      render(<ChatArea />);

      fireEvent.press(screen.getByTestId('stop-button'));

      expect(mockSendClaudeControl).not.toHaveBeenCalled();
    });
  });

  describe('상태에 따른 InputBar 비활성화', () => {
    it('idle 상태에서 InputBar가 활성화되어야 한다', () => {
      mockClaudeStore.status = 'idle';

      render(<ChatArea />);

      expect(screen.getByTestId('disabled-state')).toHaveTextContent('enabled');
    });

    it('working 상태에서 InputBar가 비활성화되어야 한다', () => {
      mockClaudeStore.status = 'working';

      render(<ChatArea />);

      expect(screen.getByTestId('disabled-state')).toHaveTextContent('disabled');
    });

    it('권한 요청이 있으면 InputBar가 비활성화되어야 한다', () => {
      mockClaudeStore.hasPendingRequests = true;

      render(<ChatArea />);

      expect(screen.getByTestId('disabled-state')).toHaveTextContent('disabled');
    });
  });

  describe('RequestBar 표시', () => {
    it('권한 요청이 없으면 RequestBar가 표시되지 않아야 한다', () => {
      mockClaudeStore.hasPendingRequests = false;

      render(<ChatArea />);

      expect(screen.queryByTestId('request-bar')).toBeNull();
    });

    it('권한 요청이 있으면 RequestBar가 표시되어야 한다', () => {
      mockClaudeStore.hasPendingRequests = true;

      render(<ChatArea />);

      expect(screen.getByTestId('request-bar')).toBeTruthy();
    });
  });
});
