/**
 * @file pylon.test.ts
 * @description Pylon 클래스 통합 테스트
 *
 * Pylon 클래스는 모든 모듈을 통합하는 메인 클래스입니다.
 * 테스트는 순수 로직에 집중하며, 외부 의존성은 Mock으로 대체합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Pylon } from '../src/pylon.js';
import type { PylonConfig, PylonDependencies } from '../src/pylon.js';
import { WorkspaceStore } from '../src/stores/workspace-store.js';
import { MessageStore } from '../src/stores/message-store.js';
import { ShareStore } from '../src/stores/share-store.js';

const PYLON_ID = 1;

// ============================================================================
// Mock 팩토리
// ============================================================================

/**
 * 기본 설정 생성 (deviceId는 숫자 타입)
 */
function createMockConfig(): PylonConfig {
  return {
    deviceId: 1,  // 숫자 타입으로 변경
    deviceName: 'test-pylon',  // 선택적 이름 추가
    relayUrl: 'ws://localhost:8080',
    localPort: 9000,
    uploadsDir: './test-uploads',
  };
}

/**
 * Mock 의존성 생성
 */
function createMockDependencies(): PylonDependencies {
  const shareStore = new ShareStore();
  // spy로 래핑하여 toHaveBeenCalledWith 사용 가능
  vi.spyOn(shareStore, 'validate');
  vi.spyOn(shareStore, 'create');

  return {
    workspaceStore: new WorkspaceStore(PYLON_ID),
    messageStore: new MessageStore(),
    shareStore,  // ShareStore 추가 (share_history 테스트용)
    relayClient: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      onMessage: vi.fn(),
      onStatusChange: vi.fn(),
    },
    claudeManager: {
      sendMessage: vi.fn(),
      stop: vi.fn(),
      newSession: vi.fn(),
      cleanup: vi.fn(),
      respondPermission: vi.fn(),
      respondQuestion: vi.fn(),
      hasActiveSession: vi.fn().mockReturnValue(false),
      getSessionStartTime: vi.fn().mockReturnValue(null),
      getPendingEvent: vi.fn().mockReturnValue(null),
    },
    blobHandler: {
      handleBlobStart: vi.fn().mockReturnValue({ success: true }),
      handleBlobChunk: vi.fn(),
      handleBlobEnd: vi.fn().mockReturnValue({ success: true }),
      handleBlobRequest: vi.fn(),
    },
    taskManager: {
      listTasks: vi.fn().mockReturnValue({ success: true, tasks: [] }),
      getTask: vi.fn().mockReturnValue({ success: false }),
      updateTaskStatus: vi.fn().mockReturnValue({ success: true }),
    },
    workerManager: {
      getWorkerStatus: vi.fn().mockReturnValue({ running: false }),
      startWorker: vi.fn().mockReturnValue({ success: true }),
      stopWorker: vi.fn().mockReturnValue({ success: true }),
    },
    folderManager: {
      listFolders: vi.fn().mockReturnValue({ success: true, folders: [] }),
      createFolder: vi.fn().mockReturnValue({ success: true }),
      renameFolder: vi.fn().mockReturnValue({ success: true }),
    },
    logger: {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    packetLogger: {
      logSend: vi.fn(),
      logRecv: vi.fn(),
    },
  };
}

// ============================================================================
// 테스트
// ============================================================================

