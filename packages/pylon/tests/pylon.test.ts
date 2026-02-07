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
  return {
    workspaceStore: new WorkspaceStore(PYLON_ID),
    messageStore: new MessageStore(),
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

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workspace_list_result',
          to: 'client-1',
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
      // 기본 대화 + 새 대화 = 2개
      expect(updated?.conversations.length).toBe(2);
    });

    it('should handle conversation_delete request', () => {
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'conversation_delete',
        payload: {
          entityId: conversation.entityId,
        },
      });

      const updated = deps.workspaceStore.getWorkspace(workspace.workspaceId);
      expect(updated?.conversations.length).toBe(0);
    });

    it('should handle conversation_select and send history', () => {
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // 메시지 추가
      deps.messageStore.addUserMessage(conversation.entityId, 'Hello');

      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          entityId: conversation.entityId,
        },
      });

      // history_result 전송 확인
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'history_result',
          to: 'client-1',
        })
      );
    });
  });

  // ==========================================================================
  // Claude 메시지 핸들러
  // ==========================================================================

  describe('Claude 메시지 핸들러', () => {
    it('should handle claude_send request', () => {
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'claude_send',
        from: { deviceId: 'client-1' },
        payload: {
          entityId: conversation.entityId,
          message: 'Hello Claude',
        },
      });

      expect(deps.claudeManager.sendMessage).toHaveBeenCalled();
    });

    it('should handle claude_permission request', () => {
      const { conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'claude_permission',
        payload: {
          entityId: conversation.entityId,
          toolUseId: 'tool-1',
          decision: 'allow',
        },
      });

      expect(deps.claudeManager.respondPermission).toHaveBeenCalledWith(
        conversation.entityId,
        'tool-1',
        'allow'
      );
    });

    it('should handle claude_answer request', () => {
      const { conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'claude_answer',
        payload: {
          entityId: conversation.entityId,
          toolUseId: 'tool-1',
          answer: 'Yes',
        },
      });

      expect(deps.claudeManager.respondQuestion).toHaveBeenCalledWith(
        conversation.entityId,
        'tool-1',
        'Yes'
      );
    });

    it('should handle claude_control stop action', () => {
      const { conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'claude_control',
        payload: {
          entityId: conversation.entityId,
          action: 'stop',
        },
      });

      expect(deps.claudeManager.stop).toHaveBeenCalledWith(conversation.entityId);
    });

    it('should handle claude_control new_session action', () => {
      const { conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'claude_control',
        payload: {
          entityId: conversation.entityId,
          action: 'new_session',
        },
      });

      expect(deps.claudeManager.newSession).toHaveBeenCalledWith(conversation.entityId);
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
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // 여러 메시지 추가 (작은 메시지는 모두 100KB 이내)
      for (let i = 0; i < 10; i++) {
        deps.messageStore.addUserMessage(conversation.entityId, `Message ${i}`);
      }

      pylon.handleMessage({
        type: 'history_request',
        from: { deviceId: 'client-1' },
        payload: {
          entityId: conversation.entityId,
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
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          entityId: conversation.entityId,
        },
      });

      expect(pylon.getSessionViewerCount(conversation.entityId)).toBe(1);
    });

    it('should unregister session viewer on client_disconnect', () => {
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // 뷰어 등록
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          entityId: conversation.entityId,
        },
      });

      // 클라이언트 연결 해제
      pylon.handleMessage({
        type: 'client_disconnect',
        payload: { deviceId: 'client-1' },
      });

      expect(pylon.getSessionViewerCount(conversation.entityId)).toBe(0);
    });
  });

  // ==========================================================================
  // Claude 이벤트 전달
  // ==========================================================================

  describe('Claude 이벤트 전달', () => {
    it('should send claude_event to session viewers', () => {
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // 뷰어 등록
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-1' },
        payload: {
          workspaceId: workspace.workspaceId,
          entityId: conversation.entityId,
        },
      });

      vi.clearAllMocks();

      // Claude 이벤트 전달
      pylon.sendClaudeEvent(conversation.entityId, {
        type: 'text',
        content: 'Hello!',
      });

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'claude_event',
          to: ['client-1'],
          payload: expect.objectContaining({
            entityId: conversation.entityId,
          }),
        })
      );
    });

    it('should broadcast state change to all clients', () => {
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.sendClaudeEvent(conversation.entityId, {
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
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.sendClaudeEvent(conversation.entityId, {
        type: 'state',
        state: 'working',
      });

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_status',
          payload: expect.objectContaining({
            entityId: conversation.entityId,
            status: 'working',
          }),
        })
      );
    });

    it('should still broadcast conversation_status for unknown entityId', () => {
      // workspaceStore에 존재하지 않는 세션에도 conversation_status는 broadcast됨
      // (EntityId 기반 구조에서는 별도 존재 확인 없이 broadcast)
      pylon.sendClaudeEvent(999999, {
        type: 'state',
        state: 'working',
      });

      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_status',
          broadcast: 'clients',
          payload: expect.objectContaining({
            entityId: 999999,
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
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // 클라이언트 A가 대화를 선택 (viewer로 등록)
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-A' },
        payload: {
          workspaceId: workspace.workspaceId,
          entityId: conversation.entityId,
        },
      });

      // 클라이언트 B도 연결되었지만 다른 대화를 보고 있다고 시뮬레이션
      const conv2 = deps.workspaceStore.createConversation(workspace.workspaceId, 'Conv2')!;
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-B' },
        payload: {
          workspaceId: workspace.workspaceId,
          entityId: conv2.entityId,
        },
      });

      vi.clearAllMocks();

      // Claude 이벤트 발생 (textComplete는 unread 트리거)
      pylon.sendClaudeEvent(conversation.entityId, {
        type: 'textComplete',
        text: 'Hello',
      });

      // 클라이언트 B에게 unread 알림이 entityId 포함해서 전송되어야 함
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_status',
          to: ['client-B'],
          payload: expect.objectContaining({
            entityId: conversation.entityId,
            status: 'unread',
          }),
        })
      );
    });

    it('should send unread to non-viewers even for unknown entityId', () => {
      // 워크스페이스 생성 (대화 포함)
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // 클라이언트 A가 대화 선택
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-A' },
        payload: {
          workspaceId: workspace.workspaceId,
          entityId: conversation.entityId,
        },
      });

      // 클라이언트 B는 다른 대화 선택
      const conv2 = deps.workspaceStore.createConversation(workspace.workspaceId, 'Conv2')!;
      pylon.handleMessage({
        type: 'conversation_select',
        from: { deviceId: 'client-B' },
        payload: {
          workspaceId: workspace.workspaceId,
          entityId: conv2.entityId,
        },
      });

      vi.clearAllMocks();

      // 워크스페이스에 없는 세션으로 이벤트 발생
      // EntityId 기반 구조에서는 별도 존재 확인 없이 unread 전송
      pylon.sendClaudeEvent(999999, {
        type: 'textComplete',
        text: 'Hello',
      });

      // 모든 non-viewer에게 unread 알림 전송됨
      expect(deps.relayClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_status',
          payload: expect.objectContaining({
            entityId: 999999,
            status: 'unread',
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
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      pylon.handleMessage({
        type: 'claude_set_permission_mode',
        payload: {
          entityId: conversation.entityId,
          mode: 'acceptEdits',
        },
      });

      const updated = deps.workspaceStore.getConversation(conversation.entityId);
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

      const { conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      mockPersistence.saveWorkspaceStore.mockClear();

      pylon.handleMessage({
        type: 'claude_set_permission_mode',
        payload: {
          entityId: conversation.entityId,
          mode: 'bypassPermissions',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockPersistence.saveWorkspaceStore).toHaveBeenCalled();
    });

    it('should include permissionMode in workspace_list_result', () => {
      const { conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      deps.workspaceStore.setConversationPermissionMode(conversation.entityId, 'acceptEdits');

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
      const { workspace, conversation } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      deps.workspaceStore.setConversationPermissionMode(conversation.entityId, 'bypassPermissions');

      // 2. 현재 상태 저장
      const savedData = deps.workspaceStore.toJSON();

      // 3. 새 워크스페이스 스토어 생성 (재시작 시뮬레이션)
      const newWorkspaceStore = WorkspaceStore.fromJSON(PYLON_ID, savedData);

      // 4. 퍼미션 모드 복구 확인
      const restored = newWorkspaceStore.getConversation(conversation.entityId);
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
});
