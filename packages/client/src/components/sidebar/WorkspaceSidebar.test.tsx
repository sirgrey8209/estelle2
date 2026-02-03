/**
 * @file WorkspaceSidebar.test.tsx
 * @description WorkspaceSidebar 컴포넌트 동작 테스트
 *
 * 테스트 범위:
 * - 워크스페이스/대화 목록 렌더링
 * - 대화 선택 동작
 * - 빈 상태 표시
 * - 새 워크스페이스 다이얼로그
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, fireEvent, screen } from '../../test/jestTestUtils';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import {
  createMockWorkspaceStore,
  createMockClaudeStore,
  createMockWorkspace,
  createMockPylon,
  createMockSelectedConversation,
} from '../../test/jestTestUtils';

// Mock relaySender
const mockSelectConversation = jest.fn();

jest.mock('../../services/relaySender', () => ({
  selectConversation: (...args: unknown[]) => mockSelectConversation(...args),
}));

// Store mocks
let mockWorkspaceStore: ReturnType<typeof createMockWorkspaceStore>;
let mockClaudeStore: ReturnType<typeof createMockClaudeStore>;

// Device config mock
const mockDeviceConfigStore = {
  configs: {} as Record<number, { deviceId: number; name: string; icon: string }>,
  setConfig: jest.fn(),
  getConfig: jest.fn((deviceId: number) => mockDeviceConfigStore.configs[deviceId]),
  getIcon: jest.fn((deviceId: number) => mockDeviceConfigStore.configs[deviceId]?.icon ?? '🖥️'),
  getName: jest.fn((deviceId: number) => mockDeviceConfigStore.configs[deviceId]?.name ?? `Pylon ${deviceId}`),
  removeConfig: jest.fn(),
  reset: jest.fn(),
};

jest.mock('../../stores', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (state: unknown) => unknown) =>
      selector ? selector(mockWorkspaceStore) : mockWorkspaceStore,
    { getState: () => mockWorkspaceStore }
  ),
  useDeviceConfigStore: Object.assign(
    (selector?: (state: unknown) => unknown) =>
      selector ? selector(mockDeviceConfigStore) : mockDeviceConfigStore,
    { getState: () => mockDeviceConfigStore }
  ),
}));

jest.mock('../../stores/claudeStore', () => ({
  useClaudeStore: Object.assign(
    (selector?: (state: unknown) => unknown) =>
      selector ? selector(mockClaudeStore) : mockClaudeStore,
    { getState: () => mockClaudeStore }
  ),
}));

// Mock ConversationItem for isolation
const MockView = require('react-native').View;
const MockText = require('react-native').Text;
const MockPressable = require('react-native').Pressable;

jest.mock('./ConversationItem', () => ({
  ConversationItem: ({
    workspaceName,
    conversation,
    isSelected,
    onPress,
  }: {
    workspaceName: string;
    conversation: { conversationId: string; name: string };
    isSelected: boolean;
    onPress: () => void;
  }) => (
    <MockPressable
      testID={`conversation-${conversation.conversationId}`}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
    >
      <MockText>{workspaceName} - {conversation.name}</MockText>
    </MockPressable>
  ),
}));

// Mock NewWorkspaceDialog
jest.mock('./NewWorkspaceDialog', () => ({
  NewWorkspaceDialog: ({
    visible,
    onClose,
  }: {
    visible: boolean;
    onClose: () => void;
  }) =>
    visible ? (
      <MockView testID="new-workspace-dialog">
        <MockPressable testID="close-dialog" onPress={onClose}>
          <MockText>닫기</MockText>
        </MockPressable>
      </MockView>
    ) : null,
}));

describe('WorkspaceSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkspaceStore = createMockWorkspaceStore();
    mockClaudeStore = createMockClaudeStore();
    mockDeviceConfigStore.configs = {};
  });

  describe('빈 상태', () => {
    it('연결된 Pylon이 없으면 빈 상태 메시지가 표시되어야 한다', () => {
      mockWorkspaceStore.connectedPylons = [];

      render(<WorkspaceSidebar />);

      expect(screen.getByText('연결된 워크스페이스가 없습니다')).toBeTruthy();
    });
  });

  describe('워크스페이스 목록 (2단계 구조)', () => {
    it('워크스페이스가 Pylon 아이콘과 함께 표시되어야 한다', () => {
      const pylon = createMockPylon({ deviceId: 1, deviceName: 'My PC' });
      const workspace = createMockWorkspace({
        workspaceId: 'ws-1',
        name: 'Project A',
        conversations: [
          { conversationId: 'conv-1', name: 'Main', status: 'idle', unread: false },
        ],
      });

      mockWorkspaceStore.connectedPylons = [pylon];
      mockWorkspaceStore.getAllWorkspaces = jest.fn(() => [
        { pylonId: 1, workspaces: [workspace] },
      ]);

      render(<WorkspaceSidebar />);

      // 2단계: 워크스페이스 이름이 표시됨 (Pylon 아이콘 + 이름)
      expect(screen.getByText(/Project A/)).toBeTruthy();
      expect(screen.getByTestId('conversation-conv-1')).toBeTruthy();
    });

    it('여러 Pylon의 워크스페이스가 플랫하게 표시되어야 한다', () => {
      const pylon1 = createMockPylon({ deviceId: 1, deviceName: 'PC 1' });
      const pylon2 = createMockPylon({ deviceId: 2, deviceName: 'PC 2' });
      const workspace1 = createMockWorkspace({
        workspaceId: 'ws-1',
        name: 'Project 1',
        conversations: [
          { conversationId: 'conv-1', name: 'Main', status: 'idle', unread: false },
        ],
      });
      const workspace2 = createMockWorkspace({
        workspaceId: 'ws-2',
        name: 'Project 2',
        conversations: [
          { conversationId: 'conv-2', name: 'Main', status: 'idle', unread: false },
        ],
      });

      mockWorkspaceStore.connectedPylons = [pylon1, pylon2];
      mockWorkspaceStore.getAllWorkspaces = jest.fn(() => [
        { pylonId: 1, workspaces: [workspace1] },
        { pylonId: 2, workspaces: [workspace2] },
      ]);

      render(<WorkspaceSidebar />);

      // 2단계: Pylon별 섹션 대신 워크스페이스가 플랫하게 표시
      expect(screen.getByText(/Project 1/)).toBeTruthy();
      expect(screen.getByText(/Project 2/)).toBeTruthy();
    });

    it('설정된 Pylon 아이콘이 워크스페이스 앞에 표시되어야 한다', () => {
      const pylon = createMockPylon({ deviceId: 1, deviceName: 'My PC' });
      const workspace = createMockWorkspace({
        workspaceId: 'ws-1',
        name: 'Project A',
        conversations: [
          { conversationId: 'conv-1', name: 'Main', status: 'idle', unread: false },
        ],
      });

      // Device 1에 커스텀 아이콘 설정
      mockDeviceConfigStore.configs[1] = { deviceId: 1, name: 'Home PC', icon: '🏠' };

      mockWorkspaceStore.connectedPylons = [pylon];
      mockWorkspaceStore.getAllWorkspaces = jest.fn(() => [
        { pylonId: 1, workspaces: [workspace] },
      ]);

      render(<WorkspaceSidebar />);

      // 커스텀 아이콘이 표시됨
      expect(screen.getByText(/🏠 Project A/)).toBeTruthy();
    });

    it('워크스페이스에 여러 대화가 있으면 모두 표시되어야 한다', () => {
      const pylon = createMockPylon({ deviceId: 1, deviceName: 'My PC' });
      const workspace = createMockWorkspace({
        workspaceId: 'ws-1',
        name: 'Multi-Conv Project',
        conversations: [
          { conversationId: 'conv-1', name: 'Main', status: 'idle', unread: false },
          { conversationId: 'conv-2', name: 'Dev', status: 'idle', unread: false },
        ],
      });

      mockWorkspaceStore.connectedPylons = [pylon];
      mockWorkspaceStore.getAllWorkspaces = jest.fn(() => [
        { pylonId: 1, workspaces: [workspace] },
      ]);

      render(<WorkspaceSidebar />);

      expect(screen.getByText(/Multi-Conv Project/)).toBeTruthy();
      expect(screen.getByTestId('conversation-conv-1')).toBeTruthy();
      expect(screen.getByTestId('conversation-conv-2')).toBeTruthy();
    });
  });

  describe('대화 선택', () => {
    it('대화 클릭 시 store에 선택 상태가 업데이트되어야 한다', () => {
      const pylon = createMockPylon({ deviceId: 1, deviceName: 'My PC' });
      const workspace = createMockWorkspace({
        workspaceId: 'ws-1',
        conversations: [
          { conversationId: 'conv-1', name: 'Main', status: 'idle', unread: false },
        ],
      });

      mockWorkspaceStore.connectedPylons = [pylon];
      mockWorkspaceStore.getAllWorkspaces = jest.fn(() => [
        { pylonId: 1, workspaces: [workspace] },
      ]);

      render(<WorkspaceSidebar />);

      fireEvent.press(screen.getByTestId('conversation-conv-1'));

      expect(mockWorkspaceStore.selectConversation).toHaveBeenCalledWith(1, 'ws-1', 'conv-1');
    });

    it('대화 클릭 시 서버에 선택 알림이 전송되어야 한다', () => {
      const pylon = createMockPylon({ deviceId: 1, deviceName: 'My PC' });
      const workspace = createMockWorkspace({
        workspaceId: 'ws-1',
        conversations: [
          { conversationId: 'conv-1', name: 'Main', status: 'idle', unread: false },
        ],
      });

      mockWorkspaceStore.connectedPylons = [pylon];
      mockWorkspaceStore.getAllWorkspaces = jest.fn(() => [
        { pylonId: 1, workspaces: [workspace] },
      ]);

      render(<WorkspaceSidebar />);

      fireEvent.press(screen.getByTestId('conversation-conv-1'));

      expect(mockSelectConversation).toHaveBeenCalledWith('ws-1', 'conv-1');
    });

    it('대화 클릭 시 기존 메시지가 초기화되어야 한다', () => {
      const pylon = createMockPylon({ deviceId: 1, deviceName: 'My PC' });
      const workspace = createMockWorkspace({
        workspaceId: 'ws-1',
        conversations: [
          { conversationId: 'conv-1', name: 'Main', status: 'idle', unread: false },
        ],
      });

      mockWorkspaceStore.connectedPylons = [pylon];
      mockWorkspaceStore.getAllWorkspaces = jest.fn(() => [
        { pylonId: 1, workspaces: [workspace] },
      ]);

      render(<WorkspaceSidebar />);

      fireEvent.press(screen.getByTestId('conversation-conv-1'));

      expect(mockClaudeStore.clearMessages).toHaveBeenCalled();
    });

    it('선택된 대화가 하이라이트되어야 한다', () => {
      const pylon = createMockPylon({ deviceId: 1, deviceName: 'My PC' });
      const workspace = createMockWorkspace({
        workspaceId: 'ws-1',
        conversations: [
          { conversationId: 'conv-1', name: 'Main', status: 'idle', unread: false },
          { conversationId: 'conv-2', name: 'Dev', status: 'idle', unread: false },
        ],
      });

      mockWorkspaceStore.connectedPylons = [pylon];
      mockWorkspaceStore.getAllWorkspaces = jest.fn(() => [
        { pylonId: 1, workspaces: [workspace] },
      ]);
      mockWorkspaceStore.selectedConversation = createMockSelectedConversation({
        conversationId: 'conv-1',
      });

      render(<WorkspaceSidebar />);

      const conv1 = screen.getByTestId('conversation-conv-1');
      const conv2 = screen.getByTestId('conversation-conv-2');

      // accessibilityState로 선택 상태 확인
      expect(conv1.props.accessibilityState?.selected).toBe(true);
      expect(conv2.props.accessibilityState?.selected).toBe(false);
    });
  });

  describe('새 워크스페이스 다이얼로그', () => {
    it('워크스페이스 추가 FAB이 표시되어야 한다', () => {
      render(<WorkspaceSidebar />);

      expect(screen.getByText('워크스페이스')).toBeTruthy();
    });

    it('FAB 클릭 시 다이얼로그가 열려야 한다', () => {
      render(<WorkspaceSidebar />);

      expect(screen.queryByTestId('new-workspace-dialog')).toBeNull();

      fireEvent.press(screen.getByText('워크스페이스'));

      expect(screen.getByTestId('new-workspace-dialog')).toBeTruthy();
    });

    it('다이얼로그 닫기 시 사라져야 한다', () => {
      render(<WorkspaceSidebar />);

      fireEvent.press(screen.getByText('워크스페이스'));
      expect(screen.getByTestId('new-workspace-dialog')).toBeTruthy();

      fireEvent.press(screen.getByTestId('close-dialog'));
      expect(screen.queryByTestId('new-workspace-dialog')).toBeNull();
    });
  });
});