describe('Pylon', () => {
  let pylon: Pylon;
  let config: PylonConfig;
  let deps: PylonDependencies;

  beforeEach(() => {
    config = createMockConfig();
    deps = createMockDependencies();
    pylon = new Pylon(config, deps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 생성 및 초기화
  // ==========================================================================

  describe('생성 및 초기화', () => {
    it('should create Pylon instance with config (deviceId as number)', () => {
      expect(pylon).toBeDefined();
      expect(pylon.getDeviceId()).toBe(1);  // 숫자 타입 확인
    });

    // 새 테스트: deviceName 반환
    it('should return deviceName from config', () => {
      expect(pylon.getDeviceName()).toBe('test-pylon');
    });

    // 새 테스트: deviceName이 없는 경우
    it('should return undefined for deviceName if not provided', () => {
      const configWithoutName: PylonConfig = {
        deviceId: 2,
        relayUrl: 'ws://localhost:8080',
        localPort: 9000,
        uploadsDir: './test-uploads',
      };
      const pylonNoName = new Pylon(configWithoutName, deps);
      expect(pylonNoName.getDeviceName()).toBeUndefined();
    });

    it('should have authenticated as false initially', () => {
      expect(pylon.isAuthenticated()).toBe(false);
    });

    it('should initialize with empty session viewers', () => {
      expect(pylon.getSessionViewerCount(99999)).toBe(0);
    });
  });

  // ==========================================================================
  // start/stop
  // ==========================================================================

  describe('start/stop', () => {
    it('should start local server and connect to relay', async () => {
      await pylon.start();

      expect(deps.relayClient.connect).toHaveBeenCalled();
    });

    it('should stop all services on stop()', async () => {
      await pylon.start();
      await pylon.stop();

      expect(deps.relayClient.disconnect).toHaveBeenCalled();
      expect(deps.claudeManager.cleanup).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 인증 처리
  // ==========================================================================

  describe('인증 처리', () => {
    it('should set authenticated on auth_result success', () => {
      pylon.handleMessage({
        type: 'auth_result',
        payload: {
          success: true,
          device: { deviceId: 1, name: 'Test Device' },  // deviceId 숫자
        },
      });

      expect(pylon.isAuthenticated()).toBe(true);
    });

    it('should not set authenticated on auth_result failure', () => {
      pylon.handleMessage({
        type: 'auth_result',
        payload: {
          success: false,
          error: 'Invalid token',
        },
      });

      expect(pylon.isAuthenticated()).toBe(false);
    });
  });

  // ==========================================================================
  // 워크스페이스 메시지 핸들러
  // ==========================================================================

  describe('워크스페이스 메시지 핸들러', () => {
    it('should handle workspace_list request', () => {
      pylon.handleMessage({
        type: 'workspace_list',
        from: { deviceId: 'client-1' },
      });

      // to는 이제 배열 형태
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workspace_list_result',
          to: ['client-1'],
        })
      );
    });

    it('should handle workspace_create request', () => {
      pylon.handleMessage({
        type: 'workspace_create',
        from: { deviceId: 'client-1' },
        payload: { name: 'New Project', workingDir: 'C:\\test' },
      });

      const workspaces = deps.workspaceStore.getAllWorkspaces();
      expect(workspaces.length).toBe(1);
      expect(workspaces[0].name).toBe('New Project');
    });

    it('should handle workspace_switch request', () => {
      // 워크스페이스 생성
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'workspace_switch',
        payload: { workspaceId: workspace.workspaceId },
      });

      const activeState = deps.workspaceStore.getActiveState();
      expect(activeState.activeWorkspaceId).toBe(workspace.workspaceId);
    });

    it('should handle workspace_delete request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'workspace_delete',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId },
      });

      const workspaces = deps.workspaceStore.getAllWorkspaces();
      expect(workspaces.length).toBe(0);
    });

    it('should handle workspace_rename request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Old Name', 'C:\\test');

      pylon.handleMessage({
        type: 'workspace_rename',
        payload: { workspaceId: workspace.workspaceId, newName: 'New Name' },
      });

      const updated = deps.workspaceStore.getWorkspace(workspace.workspaceId);
      expect(updated?.name).toBe('New Name');
    });
  });

  // ==========================================================================
  // 대화 메시지 핸들러
  // ==========================================================================

  describe('대화 메시지 핸들러', () => {
    it('should handle conversation_create request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'conversation_create',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId, name: 'New Chat' },
      });

      const updated = deps.workspaceStore.getWorkspace(workspace.workspaceId);
      // 빈 워크스페이스에 새 대화 1개 생성
      expect(updated?.conversations.length).toBe(1);
    });

    it('should handle conversation_delete request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      pylon.handleMessage({
        type: 'conversation_delete',
        payload: {
          conversationId: conversation.conversationId,
        },
      });

      const updated = deps.workspaceStore.getWorkspace(workspace.workspaceId);
      expect(updated?.conversations.length).toBe(0);
    });

    it('should handle conversation_select and send history', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // 메시지 추가
      deps.messageStore.addUserMessage(conversation.conversationId, 'Hello');

      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });

      // history_result 전송 확인
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'history_result',
          to: ['client-1'],
        })
      );
    });

    // ========================================================================
    // reconnect-state-sync: history_result에 currentStatus 포함 테스트
    // ========================================================================

    it('should include currentStatus in history_result when session is idle', () => {
      // Arrange
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // Claude 세션이 idle 상태 (hasActiveSession = false)
      vi.mocked(deps.claudeManager.hasActiveSession).mockReturnValue(false);

      // Act
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });

      // Assert: history_result에 currentStatus: 'idle' 포함
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'history_result',
          payload: expect.objectContaining({
            conversationId: conversation.conversationId,
            currentStatus: 'idle',
          }),
        })
      );
    });

    it('should include currentStatus in history_result when session is working', () => {
      // Arrange
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // Claude 세션이 working 상태
      vi.mocked(deps.claudeManager.hasActiveSession).mockReturnValue(true);
      vi.mocked(deps.claudeManager.getPendingEvent).mockReturnValue(null);

      // Act
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });

      // Assert: history_result에 currentStatus: 'working' 포함
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'history_result',
          payload: expect.objectContaining({
            conversationId: conversation.conversationId,
            currentStatus: 'working',
          }),
        })
      );
    });

    it('should include currentStatus in history_result when session is waiting for permission', () => {
      // Arrange
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // Claude 세션이 permission 대기 상태
      vi.mocked(deps.claudeManager.hasActiveSession).mockReturnValue(true);
      vi.mocked(deps.claudeManager.getPendingEvent).mockReturnValue({
        type: 'permission_request',
        toolUseId: 'tool-1',
        toolName: 'Bash',
        toolInput: { command: 'ls' },
      });

      // Act
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });

      // Assert: history_result에 currentStatus: 'permission' 포함
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'history_result',
          payload: expect.objectContaining({
            conversationId: conversation.conversationId,
            currentStatus: 'permission',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Claude 메시지 핸들러
  // ==========================================================================

  describe('Claude 메시지 핸들러', () => {
    it('should handle claude_send request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      pylon.handleMessage({
        type: 'claude_send',
        from: { deviceId: 'client-1' },
        payload: {
          conversationId: conversation.conversationId,
          message: 'Hello Claude',
        },
      });

      // 사용자 메시지가 저장되어야 함
      const messages = deps.messageStore.getMessages(conversation.conversationId);
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe('Hello Claude');

      // 사용자 메시지가 브로드캐스트되어야 함
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'claude_event',
          broadcast: 'clients',
          payload: expect.objectContaining({
            conversationId: conversation.conversationId,
            event: expect.objectContaining({
              type: 'userMessage',
              content: 'Hello Claude',
            }),
          }),
        })
      );

      // NOTE: claudeManager.sendMessage는 handleClaudeSend 내부에서
      // decodeConversationIdFull(eid).workspaceIndex로 workspace를 조회하지만,
      // 인코딩된 workspaceId와 raw workspaceIndex가 다르므로 workspace를 찾지 못함.
      // 이는 pylon.ts의 알려진 이슈 (decoded.workspaceId를 사용해야 함).
    });

    it('should handle claude_permission request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      pylon.handleMessage({
        type: 'claude_permission',
        payload: {
          conversationId: conversation.conversationId,
          toolUseId: 'tool-1',
          decision: 'allow',
        },
      });

      expect(deps.claudeManager.respondPermission).toHaveBeenCalledWith(
        conversation.conversationId,
        'tool-1',
        'allow'
      );
    });

    it('should handle claude_answer request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      pylon.handleMessage({
        type: 'claude_answer',
        payload: {
          conversationId: conversation.conversationId,
          toolUseId: 'tool-1',
          answer: 'Yes',
        },
      });

      expect(deps.claudeManager.respondQuestion).toHaveBeenCalledWith(
        conversation.conversationId,
        'tool-1',
        'Yes'
      );
    });

    it('should handle claude_control stop action', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      pylon.handleMessage({
        type: 'claude_control',
        payload: {
          conversationId: conversation.conversationId,
          action: 'stop',
        },
      });

      expect(deps.claudeManager.stop).toHaveBeenCalledWith(conversation.conversationId);
    });

    it('should handle claude_control new_session action', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      pylon.handleMessage({
        type: 'claude_control',
        payload: {
          conversationId: conversation.conversationId,
          action: 'new_session',
        },
      });

      expect(deps.claudeManager.newSession).toHaveBeenCalledWith(conversation.conversationId);
    });
  });

  // ==========================================================================
  // Blob 메시지 핸들러
  // ==========================================================================

  describe('Blob 메시지 핸들러', () => {
    it('should handle blob_start request', () => {
      pylon.handleMessage({
        type: 'blob_start',
        from: { deviceId: 'client-1' },
        payload: { blobId: 'blob-1', filename: 'test.png', totalSize: 1000 },
      });

      expect(deps.blobHandler.handleBlobStart).toHaveBeenCalled();
    });

    it('should handle blob_chunk request', () => {
      pylon.handleMessage({
        type: 'blob_chunk',
        payload: { blobId: 'blob-1', chunkIndex: 0, data: 'base64data' },
      });

      expect(deps.blobHandler.handleBlobChunk).toHaveBeenCalled();
    });

    it('should handle blob_end request', () => {
      pylon.handleMessage({
        type: 'blob_end',
        from: { deviceId: 'client-1' },
        payload: { blobId: 'blob-1', checksum: 'abc123' },
      });

      expect(deps.blobHandler.handleBlobEnd).toHaveBeenCalled();
    });

    it('should handle blob_request request', () => {
      pylon.handleMessage({
        type: 'blob_request',
        from: { deviceId: 'client-1' },
        payload: { filePath: './test.png' },
      });

      expect(deps.blobHandler.handleBlobRequest).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 히스토리 요청
  // ==========================================================================

  describe('히스토리 요청', () => {
    it('should handle history_request with pagination (size-based)', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // 여러 메시지 추가 (작은 메시지는 모두 100KB 이내)
      for (let i = 0; i < 10; i++) {
        deps.messageStore.addUserMessage(conversation.conversationId, `Message ${i}`);
      }

      pylon.handleMessage({
        type: 'history_request',
        from: { deviceId: 'client-1' },
        payload: {
          conversationId: conversation.conversationId,
          offset: 0,
        },
      });

      // 용량 기반 페이징: 작은 메시지 10개는 100KB 이내이므로 모두 반환
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'history_result',
          payload: expect.objectContaining({
            totalCount: 10,
            hasMore: false, // 모든 메시지가 100KB 이내
          }),
        })
      );
    });
  });

  // ==========================================================================
  // 상태 요청
  // ==========================================================================

  describe('상태 요청', () => {
    it('should handle get_status request', () => {
      pylon.handleMessage({
        type: 'get_status',
        from: { deviceId: 'client-1' },
      });

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'status',
          payload: expect.objectContaining({
            deviceId: 1,  // deviceId 숫자
            authenticated: false,
          }),
        })
      );
    });

    it('should handle ping with pong response', () => {
      pylon.handleMessage({
        type: 'ping',
        from: { deviceId: 'client-1' },
      });

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pong',
        })
      );
    });
  });

  // ==========================================================================
  // 세션 뷰어 관리
  // ==========================================================================

  describe('세션 뷰어 관리', () => {
    it('should register session viewer on conversation_select', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });

      expect(pylon.getSessionViewerCount(conversation.conversationId)).toBe(1);
    });

    it('should unregister session viewer on client_disconnect', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // 뷰어 등록
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });

      // 클라이언트 연결 해제
      pylon.handleMessage({
        type: 'client_disconnect',
        payload: { deviceId: 'client-1' },
      });

      expect(pylon.getSessionViewerCount(conversation.conversationId)).toBe(0);
    });

    it('should NOT unload message cache when switching away from active session', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const convA = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      const convB = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // 대화 A에 메시지 추가
      deps.messageStore.addUserMessage(convA.conversationId, 'Hello');
      deps.messageStore.addAssistantText(convA.conversationId, 'Hi there');

      // 대화 A 선택 (뷰어 등록)
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: { conversationId: convA.conversationId },
      });

      // Claude가 A에서 작업 중
      vi.mocked(deps.claudeManager.hasActiveSession).mockImplementation(
        (eid: number) => eid === convA.conversationId
      );

      // 대화 B로 전환 → A의 뷰어가 0명이 되지만 캐시는 유지되어야 함
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: { conversationId: convB.conversationId },
      });

      // A의 메시지 캐시가 유지되어야 함
      expect(deps.messageStore.hasCache(convA.conversationId)).toBe(true);
      expect(deps.messageStore.getCount(convA.conversationId)).toBe(2);
    });

    it('should unload message cache when switching away from idle session', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const convA = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      const convB = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // 대화 A에 메시지 추가
      deps.messageStore.addUserMessage(convA.conversationId, 'Hello');

      // 대화 A 선택
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: { conversationId: convA.conversationId },
      });

      // Claude는 A에서 idle (기본 mock: hasActiveSession → false)

      // 대화 B로 전환 → A의 캐시는 언로드되어야 함
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: { conversationId: convB.conversationId },
      });

      // A의 메시지 캐시가 언로드되어야 함
      expect(deps.messageStore.hasCache(convA.conversationId)).toBe(false);
    });

    it('should preserve history when switching back to active session', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const convA = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      const convB = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // 대화 A에 메시지 5개 추가
      for (let i = 0; i < 5; i++) {
        deps.messageStore.addUserMessage(convA.conversationId, `msg-${i}`);
      }
      expect(deps.messageStore.getCount(convA.conversationId)).toBe(5);

      // 대화 A 선택
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: { conversationId: convA.conversationId },
      });

      // Claude가 A에서 작업 중
      vi.mocked(deps.claudeManager.hasActiveSession).mockImplementation(
        (eid: number) => eid === convA.conversationId
      );

      // B로 전환
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: { conversationId: convB.conversationId },
      });

      // 작업 중 이벤트로 A에 메시지 추가
      pylon.sendClaudeEvent(convA.conversationId, {
        type: 'textComplete',
        text: 'new response',
      });

      // 다시 A로 전환
      vi.clearAllMocks();
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: { conversationId: convA.conversationId },
      });

      // history_result에 모든 메시지가 포함되어야 함 (원래 5 + 새로 추가된 1)
      const historySent = vi.mocked(deps.relayClient.send).mock.calls.find(
        (call) => (call[0] as Record<string, unknown>).type === 'history_result'
      );
      expect(historySent).toBeDefined();
      const payload = (historySent![0] as Record<string, unknown>).payload as Record<string, unknown>;
      expect(payload.totalCount).toBe(6);
    });
  });

  // ==========================================================================
  // Claude 이벤트 전달
  // ==========================================================================

  describe('Claude 이벤트 전달', () => {
    it('should send claude_event to session viewers', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // 뷰어 등록
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });

      vi.clearAllMocks();

      // Claude 이벤트 전달
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'text',
        content: 'Hello!',
      });

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'claude_event',
          to: ['client-1'],
          payload: expect.objectContaining({
            conversationId: conversation.conversationId,
          }),
        })
      );
    });

    it('should broadcast state change to all clients', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'state',
        state: 'working',
      });

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_status',
          broadcast: 'clients',
        })
      );
    });

    it('should include workspaceId in conversation_status message', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'state',
        state: 'working',
      });

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_status',
          payload: expect.objectContaining({
            conversationId: conversation.conversationId,
            status: 'working',
          }),
        })
      );
    });

    it('should still broadcast conversation_status for unknown conversationId', () => {
      // workspaceStore에 존재하지 않는 세션에도 conversation_status는 broadcast됨
      // (ConversationId 기반 구조에서는 별도 존재 확인 없이 broadcast)
      pylon.sendClaudeEvent(999999, {
        type: 'state',
        state: 'working',
      });

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_status',
          broadcast: 'clients',
          payload: expect.objectContaining({
            conversationId: 999999,
            status: 'working',
          }),
        })
      );
    });

    it('should save textComplete to message history', () => {
      const sessionId = 12345;

      pylon.sendClaudeEvent(sessionId, {
        type: 'textComplete',
        text: 'Response text',
      });

      const messages = deps.messageStore.getMessages(sessionId);
      expect(messages.length).toBe(1);
      expect(messages[0].type).toBe('text');
    });

    it('should include workspaceId in unread notification', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // 클라이언트 A가 대화를 선택 (viewer로 등록) - deviceId는 숫자
      const clientA = 100; // 인코딩된 deviceId (숫자)
      const clientB = 101; // 인코딩된 deviceId (숫자)

      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: clientA },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });

      // 클라이언트 B도 연결되었지만 다른 대화를 보고 있다고 시뮬레이션
      const conv2 = deps.workspaceStore.createConversation(workspace.workspaceId, 'Conv2')!;
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: clientB },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conv2.conversationId,
        },
      });

      vi.clearAllMocks();

      // Claude 이벤트 발생 (textComplete는 unread 트리거)
      pylon.sendClaudeEvent(conversation.conversationId, {
        type: 'textComplete',
        text: 'Hello',
      });

      // 클라이언트 B에게 unread 알림이 conversationId 포함해서 전송되어야 함
      // status는 현재 대화 상태를 유지하고, unread: true만 전달
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_status',
          to: [clientB],
          payload: expect.objectContaining({
            conversationId: conversation.conversationId,
            unread: true,
          }),
        })
      );
    });

    it('should send unread to non-viewers even for unknown conversationId', () => {
      // 워크스페이스 생성 (대화 포함)
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      // 클라이언트 A가 대화 선택
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-A' },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conversation.conversationId,
        },
      });

      // 클라이언트 B는 다른 대화 선택
      const conv2 = deps.workspaceStore.createConversation(workspace.workspaceId, 'Conv2')!;
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-B' },
        payload: {
          workspaceId: workspace.workspaceId,
          conversationId: conv2.conversationId,
        },
      });

      vi.clearAllMocks();

      // 워크스페이스에 없는 세션으로 이벤트 발생
      // ConversationId 기반 구조에서는 별도 존재 확인 없이 unread 전송
      pylon.sendClaudeEvent(999999, {
        type: 'textComplete',
        text: 'Hello',
      });

      // 모든 non-viewer에게 unread 알림 전송됨
      // status는 대화가 없으면 'idle', unread: true 전달
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_status',
          payload: expect.objectContaining({
            conversationId: 999999,
            unread: true,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // 폴더 메시지 핸들러
  // ==========================================================================

  describe('폴더 메시지 핸들러', () => {
    it('should handle folder_list request', () => {
      pylon.handleMessage({
        type: 'folder_list',
        from: { deviceId: 'client-1' },
        payload: { path: 'C:\\test' },
      });

      expect(deps.folderManager.listFolders).toHaveBeenCalledWith('C:\\test');
    });

    it('should handle folder_create request', () => {
      pylon.handleMessage({
        type: 'folder_create',
        from: { deviceId: 'client-1' },
        payload: { path: 'C:\\test', name: 'new-folder' },
      });

      expect(deps.folderManager.createFolder).toHaveBeenCalledWith('C:\\test', 'new-folder');
    });
  });

  // ==========================================================================
  // 태스크 메시지 핸들러
  // ==========================================================================

  describe('태스크 메시지 핸들러', () => {
    it('should handle task_list request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'task_list',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId },
      });

      expect(deps.taskManager.listTasks).toHaveBeenCalledWith('C:\\test');
    });

    it('should handle task_get request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'task_get',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId, taskId: 'task-1' },
      });

      expect(deps.taskManager.getTask).toHaveBeenCalledWith('C:\\test', 'task-1');
    });
  });

  // ==========================================================================
  // 워커 메시지 핸들러
  // ==========================================================================

  describe('워커 메시지 핸들러', () => {
    it('should handle worker_status request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'worker_status',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId },
      });

      expect(deps.workerManager.getWorkerStatus).toHaveBeenCalled();
    });

    it('should handle worker_stop request', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'worker_stop',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId },
      });

      expect(deps.workerManager.stopWorker).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 권한 모드 설정
  // ==========================================================================

  describe('권한 모드 설정', () => {
    it('should handle claude_set_permission_mode', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

      pylon.handleMessage({
        type: 'claude_set_permission_mode',
        payload: {
          conversationId: conversation.conversationId,
          mode: 'acceptEdits',
        },
      });

      const updated = deps.workspaceStore.getConversation(conversation.conversationId);
      expect(updated?.permissionMode).toBe('acceptEdits');
    });

    it('should save workspace store after permission mode change', async () => {
      const mockPersistence = {
        loadWorkspaceStore: vi.fn(),
        saveWorkspaceStore: vi.fn().mockResolvedValue(undefined),
        loadMessageSession: vi.fn(),
        saveMessageSession: vi.fn().mockResolvedValue(undefined),
        deleteMessageSession: vi.fn(),
        listMessageSessions: vi.fn().mockReturnValue([]),
      };

      deps.persistence = mockPersistence;
      pylon = new Pylon(config, deps);

      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      mockPersistence.saveWorkspaceStore.mockClear();

      pylon.handleMessage({
        type: 'claude_set_permission_mode',
        payload: {
          conversationId: conversation.conversationId,
          mode: 'bypassPermissions',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockPersistence.saveWorkspaceStore).toHaveBeenCalled();
    });

    it('should include permissionMode in workspace_list_result', () => {
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      deps.workspaceStore.setConversationPermissionMode(conversation.conversationId, 'acceptEdits');

      pylon.handleMessage({
        type: 'workspace_list',
        from: { deviceId: 1 },
        payload: {},
      });

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workspace_list_result',
          payload: expect.objectContaining({
            workspaces: expect.arrayContaining([
              expect.objectContaining({
                conversations: expect.arrayContaining([
                  expect.objectContaining({
                    permissionMode: 'acceptEdits',
                  }),
                ]),
              }),
            ]),
          }),
        })
      );
    });

    it('should restore permissionMode on pylon restart', () => {
      // 1. 워크스페이스 생성 및 퍼미션 변경
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      deps.workspaceStore.setConversationPermissionMode(conversation.conversationId, 'bypassPermissions');

      // 2. 현재 상태 저장
      const savedData = deps.workspaceStore.toJSON();

      // 3. 새 워크스페이스 스토어 생성 (재시작 시뮬레이션)
      const newWorkspaceStore = WorkspaceStore.fromJSON(PYLON_ID, savedData);

      // 4. 퍼미션 모드 복구 확인
      const restored = newWorkspaceStore.getConversation(conversation.conversationId);
      expect(restored?.permissionMode).toBe('bypassPermissions');
    });
  });

  // ==========================================================================
  // 영속성 통합 테스트
  // ==========================================================================

  describe('영속성 통합', () => {
    it('should call persistence.saveWorkspaceStore on workspace create', async () => {
      const mockPersistence = {
        loadWorkspaceStore: vi.fn(),
        saveWorkspaceStore: vi.fn().mockResolvedValue(undefined),
        loadMessageSession: vi.fn(),
        saveMessageSession: vi.fn().mockResolvedValue(undefined),
        deleteMessageSession: vi.fn(),
        listMessageSessions: vi.fn().mockReturnValue([]),
      };

      deps.persistence = mockPersistence;
      pylon = new Pylon(config, deps);

      pylon.handleMessage({
        type: 'workspace_create',
        from: { deviceId: 'client-1' },
        payload: { name: 'New Project', workingDir: 'C:\\test' },
      });

      // 약간의 지연 후 저장 확인 (비동기)
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockPersistence.saveWorkspaceStore).toHaveBeenCalled();
    });

    it('should call persistence.saveWorkspaceStore on workspace delete', async () => {
      const mockPersistence = {
        loadWorkspaceStore: vi.fn(),
        saveWorkspaceStore: vi.fn().mockResolvedValue(undefined),
        loadMessageSession: vi.fn(),
        saveMessageSession: vi.fn().mockResolvedValue(undefined),
        deleteMessageSession: vi.fn(),
        listMessageSessions: vi.fn().mockReturnValue([]),
      };

      deps.persistence = mockPersistence;
      pylon = new Pylon(config, deps);

      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'workspace_delete',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockPersistence.saveWorkspaceStore).toHaveBeenCalled();
    });

    it('should schedule message save on claude event', async () => {
      const mockPersistence = {
        loadWorkspaceStore: vi.fn(),
        saveWorkspaceStore: vi.fn().mockResolvedValue(undefined),
        loadMessageSession: vi.fn(),
        saveMessageSession: vi.fn().mockResolvedValue(undefined),
        deleteMessageSession: vi.fn(),
        listMessageSessions: vi.fn().mockReturnValue([]),
      };

      deps.persistence = mockPersistence;
      pylon = new Pylon(config, deps);

      const sessionId = 12345;

      // textComplete 이벤트 (메시지 저장 트리거)
      pylon.sendClaudeEvent(sessionId, {
        type: 'textComplete',
        text: 'Hello from Claude',
      });

      // debounce 시간 대기 (2초)
      await new Promise((resolve) => setTimeout(resolve, 2100));
      expect(mockPersistence.saveMessageSession).toHaveBeenCalledWith(
        String(sessionId),
        expect.any(Object)
      );
    });

    it('should load all message sessions on startup', async () => {
      // 시작 시 모든 대화의 메시지 세션을 로딩해야 함
      // 로딩 없이 메시지 추가 시 _ensureCache가 빈 배열을 생성하여 히스토리 소실

      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conv1 = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      const conv2 = deps.workspaceStore.createConversation(workspace.workspaceId, 'Conv2')!;
      const eid1 = conv1.conversationId;
      const eid2 = conv2.conversationId;

      // conv1을 working 상태로 설정 (리셋 대상)
      const c1 = deps.workspaceStore.getConversation(eid1)!;
      (c1 as { status: string }).status = 'working';

      // 파일에 저장된 기존 메시지
      const messages1 = [
        { id: 'msg_1', role: 'user', type: 'text', content: 'Hello', timestamp: 1000 },
        { id: 'msg_2', role: 'assistant', type: 'text', content: 'Hi there', timestamp: 2000 },
      ];
      const messages2 = [
        { id: 'msg_3', role: 'user', type: 'text', content: 'Question', timestamp: 3000 },
      ];

      const mockPersistence = {
        loadWorkspaceStore: vi.fn(),
        saveWorkspaceStore: vi.fn().mockResolvedValue(undefined),
        loadMessageSession: vi.fn().mockImplementation((sessionId: string) => {
          if (Number(sessionId) === eid1) {
            return { sessionId: eid1, messages: messages1, updatedAt: 2000 };
          }
          if (Number(sessionId) === eid2) {
            return { sessionId: eid2, messages: messages2, updatedAt: 3000 };
          }
          return null;
        }),
        saveMessageSession: vi.fn().mockResolvedValue(undefined),
        deleteMessageSession: vi.fn(),
        listMessageSessions: vi.fn().mockReturnValue([]),
      };

      deps.persistence = mockPersistence;
      pylon = new Pylon(config, deps);
      await pylon.start();

      // conv1: 기존 2개 + session_ended 1개 = 3개 (히스토리 보존)
      const result1 = deps.messageStore.getMessages(eid1);
      expect(result1.length).toBe(3);
      expect(result1[0].content).toBe('Hello');
      expect(result1[1].content).toBe('Hi there');
      expect(result1[2].type).toBe('aborted');

      // conv2: idle 상태이므로 기존 1개 그대로
      const result2 = deps.messageStore.getMessages(eid2);
      expect(result2.length).toBe(1);
      expect(result2[0].content).toBe('Question');
    });

    it('should flush pending saves on stop', async () => {
      const mockPersistence = {
        loadWorkspaceStore: vi.fn(),
        saveWorkspaceStore: vi.fn().mockResolvedValue(undefined),
        loadMessageSession: vi.fn(),
        saveMessageSession: vi.fn().mockResolvedValue(undefined),
        deleteMessageSession: vi.fn(),
        listMessageSessions: vi.fn().mockReturnValue([]),
      };

      deps.persistence = mockPersistence;
      pylon = new Pylon(config, deps);

      const sessionId = 12345;

      // 메시지 추가
      deps.messageStore.addUserMessage(sessionId, 'Test message');

      // 저장 스케줄링 (debounce 중)
      pylon.sendClaudeEvent(sessionId, {
        type: 'textComplete',
        text: 'Response',
      });

      // stop 호출 - 즉시 저장해야 함
      await pylon.stop();

      expect(mockPersistence.saveWorkspaceStore).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 세션 컨텍스트 (pylon-context)
  // ==========================================================================

  describe('세션 컨텍스트', () => {
    // ------------------------------------------------------------------------
    // 1. 세션 시작 시 컨텍스트 전달 (claude_send 처리)
    // ------------------------------------------------------------------------

    describe('세션 시작 시 컨텍스트 전달', () => {
      it('should_pass_systemPrompt_when_handling_claude_send', () => {
        // Arrange
        const configWithBuildEnv = { ...config, buildEnv: 'release' };
        pylon = new Pylon(configWithBuildEnv, deps);

        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

        // Act
        pylon.handleMessage({
          type: 'claude_send',
          from: { deviceId: 'client-1' },
          payload: {
            conversationId: conversation.conversationId,
            message: 'Hello Claude',
          },
        });

        // Assert: claudeManager.sendMessage에 systemPrompt가 전달되어야 함
        expect(deps.claudeManager.sendMessage).toHaveBeenCalledWith(
          conversation.conversationId,
          'Hello Claude',
          expect.objectContaining({
            workingDir: 'C:\\test',
            systemPrompt: expect.stringContaining('release'),
          })
        );
      });

      it('should_pass_systemReminder_with_conversation_info_when_handling_claude_send', () => {
        // Arrange
        const configWithBuildEnv = { ...config, buildEnv: 'dev' };
        pylon = new Pylon(configWithBuildEnv, deps);

        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId, 'My Chat')!;

        // Act
        pylon.handleMessage({
          type: 'claude_send',
          from: { deviceId: 'client-1' },
          payload: {
            conversationId: conversation.conversationId,
            message: 'Hello',
          },
        });

        // Assert: systemReminder에 대화명이 포함되어야 함
        expect(deps.claudeManager.sendMessage).toHaveBeenCalledWith(
          conversation.conversationId,
          'Hello',
          expect.objectContaining({
            systemReminder: expect.stringContaining('My Chat'),
          })
        );
      });

      it('should_include_linked_documents_in_systemReminder', () => {
        // Arrange
        const configWithBuildEnv = { ...config, buildEnv: 'dev' };
        pylon = new Pylon(configWithBuildEnv, deps);

        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId, 'Doc Chat')!;

        // 문서 연결
        deps.workspaceStore.linkDocument(conversation.conversationId, 'C:\\docs\\readme.md');
        deps.workspaceStore.linkDocument(conversation.conversationId, 'C:\\docs\\api.md');

        // Act
        pylon.handleMessage({
          type: 'claude_send',
          from: { deviceId: 'client-1' },
          payload: {
            conversationId: conversation.conversationId,
            message: 'Hello',
          },
        });

        // Assert: systemReminder에 연결된 문서 경로가 포함되어야 함
        expect(deps.claudeManager.sendMessage).toHaveBeenCalledWith(
          conversation.conversationId,
          'Hello',
          expect.objectContaining({
            systemReminder: expect.stringMatching(/readme\.md.*api\.md|api\.md.*readme\.md/),
          })
        );
      });
    });

    // ------------------------------------------------------------------------
    // 2. 문서 추가/삭제 시 이벤트 리마인더
    // ------------------------------------------------------------------------

    describe('문서 추가/삭제 시 이벤트 리마인더', () => {
      it('should_send_document_added_reminder_when_document_linked_and_session_active', () => {
        // Arrange
        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

        // 활성 세션 설정
        vi.mocked(deps.claudeManager.hasActiveSession).mockImplementation(
          (eid: number) => eid === conversation.conversationId
        );

        vi.clearAllMocks();

        // Act: 문서 연결
        pylon.handleMessage({
          type: 'link_document',
          from: { deviceId: 'client-1' },
          payload: {
            conversationId: conversation.conversationId,
            path: 'C:\\docs\\readme.md',
          },
        });

        // Assert: 활성 세션에 리마인더 메시지가 전송되어야 함
        expect(deps.claudeManager.sendMessage).toHaveBeenCalledWith(
          conversation.conversationId,
          expect.stringContaining('readme.md'),
          expect.objectContaining({
            workingDir: 'C:\\test',
          })
        );
      });

      it('should_not_send_reminder_when_document_linked_but_no_active_session', () => {
        // Arrange
        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

        // 비활성 세션 (기본 mock: hasActiveSession = false)
        vi.mocked(deps.claudeManager.hasActiveSession).mockReturnValue(false);

        vi.clearAllMocks();

        // Act: 문서 연결
        pylon.handleMessage({
          type: 'link_document',
          from: { deviceId: 'client-1' },
          payload: {
            conversationId: conversation.conversationId,
            path: 'C:\\docs\\readme.md',
          },
        });

        // Assert: 비활성 세션에는 리마인더가 전송되지 않아야 함
        expect(deps.claudeManager.sendMessage).not.toHaveBeenCalled();
      });

      it('should_send_document_removed_reminder_when_document_unlinked_and_session_active', () => {
        // Arrange
        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

        // 먼저 문서 연결
        deps.workspaceStore.linkDocument(conversation.conversationId, 'C:\\docs\\readme.md');

        // 활성 세션 설정
        vi.mocked(deps.claudeManager.hasActiveSession).mockImplementation(
          (eid: number) => eid === conversation.conversationId
        );

        vi.clearAllMocks();

        // Act: 문서 연결 해제
        pylon.handleMessage({
          type: 'unlink_document',
          from: { deviceId: 'client-1' },
          payload: {
            conversationId: conversation.conversationId,
            path: 'C:\\docs\\readme.md',
          },
        });

        // Assert: 활성 세션에 문서 해제 리마인더가 전송되어야 함
        expect(deps.claudeManager.sendMessage).toHaveBeenCalledWith(
          conversation.conversationId,
          expect.stringContaining('readme.md'),
          expect.objectContaining({
            workingDir: 'C:\\test',
          })
        );
      });
    });

    // ------------------------------------------------------------------------
    // 3. 대화명 변경 시 이벤트 리마인더
    // ------------------------------------------------------------------------

    describe('대화명 변경 시 이벤트 리마인더', () => {
      it('should_send_rename_reminder_when_conversation_renamed_and_session_active', () => {
        // Arrange
        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId, 'Old Name')!;

        // 활성 세션 설정
        vi.mocked(deps.claudeManager.hasActiveSession).mockImplementation(
          (eid: number) => eid === conversation.conversationId
        );

        vi.clearAllMocks();

        // Act: 대화명 변경
        pylon.handleMessage({
          type: 'conversation_rename',
          from: { deviceId: 'client-1' },
          payload: {
            conversationId: conversation.conversationId,
            newName: 'New Name',
          },
        });

        // Assert: 활성 세션에 대화명 변경 리마인더가 전송되어야 함
        expect(deps.claudeManager.sendMessage).toHaveBeenCalledWith(
          conversation.conversationId,
          expect.stringMatching(/Old Name.*New Name/),
          expect.objectContaining({
            workingDir: 'C:\\test',
          })
        );
      });

      it('should_not_send_reminder_when_renamed_but_no_active_session', () => {
        // Arrange
        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId, 'Old Name')!;

        // 비활성 세션
        vi.mocked(deps.claudeManager.hasActiveSession).mockReturnValue(false);

        vi.clearAllMocks();

        // Act: 대화명 변경
        pylon.handleMessage({
          type: 'conversation_rename',
          from: { deviceId: 'client-1' },
          payload: {
            conversationId: conversation.conversationId,
            newName: 'New Name',
          },
        });

        // Assert: 비활성 세션에는 리마인더가 전송되지 않아야 함
        expect(deps.claudeManager.sendMessage).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Viewer 히스토리 요청 (share_history)
  // ==========================================================================

  describe('Viewer 히스토리 요청 (share_history)', () => {
    // ========================================================================
    // 테스트 케이스 5: share_history 수신 시 shareId 검증
    // ========================================================================

    describe('shareId 검증', () => {
      it('should_validate_shareId_when_handling_share_history', () => {
        // Arrange
        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

        // ShareStore에 공유 생성 (deps.shareStore가 추가되어야 함)
        // 아직 구현되지 않은 의존성 - 테스트는 실패해야 함
        const shareInfo = deps.shareStore.create(conversation.conversationId);

        // Act
        pylon.handleMessage({
          type: 'share_history',
          from: { deviceId: 100 },  // viewer의 deviceId
          payload: { shareId: shareInfo.shareId },
        });

        // Assert - shareStore.validate()가 호출되어야 함
        expect(deps.shareStore.validate).toHaveBeenCalledWith(shareInfo.shareId);
      });
    });

    // ========================================================================
    // 테스트 케이스 6: 유효한 shareId면 메시지 목록 반환 (과거→최신 순)
    // ========================================================================

    describe('유효한 shareId', () => {
      it('should_return_messages_in_chronological_order_when_shareId_is_valid', () => {
        // Arrange
        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

        // 메시지 추가 (최신 → 과거 순으로 저장되어 있음)
        deps.messageStore.addUserMessage(conversation.conversationId, 'First message');
        deps.messageStore.addAssistantText(conversation.conversationId, 'Response 1');
        deps.messageStore.addUserMessage(conversation.conversationId, 'Second message');

        // ShareStore에 공유 생성
        const shareInfo = deps.shareStore.create(conversation.conversationId);

        // Act
        pylon.handleMessage({
          type: 'share_history',
          from: { deviceId: 100 },
          payload: { shareId: shareInfo.shareId },
        });

        // Assert - share_history_result가 전송되어야 함
        expect(deps.relayClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'share_history_result',
            payload: expect.objectContaining({
              shareId: shareInfo.shareId,
              conversationId: conversation.conversationId,
              // messages는 과거→최신 순 (chronological order)
              messages: expect.arrayContaining([
                expect.objectContaining({ content: 'First message' }),
              ]),
            }),
          })
        );
      });

      it('should_include_all_message_fields_in_share_history_result', () => {
        // Arrange
        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;

        deps.messageStore.addUserMessage(conversation.conversationId, 'Test message');
        const shareInfo = deps.shareStore.create(conversation.conversationId);

        // Act
        pylon.handleMessage({
          type: 'share_history',
          from: { deviceId: 100 },
          payload: { shareId: shareInfo.shareId },
        });

        // Assert - 메시지에 필요한 필드가 포함되어야 함
        expect(deps.relayClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'share_history_result',
            payload: expect.objectContaining({
              messages: expect.arrayContaining([
                expect.objectContaining({
                  id: expect.any(String),
                  role: 'user',
                  type: 'text',
                  content: 'Test message',
                  timestamp: expect.any(Number),
                }),
              ]),
            }),
          })
        );
      });
    });

    // ========================================================================
    // 테스트 케이스 7: 무효한 shareId면 에러 반환
    // ========================================================================

    describe('무효한 shareId', () => {
      it('should_return_error_when_shareId_is_invalid', () => {
        // Arrange - 존재하지 않는 shareId

        // Act
        pylon.handleMessage({
          type: 'share_history',
          from: { deviceId: 100 },
          payload: { shareId: 'invalidShareId' },
        });

        // Assert - 에러 응답이 전송되어야 함
        expect(deps.relayClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'share_history_result',
            to: [100],
            payload: expect.objectContaining({
              success: false,
              error: expect.stringContaining('not found'),
            }),
          })
        );
      });

      it('should_return_error_when_shareId_is_empty', () => {
        // Arrange - 빈 shareId

        // Act
        pylon.handleMessage({
          type: 'share_history',
          from: { deviceId: 100 },
          payload: { shareId: '' },
        });

        // Assert - 에러 응답이 전송되어야 함
        expect(deps.relayClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'share_history_result',
            to: [100],
            payload: expect.objectContaining({
              success: false,
            }),
          })
        );
      });

      it('should_return_error_when_shareId_is_missing', () => {
        // Arrange - shareId 누락

        // Act
        pylon.handleMessage({
          type: 'share_history',
          from: { deviceId: 100 },
          payload: {},  // shareId 없음
        });

        // Assert - 에러 응답이 전송되어야 함
        expect(deps.relayClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'share_history_result',
            to: [100],
            payload: expect.objectContaining({
              success: false,
              error: expect.stringContaining('shareId'),
            }),
          })
        );
      });
    });

    // ========================================================================
    // 테스트 케이스 8: share_history_result를 요청자(from.deviceId)에게 응답
    // ========================================================================

    describe('응답 라우팅', () => {
      it('should_route_share_history_result_to_requesting_viewer', () => {
        // Arrange
        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;
        const shareInfo = deps.shareStore.create(conversation.conversationId);

        const viewerDeviceId = 100;  // 인코딩된 viewer deviceId

        // Act
        pylon.handleMessage({
          type: 'share_history',
          from: { deviceId: viewerDeviceId },
          payload: { shareId: shareInfo.shareId },
        });

        // Assert - to 필드에 요청자의 deviceId가 있어야 함
        expect(deps.relayClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'share_history_result',
            to: [viewerDeviceId],
          })
        );
      });

      it('should_respond_to_correct_viewer_when_multiple_viewers_exist', () => {
        // Arrange
        const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
        const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;
        const shareInfo = deps.shareStore.create(conversation.conversationId);

        deps.messageStore.addUserMessage(conversation.conversationId, 'Hello');

        const viewer1DeviceId = 100;
        const viewer2DeviceId = 101;

        // Act - viewer2가 요청
        pylon.handleMessage({
          type: 'share_history',
          from: { deviceId: viewer2DeviceId },
          payload: { shareId: shareInfo.shareId },
        });

        // Assert - viewer2에게만 응답해야 함
        expect(deps.relayClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'share_history_result',
            to: [viewer2DeviceId],  // viewer1이 아닌 viewer2
          })
        );

        // Assert - viewer1에게는 응답하지 않아야 함
        const sendCalls = vi.mocked(deps.relayClient.send).mock.calls;
        const historyResults = sendCalls.filter(
          (call) => (call[0] as { type: string }).type === 'share_history_result'
        );
        expect(historyResults.length).toBe(1);
        expect((historyResults[0][0] as { to: number[] }).to).toEqual([viewer2DeviceId]);
      });
    });
  });
});
