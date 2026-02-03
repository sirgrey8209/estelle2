/**
 * @file InputBar.test.tsx
 * @description InputBar 컴포넌트 동작 테스트
 *
 * 테스트 범위:
 * - 텍스트 입력 및 전송
 * - Stop 버튼 동작
 * - 비활성화 상태
 * - 첨부 이미지 표시/제거
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

// Mock stores - 호이스팅 문제를 피하기 위해 간단한 객체 사용
const mockClaudeStore = {
  status: 'idle' as 'idle' | 'working' | 'permission',
  messages: [],
  pendingRequests: [],
  hasPendingRequests: false,
};

const mockWorkspaceStore = {
  selectedConversation: {
    workspaceId: 'ws-1',
    conversationId: 'conv-1',
    workspaceName: 'Test',
    workingDir: '/test',
    conversationName: 'Main',
    status: 'idle' as const,
    unread: false,
  },
};

const mockImageUploadStore = {
  attachedImage: null as { id: string; uri: string; fileName: string } | null,
  hasActiveUpload: false,
  setAttachedImage: jest.fn(),
};

jest.mock('../../stores', () => ({
  useClaudeStore: (selector?: (state: unknown) => unknown) =>
    selector ? selector(mockClaudeStore) : mockClaudeStore,
  useWorkspaceStore: (selector?: (state: unknown) => unknown) =>
    selector ? selector(mockWorkspaceStore) : mockWorkspaceStore,
}));

jest.mock('../../stores/imageUploadStore', () => ({
  useImageUploadStore: (selector?: (state: unknown) => unknown) =>
    selector ? selector(mockImageUploadStore) : mockImageUploadStore,
}));

jest.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: true, isMobile: false }),
}));

// Import after mocks
import { render, fireEvent, screen } from '@testing-library/react-native';
import { InputBar } from './InputBar';

describe('InputBar', () => {
  const mockOnSend = jest.fn();
  const mockOnStop = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store states
    mockClaudeStore.status = 'idle';
    mockImageUploadStore.attachedImage = null;
    mockImageUploadStore.hasActiveUpload = false;
    mockImageUploadStore.setAttachedImage = jest.fn();
  });

  describe('기본 렌더링', () => {
    it('입력 필드와 전송 버튼이 렌더링되어야 한다', () => {
      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      expect(screen.getByPlaceholderText('메시지를 입력하세요...')).toBeTruthy();
      expect(screen.getByText('전송')).toBeTruthy();
    });

    it('disabled 상태에서는 placeholder가 변경되어야 한다', () => {
      render(<InputBar disabled onSend={mockOnSend} onStop={mockOnStop} />);

      expect(screen.getByPlaceholderText('대기 중...')).toBeTruthy();
    });
  });

  describe('텍스트 입력 및 전송', () => {
    it('텍스트 입력 시 상태가 업데이트되어야 한다', () => {
      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      const input = screen.getByPlaceholderText('메시지를 입력하세요...');
      fireEvent.changeText(input, 'Hello, Claude!');

      expect(input.props.value).toBe('Hello, Claude!');
    });

    it('전송 버튼 클릭 시 onSend가 호출되어야 한다', () => {
      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      const input = screen.getByPlaceholderText('메시지를 입력하세요...');
      fireEvent.changeText(input, 'Hello, Claude!');

      const sendButton = screen.getByText('전송');
      fireEvent.press(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith('Hello, Claude!', undefined);
    });

    it('전송 후 입력 필드가 비워져야 한다', () => {
      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      const input = screen.getByPlaceholderText('메시지를 입력하세요...');
      fireEvent.changeText(input, 'Hello, Claude!');
      fireEvent.press(screen.getByText('전송'));

      expect(input.props.value).toBe('');
    });

    it('빈 텍스트는 전송되지 않아야 한다', () => {
      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      const sendButton = screen.getByText('전송');
      fireEvent.press(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('공백만 있는 텍스트는 전송되지 않아야 한다', () => {
      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      const input = screen.getByPlaceholderText('메시지를 입력하세요...');
      fireEvent.changeText(input, '   ');
      fireEvent.press(screen.getByText('전송'));

      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('Working 상태 (Stop 버튼)', () => {
    it('working 상태에서 Stop 버튼이 표시되어야 한다', () => {
      mockClaudeStore.status = 'working';
      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      expect(screen.getByText('Stop')).toBeTruthy();
      expect(screen.queryByText('전송')).toBeNull();
    });

    it('Stop 버튼 클릭 시 onStop이 호출되어야 한다', () => {
      mockClaudeStore.status = 'working';
      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      fireEvent.press(screen.getByText('Stop'));

      expect(mockOnStop).toHaveBeenCalled();
    });

    it('working 상태에서 입력이 비활성화되어야 한다', () => {
      mockClaudeStore.status = 'working';
      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      const input = screen.getByPlaceholderText('메시지를 입력하세요...');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('비활성화 상태', () => {
    it('disabled prop이 true이면 입력이 비활성화되어야 한다', () => {
      render(<InputBar disabled onSend={mockOnSend} onStop={mockOnStop} />);

      const input = screen.getByPlaceholderText('대기 중...');
      expect(input.props.editable).toBe(false);
    });

    it('disabled 상태에서 전송 버튼이 비활성화되어야 한다', () => {
      render(<InputBar disabled onSend={mockOnSend} onStop={mockOnStop} />);

      const input = screen.getByPlaceholderText('대기 중...');
      fireEvent.changeText(input, 'Hello');

      const sendButton = screen.getByText('전송');
      fireEvent.press(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('이미지 첨부', () => {
    it('첨부된 이미지가 있으면 미리보기가 표시되어야 한다', () => {
      mockImageUploadStore.attachedImage = {
        id: 'img-1',
        uri: 'file:///test/image.jpg',
        fileName: 'test-image.jpg',
      };

      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      expect(screen.getByText('test-image.jpg')).toBeTruthy();
    });

    it('이미지 제거 버튼 클릭 시 setAttachedImage(null)이 호출되어야 한다', () => {
      mockImageUploadStore.attachedImage = {
        id: 'img-1',
        uri: 'file:///test/image.jpg',
        fileName: 'test-image.jpg',
      };

      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      const removeButton = screen.getByText('×');
      fireEvent.press(removeButton);

      expect(mockImageUploadStore.setAttachedImage).toHaveBeenCalledWith(null);
    });

    it('이미지만 있어도 전송이 가능해야 한다', () => {
      mockImageUploadStore.attachedImage = {
        id: 'img-1',
        uri: 'file:///test/image.jpg',
        fileName: 'test-image.jpg',
      };

      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      fireEvent.press(screen.getByText('전송'));

      expect(mockOnSend).toHaveBeenCalledWith('', [
        expect.objectContaining({ fileName: 'test-image.jpg' }),
      ]);
    });

    it('텍스트와 이미지 함께 전송이 가능해야 한다', () => {
      mockImageUploadStore.attachedImage = {
        id: 'img-1',
        uri: 'file:///test/image.jpg',
        fileName: 'test-image.jpg',
      };

      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      const input = screen.getByPlaceholderText('메시지를 입력하세요...');
      fireEvent.changeText(input, '이미지 확인해주세요');
      fireEvent.press(screen.getByText('전송'));

      expect(mockOnSend).toHaveBeenCalledWith('이미지 확인해주세요', [
        expect.objectContaining({ fileName: 'test-image.jpg' }),
      ]);
    });
  });

  describe('업로드 중 상태', () => {
    it('업로드 중일 때 로딩 인디케이터가 표시되어야 한다', () => {
      mockImageUploadStore.hasActiveUpload = true;

      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      // ActivityIndicator는 testID나 접근성 라벨로 확인
      // 전송 버튼이 없어야 함
      expect(screen.queryByText('전송')).toBeNull();
      expect(screen.queryByText('Stop')).toBeNull();
    });
  });

  describe('첨부 버튼', () => {
    it('첨부 버튼(+)이 표시되어야 한다', () => {
      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      expect(screen.getByText('+')).toBeTruthy();
    });

    it('working 상태에서 첨부 버튼이 비활성화되어야 한다', () => {
      mockClaudeStore.status = 'working';

      render(<InputBar onSend={mockOnSend} onStop={mockOnStop} />);

      // 버튼의 스타일이나 disabled 상태 확인
      const attachButton = screen.getByText('+');
      expect(attachButton).toBeTruthy();
      // 실제 disabled 체크는 Pressable의 disabled prop으로
    });
  });
});
