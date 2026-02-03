/**
 * @file RequestBar.test.tsx
 * @description RequestBar 및 하위 컴포넌트 동작 테스트
 *
 * 테스트 범위:
 * - 권한 요청 표시 및 응답
 * - 질문 요청 표시 및 응답
 * - 빈 상태 처리
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, fireEvent, screen } from '../../test/jestTestUtils';
import { RequestBar } from './RequestBar';
import { PermissionRequest } from './PermissionRequest';
import { QuestionRequest } from './QuestionRequest';
import {
  createMockClaudeStore,
  createMockPermissionRequest,
  createMockQuestionRequest,
} from '../../test/jestTestUtils';

// Store mock
let mockClaudeStore: ReturnType<typeof createMockClaudeStore>;

jest.mock('../../stores', () => ({
  useClaudeStore: (selector?: (state: unknown) => unknown) =>
    selector ? selector(mockClaudeStore) : mockClaudeStore,
}));

describe('RequestBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClaudeStore = createMockClaudeStore();
  });

  describe('빈 상태', () => {
    it('요청이 없으면 아무것도 렌더링하지 않아야 한다', () => {
      mockClaudeStore.pendingRequests = [];

      const { toJSON } = render(<RequestBar />);

      expect(toJSON()).toBeNull();
    });
  });

  describe('권한 요청', () => {
    it('권한 요청이 있으면 PermissionRequest가 렌더링되어야 한다', () => {
      mockClaudeStore.pendingRequests = [createMockPermissionRequest()];

      render(<RequestBar />);

      expect(screen.getByText('권한 요청')).toBeTruthy();
    });
  });

  describe('질문 요청', () => {
    it('질문 요청이 있으면 QuestionRequest가 렌더링되어야 한다', () => {
      mockClaudeStore.pendingRequests = [createMockQuestionRequest()];

      render(<RequestBar />);

      expect(screen.getByText('질문')).toBeTruthy();
    });
  });

  describe('첫 번째 요청만 표시', () => {
    it('여러 요청이 있어도 첫 번째만 표시되어야 한다', () => {
      mockClaudeStore.pendingRequests = [
        createMockPermissionRequest({ toolUseId: 'tool-1' }),
        createMockQuestionRequest({ toolUseId: 'tool-2' }),
      ];

      render(<RequestBar />);

      // 권한 요청이 첫 번째이므로
      expect(screen.getByText('권한 요청')).toBeTruthy();
      expect(screen.queryByText('질문')).toBeNull();
    });
  });
});

describe('PermissionRequest', () => {
  const mockOnAllow = jest.fn();
  const mockOnDeny = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('기본 렌더링', () => {
    it('도구 이름이 표시되어야 한다', () => {
      const request = createMockPermissionRequest({
        toolName: 'Bash',
        toolInput: { command: 'rm -rf /' },
      });

      render(
        <PermissionRequest
          request={request}
          onAllow={mockOnAllow}
          onDeny={mockOnDeny}
        />
      );

      expect(screen.getByText('Bash')).toBeTruthy();
    });

    it('허용/거부 버튼이 표시되어야 한다', () => {
      const request = createMockPermissionRequest();

      render(
        <PermissionRequest
          request={request}
          onAllow={mockOnAllow}
          onDeny={mockOnDeny}
        />
      );

      expect(screen.getByText('허용')).toBeTruthy();
      expect(screen.getByText('거부')).toBeTruthy();
    });
  });

  describe('버튼 동작', () => {
    it('허용 버튼 클릭 시 onAllow가 호출되어야 한다', () => {
      const request = createMockPermissionRequest();

      render(
        <PermissionRequest
          request={request}
          onAllow={mockOnAllow}
          onDeny={mockOnDeny}
        />
      );

      fireEvent.press(screen.getByText('허용'));

      expect(mockOnAllow).toHaveBeenCalled();
    });

    it('거부 버튼 클릭 시 onDeny가 호출되어야 한다', () => {
      const request = createMockPermissionRequest();

      render(
        <PermissionRequest
          request={request}
          onAllow={mockOnAllow}
          onDeny={mockOnDeny}
        />
      );

      fireEvent.press(screen.getByText('거부'));

      expect(mockOnDeny).toHaveBeenCalled();
    });
  });

  describe('상세 정보 토글', () => {
    it('자세히 보기 클릭 시 toolInput이 표시되어야 한다', () => {
      const request = createMockPermissionRequest({
        toolInput: { command: 'ls -la' },
      });

      render(
        <PermissionRequest
          request={request}
          onAllow={mockOnAllow}
          onDeny={mockOnDeny}
        />
      );

      // 초기에는 toolInput이 보이지 않음
      expect(screen.queryByText(/ls -la/)).toBeNull();

      // 자세히 보기 클릭
      fireEvent.press(screen.getByText('자세히 보기 ▼'));

      // toolInput이 JSON 형태로 표시됨
      expect(screen.getByText(/ls -la/)).toBeTruthy();
    });

    it('접기 클릭 시 toolInput이 숨겨져야 한다', () => {
      const request = createMockPermissionRequest({
        toolInput: { command: 'ls -la' },
      });

      render(
        <PermissionRequest
          request={request}
          onAllow={mockOnAllow}
          onDeny={mockOnDeny}
        />
      );

      // 펼치기
      fireEvent.press(screen.getByText('자세히 보기 ▼'));
      expect(screen.getByText(/ls -la/)).toBeTruthy();

      // 접기
      fireEvent.press(screen.getByText('접기 ▲'));
      expect(screen.queryByText(/ls -la/)).toBeNull();
    });
  });
});

describe('QuestionRequest', () => {
  const mockOnAnswer = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('기본 렌더링', () => {
    it('질문 내용이 표시되어야 한다', () => {
      const request = createMockQuestionRequest({
        question: '어떤 프레임워크를 사용할까요?',
      });

      render(<QuestionRequest request={request} onAnswer={mockOnAnswer} />);

      expect(screen.getByText('어떤 프레임워크를 사용할까요?')).toBeTruthy();
    });

    it('선택지가 표시되어야 한다', () => {
      const request = createMockQuestionRequest({
        options: ['React', 'Vue', 'Angular'],
      });

      render(<QuestionRequest request={request} onAnswer={mockOnAnswer} />);

      expect(screen.getByText('React')).toBeTruthy();
      expect(screen.getByText('Vue')).toBeTruthy();
      expect(screen.getByText('Angular')).toBeTruthy();
    });

    it('직접 입력 필드가 표시되어야 한다', () => {
      const request = createMockQuestionRequest();

      render(<QuestionRequest request={request} onAnswer={mockOnAnswer} />);

      expect(screen.getByPlaceholderText('직접 입력...')).toBeTruthy();
    });
  });

  describe('선택지 응답', () => {
    it('선택지 클릭 시 해당 옵션이 전송되어야 한다', () => {
      const request = createMockQuestionRequest({
        options: ['React', 'Vue', 'Angular'],
      });

      render(<QuestionRequest request={request} onAnswer={mockOnAnswer} />);

      fireEvent.press(screen.getByText('Vue'));

      expect(mockOnAnswer).toHaveBeenCalledWith('Vue');
    });
  });

  describe('직접 입력 응답', () => {
    it('직접 입력 후 전송 시 입력 내용이 전송되어야 한다', () => {
      const request = createMockQuestionRequest();

      render(<QuestionRequest request={request} onAnswer={mockOnAnswer} />);

      const input = screen.getByPlaceholderText('직접 입력...');
      fireEvent.changeText(input, 'Svelte');
      fireEvent.press(screen.getByText('전송'));

      expect(mockOnAnswer).toHaveBeenCalledWith('Svelte');
    });

    it('빈 입력은 전송되지 않아야 한다', () => {
      const request = createMockQuestionRequest();

      render(<QuestionRequest request={request} onAnswer={mockOnAnswer} />);

      fireEvent.press(screen.getByText('전송'));

      expect(mockOnAnswer).not.toHaveBeenCalled();
    });

    it('공백만 있는 입력은 전송되지 않아야 한다', () => {
      const request = createMockQuestionRequest();

      render(<QuestionRequest request={request} onAnswer={mockOnAnswer} />);

      const input = screen.getByPlaceholderText('직접 입력...');
      fireEvent.changeText(input, '   ');
      fireEvent.press(screen.getByText('전송'));

      expect(mockOnAnswer).not.toHaveBeenCalled();
    });

    it('전송 후 입력 필드가 비워져야 한다', () => {
      const request = createMockQuestionRequest();

      render(<QuestionRequest request={request} onAnswer={mockOnAnswer} />);

      const input = screen.getByPlaceholderText('직접 입력...');
      fireEvent.changeText(input, 'Custom answer');
      fireEvent.press(screen.getByText('전송'));

      expect(input.props.value).toBe('');
    });
  });

  describe('선택지가 없는 경우', () => {
    it('선택지가 없으면 직접 입력만 표시되어야 한다', () => {
      const request = createMockQuestionRequest({
        options: [],
        question: '추가 의견이 있으신가요?',
      });

      render(<QuestionRequest request={request} onAnswer={mockOnAnswer} />);

      expect(screen.getByText('추가 의견이 있으신가요?')).toBeTruthy();
      expect(screen.getByPlaceholderText('직접 입력...')).toBeTruthy();
    });
  });
});
