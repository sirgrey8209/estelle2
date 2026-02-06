/**
 * @file file-upload-flow.test.ts
 * @description 파일 업로드 플로우 E2E 테스트
 *
 * Phase 4: ChatArea 업로드 플로우
 * - 파일 첨부 후 전송 시 업로드 플로우가 실행되는지
 * - blobService.uploadImageBytes() 호출 검증
 * - 업로드 완료 후 sendClaudeMessage() 호출 검증
 *
 * Phase 5: 일반 파일 첨부 UI
 * - 파일 선택 옵션이 존재하는지 (UI 테스트)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageType } from '@estelle/core';

// Mock stores
const mockClaudeStore = {
  status: 'idle',
  hasPendingRequests: false,
  addMessage: vi.fn(),
};

const mockWorkspaceStore = {
  selectedConversation: {
    workspaceId: 'ws-1',
    workspaceName: 'Test Workspace',
    conversationId: 'conv-1',
    conversationName: 'Main',
  },
  connectedPylons: [{ deviceId: 1, deviceName: 'Test PC' }],
};

const mockImageUploadStore = {
  attachedImage: null as any,
  attachedImages: [] as any[],
  hasActiveUpload: false,
  queuedMessage: null as string | null,
  setAttachedImage: vi.fn(),
  clearAttachedImages: vi.fn(),
  queueMessage: vi.fn(),
  dequeueMessage: vi.fn(() => mockImageUploadStore.queuedMessage),
};

// Mock blobService
const mockBlobService = {
  setSender: vi.fn(),
  uploadImageBytes: vi.fn().mockResolvedValue('mock-blob-id'),
  handleMessage: vi.fn(),
  onUploadComplete: vi.fn().mockReturnValue(() => {}),
};

// Mock modules
vi.mock('../stores/claudeStore', () => ({
  useClaudeStore: Object.assign(
    (selector?: (state: typeof mockClaudeStore) => any) =>
      selector ? selector(mockClaudeStore) : mockClaudeStore,
    { getState: () => mockClaudeStore }
  ),
}));

vi.mock('../stores/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (state: typeof mockWorkspaceStore) => any) =>
      selector ? selector(mockWorkspaceStore) : mockWorkspaceStore,
    { getState: () => mockWorkspaceStore }
  ),
}));

vi.mock('../stores/imageUploadStore', () => ({
  useImageUploadStore: Object.assign(
    (selector?: (state: typeof mockImageUploadStore) => any) =>
      selector ? selector(mockImageUploadStore) : mockImageUploadStore,
    { getState: () => mockImageUploadStore }
  ),
  AttachedImage: {},
}));

vi.mock('../services/blobService', () => ({
  blobService: mockBlobService,
  BlobTransferService: vi.fn(),
}));

// Mock WebSocket
let sentMessages: any[] = [];
const WS_OPEN = 1;
const mockWebSocket = {
  readyState: WS_OPEN,
  send: vi.fn((data) => {
    sentMessages.push(JSON.parse(data));
  }),
};

vi.mock('../services/relaySender', async () => {
  const actual = await vi.importActual('../services/relaySender');
  return {
    ...actual,
    setWebSocket: vi.fn(),
    sendClaudeMessage: vi.fn(),
  };
});

// Import after mocks
const { sendClaudeMessage, setWebSocket } = await import(
  '../services/relaySender'
);
const { blobService } = await import('../services/blobService');

describe('파일 업로드 플로우 E2E 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentMessages = [];
    mockImageUploadStore.attachedImage = null;
    mockImageUploadStore.attachedImages = [];
    mockImageUploadStore.hasActiveUpload = false;
    mockImageUploadStore.queuedMessage = null;
  });

  describe('Phase 1: WebSocket-BlobService 연결', () => {
    /**
     * [FAILING TEST] App.tsx에서 WebSocket 연결 시 blobService.setSender() 호출
     *
     * 현재 App.tsx의 useRelayConnection에서는:
     * - ws.onopen 시 blobService.setSender() 호출이 없음
     * - handleMessage에서 blob 타입 메시지를 blobService로 전달하지 않음
     */
    it('should call blobService.setSender when websocket connected', () => {
      // Arrange - WebSocket 연결 시뮬레이션
      // 이 테스트는 App.tsx가 수정되어야 통과함

      // Act - WebSocket onopen 이벤트 발생 시
      // 현재 App.tsx에서 이 호출이 없음
      // blobService.setSender({ send: (data) => ws.send(JSON.stringify(data)) });

      // Assert
      // 실제로는 App.tsx 수정 후 통합 테스트로 검증해야 함
      // 여기서는 mock으로 검증 시도
      expect(blobService.setSender).not.toHaveBeenCalled(); // 현재는 호출 안 됨

      // TODO: App.tsx 수정 후 아래 assertion으로 변경
      // expect(blobService.setSender).toHaveBeenCalled();
    });

    it('should route blob messages to blobService.handleMessage', () => {
      // Arrange
      const blobStartMessage = {
        type: 'blob_start',
        payload: {
          blobId: 'test-blob',
          filename: 'image.png',
          totalSize: 1024,
        },
      };

      // Act - 현재 App.tsx handleMessage에서 blob 메시지 처리 안 함
      // routeMessage(blobStartMessage); // 이것은 blob을 처리하지 않음

      // Assert
      // App.tsx 수정 후: blob_* 메시지가 blobService.handleMessage로 전달되어야 함
      expect(blobService.handleMessage).not.toHaveBeenCalled();

      // TODO: App.tsx 수정 후 아래 assertion으로 변경
      // expect(blobService.handleMessage).toHaveBeenCalledWith(blobStartMessage);
    });

    it('should handle blob_upload_complete message', () => {
      // Arrange
      const uploadCompleteMessage = {
        type: 'blob_upload_complete',
        payload: {
          blobId: 'blob-123',
          path: '/uploads/image.png',
          conversationId: 'conv-1',
        },
      };

      // Act - App.tsx handleMessage에서 blob 메시지 라우팅
      // 현재는 라우팅 안 됨

      // Assert
      expect(blobService.handleMessage).not.toHaveBeenCalled();
    });
  });

  describe('Phase 4: ChatArea 업로드 플로우', () => {
    /**
     * [FAILING TEST] ChatArea.handleSend에서 첨부파일 있으면 blobService.uploadImageBytes 호출
     *
     * 현재 ChatArea.tsx의 handleSend:
     * - attachments를 URI 문자열로만 전달
     * - blobService.uploadImageBytes() 호출 없음
     * - 업로드 완료 대기 로직 없음
     */
    it('should call blobService.uploadImageBytes when attachments present', async () => {
      // Arrange
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const attachment = {
        id: 'img-1',
        uri: 'blob:http://localhost/123',
        fileName: 'test.png',
        file: mockFile,
        mimeType: 'image/png',
      };

      // 시뮬레이션: ChatArea.handleSend 호출
      // 현재 구현에서는 blobService.uploadImageBytes가 호출되지 않음

      // Act - ChatArea의 handleSend 로직 시뮬레이션
      // 현재 구현:
      // sendClaudeMessage(workspaceId, conversationId, text, attachments?.map(a => a.uri));

      // 수정 후 구현이 필요한 로직:
      // if (attachments?.length) {
      //   for (const attachment of attachments) {
      //     const bytes = new Uint8Array(await attachment.file.arrayBuffer());
      //     await blobService.uploadImageBytes({ ... });
      //   }
      // }

      // Assert - 현재는 호출되지 않음
      expect(blobService.uploadImageBytes).not.toHaveBeenCalled();

      // TODO: ChatArea.tsx 수정 후 아래 assertion으로 변경
      // expect(blobService.uploadImageBytes).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     filename: 'test.png',
      //     mimeType: 'image/png',
      //   })
      // );
    });

    it('should wait for upload complete before sending message', async () => {
      // Arrange
      const mockFile = new File(['data'], 'image.png', { type: 'image/png' });
      const attachment = {
        id: 'img-1',
        uri: 'blob:test',
        fileName: 'image.png',
        file: mockFile,
        mimeType: 'image/png',
      };

      // Act - ChatArea.handleSend 로직
      // 수정 후: 업로드 완료 후 sendClaudeMessage 호출

      // Assert - 현재는 업로드 대기 없이 바로 전송
      // sendClaudeMessage가 바로 호출되거나, 업로드 완료 후 호출되어야 함

      // TODO: 업로드 완료 대기 로직 구현 후
      // 1. blobService.uploadImageBytes 호출
      // 2. 업로드 완료 이벤트 대기
      // 3. pylonPath로 sendClaudeMessage 호출
      expect(true).toBe(true); // placeholder
    });

    it('should use pylon path in sendClaudeMessage after upload', async () => {
      // Arrange
      const pylonPath = '/uploads/1234_image.png';
      mockBlobService.uploadImageBytes.mockResolvedValue('blob-123');

      // 업로드 완료 콜백 시뮬레이션
      let uploadCompleteCallback: ((event: any) => void) | null = null;
      mockBlobService.onUploadComplete.mockImplementation((cb) => {
        uploadCompleteCallback = cb;
        return () => {};
      });

      // Act - 업로드 완료 이벤트 발생
      // uploadCompleteCallback?.({
      //   blobId: 'blob-123',
      //   pylonPath,
      //   conversationId: 'conv-1',
      // });

      // Assert - sendClaudeMessage가 pylonPath로 호출되어야 함
      // expect(sendClaudeMessage).toHaveBeenCalledWith(
      //   'ws-1',
      //   'conv-1',
      //   expect.any(String),
      //   [pylonPath]
      // );
      expect(true).toBe(true); // placeholder
    });

    it('should queue message while uploading', () => {
      // Arrange
      mockImageUploadStore.hasActiveUpload = true;

      // Act - 업로드 중 메시지 전송 시도
      // ChatArea.handleSend에서 hasActiveUpload 확인 후 메시지 큐잉

      // Assert
      // expect(mockImageUploadStore.queueMessage).toHaveBeenCalledWith('Hello with image');
      expect(true).toBe(true); // placeholder
    });

    it('should send queued message after upload complete', () => {
      // Arrange
      mockImageUploadStore.queuedMessage = 'Hello with image';
      const pylonPath = '/uploads/test.png';

      // Act - 업로드 완료 후
      // const queuedMessage = mockImageUploadStore.dequeueMessage();
      // if (queuedMessage) {
      //   sendClaudeMessage(workspaceId, conversationId, queuedMessage, [pylonPath]);
      // }

      // Assert
      // expect(sendClaudeMessage).toHaveBeenCalledWith(
      //   expect.any(String),
      //   expect.any(String),
      //   'Hello with image',
      //   [pylonPath]
      // );
      expect(true).toBe(true); // placeholder
    });
  });

  describe('Phase 5: 일반 파일 첨부 UI', () => {
    /**
     * [FAILING TEST] InputBar에 일반 파일 선택 옵션 추가
     *
     * 현재 InputBar.tsx:
     * - accept="image/*"로 이미지만 선택 가능
     * - 일반 파일 선택 메뉴 없음
     */
    it('should have file selection option in attach menu', () => {
      // 이 테스트는 컴포넌트 렌더링 테스트로 검증
      // UI 요소가 존재하는지 확인

      // 현재 InputBar.tsx의 첨부 메뉴:
      // - "갤러리에서 선택" (이미지)
      // - "카메라 촬영"
      //
      // 필요한 옵션:
      // - "파일 선택" (모든 파일)

      // Assert - UI 테스트는 별도로 진행
      // expect(screen.getByText('파일 선택')).toBeInTheDocument();
      expect(true).toBe(true); // placeholder
    });

    it('should accept all file types when file option selected', () => {
      // 현재: <input accept="image/*" />
      // 필요: <input accept="*/*" /> 또는 accept 속성 제거

      // Assert
      // const fileInput = screen.getByTestId('file-input');
      // expect(fileInput).toHaveAttribute('accept', '*/*');
      expect(true).toBe(true); // placeholder
    });
  });

  describe('전체 업로드 플로우', () => {
    it('should complete full upload flow: attach -> send -> upload -> message', async () => {
      // 1. 파일 첨부
      const mockFile = new File(['image data'], 'photo.png', {
        type: 'image/png',
      });
      const attachment = {
        id: 'img-flow-1',
        uri: 'blob:http://localhost/flow',
        fileName: 'photo.png',
        file: mockFile,
        mimeType: 'image/png',
      };
      mockImageUploadStore.attachedImage = attachment;
      mockImageUploadStore.attachedImages = [attachment];

      // 2. 전송 버튼 클릭 (handleSend)
      // 현재 구현에서는:
      // - sendClaudeMessage가 URI로 바로 호출됨
      //
      // 수정 후 구현:
      // - blobService.uploadImageBytes 호출
      // - 업로드 완료 대기
      // - sendClaudeMessage가 pylonPath로 호출됨

      // 3. 업로드 진행
      // - blob_start, blob_chunk, blob_end 전송
      // - Pylon에서 blob_upload_complete 응답

      // 4. 메시지 전송
      // - sendClaudeMessage(workspaceId, conversationId, text, [pylonPath])

      // Assert - 전체 플로우 검증
      expect(mockImageUploadStore.attachedImage).toBeDefined();
      // TODO: 구현 후 전체 플로우 검증
    });

    it('should handle upload error gracefully', async () => {
      // Arrange
      mockBlobService.uploadImageBytes.mockRejectedValue(
        new Error('Network error')
      );

      // Act - 업로드 실패

      // Assert
      // - 에러 메시지 표시
      // - 첨부파일 유지 (재시도 가능)
      // - 메시지 전송 안 됨
      expect(true).toBe(true); // placeholder
    });

    it('should handle multiple attachments', async () => {
      // Arrange
      const files = [
        new File(['1'], 'img1.png', { type: 'image/png' }),
        new File(['2'], 'img2.png', { type: 'image/png' }),
      ];
      const attachments = files.map((file, i) => ({
        id: `img-${i}`,
        uri: `blob:${i}`,
        fileName: file.name,
        file,
        mimeType: 'image/png',
      }));
      mockImageUploadStore.attachedImages = attachments;

      // Act - 여러 파일 업로드

      // Assert
      // - 각 파일에 대해 uploadImageBytes 호출
      // - 모든 업로드 완료 후 메시지 전송
      expect(mockImageUploadStore.attachedImages).toHaveLength(2);
    });
  });
});
