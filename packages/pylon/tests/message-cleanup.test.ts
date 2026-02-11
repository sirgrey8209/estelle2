/**
 * @file message-cleanup.test.ts
 * @description 메시지 정리 테스트
 *
 * 워크스페이스/대화 삭제 시 메시지 파일 정리 기능을 테스트합니다.
 * ID 재사용으로 인한 기존 대화 노출 문제를 해결합니다.
 *
 * 테스트 케이스:
 * 1. [기존 수정] createWorkspace가 빈 conversations 배열로 생성
 * 2. [정상] handleWorkspaceDelete가 내부 대화들의 메시지 파일 삭제
 * 3. [정상] handleConversationDelete가 메시지 파일 삭제
 * 4. [정상] handleConversationCreate가 기존 메시지 파일 있으면 클리어
 * 5. [통합] 워크스페이스 삭제 후 재생성 시 기존 메시지 없음
 * 6. [통합] 대화 삭제 후 같은 ID로 생성 시 기존 메시지 없음
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

function createMockConfig(): PylonConfig {
  return {
    deviceId: 1,
    deviceName: 'test-pylon',
    relayUrl: 'ws://localhost:8080',
    uploadsDir: './test-uploads',
  };
}

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

describe('메시지 정리', () => {
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
  // 워크스페이스 생성 시 빈 conversations 배열
  // ==========================================================================

  describe('createWorkspace - 빈 conversations', () => {
    it('should_create_workspace_with_empty_conversations_when_called', () => {
      // Arrange: 워크스페이스 스토어 준비

      // Act: 워크스페이스 생성
      const result = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Assert: conversations 배열이 비어있어야 함
      // NOTE: 이 테스트는 현재 실패해야 함 - createWorkspace가 초기 대화를 생성하기 때문
      expect(result.workspace.conversations).toHaveLength(0);
      // NOTE: 기존에는 conversation을 반환했지만, 변경 후에는 반환하지 않음
      expect(result.conversation).toBeUndefined();
    });

    it('should_set_active_conversation_to_null_when_workspace_created_empty', () => {
      // Arrange: 빈 스토어

      // Act: 워크스페이스 생성
      deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      // Assert: activeConversationId가 null이어야 함
      const activeState = deps.workspaceStore.getActiveState();
      expect(activeState.activeConversationId).toBeNull();
    });
  });

  // ==========================================================================
  // 워크스페이스 삭제 시 메시지 파일 삭제
  // ==========================================================================

  describe('handleWorkspaceDelete - 메시지 파일 삭제', () => {
    it('should_delete_message_files_for_all_conversations_when_workspace_deleted', async () => {
      // Arrange: 영속성 어댑터 모킹
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

      // 워크스페이스와 여러 대화 생성
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conv1 = deps.workspaceStore.createConversation(workspace.workspaceId, 'Conv1')!;
      const conv2 = deps.workspaceStore.createConversation(workspace.workspaceId, 'Conv2')!;

      // 각 대화에 메시지 추가
      deps.messageStore.addUserMessage(conv1.entityId, 'Message 1');
      deps.messageStore.addUserMessage(conv2.entityId, 'Message 2');

      mockPersistence.deleteMessageSession.mockClear();

      // Act: 워크스페이스 삭제
      pylon.handleMessage({
        type: 'workspace_delete',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId },
      });

      // Assert: 두 대화의 메시지 파일이 모두 삭제되어야 함
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockPersistence.deleteMessageSession).toHaveBeenCalledTimes(2);
      expect(mockPersistence.deleteMessageSession).toHaveBeenCalledWith(String(conv1.entityId));
      expect(mockPersistence.deleteMessageSession).toHaveBeenCalledWith(String(conv2.entityId));
    });

    it('should_clear_message_cache_when_workspace_deleted', () => {
      // Arrange: 워크스페이스와 대화 생성
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId, 'Conv1')!;

      // 메시지 추가
      deps.messageStore.addUserMessage(conversation.entityId, 'Hello');
      expect(deps.messageStore.getMessages(conversation.entityId)).toHaveLength(1);

      // Act: 워크스페이스 삭제
      pylon.handleMessage({
        type: 'workspace_delete',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId },
      });

      // Assert: 메시지 캐시도 클리어되어야 함
      // messageStore.clear() 또는 unloadCache()가 호출되어야 함
      expect(deps.messageStore.getMessages(conversation.entityId)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 대화 삭제 시 메시지 파일 삭제
  // ==========================================================================

  describe('handleConversationDelete - 메시지 파일 삭제', () => {
    it('should_delete_message_file_when_conversation_deleted', async () => {
      // Arrange: 영속성 어댑터 모킹
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

      // 워크스페이스와 대화 생성
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId, 'Conv1')!;

      // 메시지 추가
      deps.messageStore.addUserMessage(conversation.entityId, 'Hello');

      mockPersistence.deleteMessageSession.mockClear();

      // Act: 대화 삭제
      pylon.handleMessage({
        type: 'conversation_delete',
        from: { deviceId: 'client-1' },
        payload: { entityId: conversation.entityId },
      });

      // Assert: 메시지 파일이 삭제되어야 함
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockPersistence.deleteMessageSession).toHaveBeenCalledTimes(1);
      expect(mockPersistence.deleteMessageSession).toHaveBeenCalledWith(String(conversation.entityId));
    });

    it('should_clear_message_cache_when_conversation_deleted', () => {
      // Arrange: 워크스페이스와 대화 생성
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId, 'Conv1')!;

      // 메시지 추가
      deps.messageStore.addUserMessage(conversation.entityId, 'Hello');
      expect(deps.messageStore.getMessages(conversation.entityId)).toHaveLength(1);

      // Act: 대화 삭제
      pylon.handleMessage({
        type: 'conversation_delete',
        from: { deviceId: 'client-1' },
        payload: { entityId: conversation.entityId },
      });

      // Assert: 메시지 캐시도 클리어되어야 함
      expect(deps.messageStore.getMessages(conversation.entityId)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 대화 생성 시 기존 메시지 파일 클리어
  // ==========================================================================

  describe('handleConversationCreate - 기존 메시지 클리어', () => {
    it('should_clear_existing_messages_when_conversation_created_with_reused_id', async () => {
      // Arrange: 영속성 어댑터 모킹 (이전 메시지 세션이 있는 경우 시뮬레이션)
      const mockPersistence = {
        loadWorkspaceStore: vi.fn(),
        saveWorkspaceStore: vi.fn().mockResolvedValue(undefined),
        loadMessageSession: vi.fn().mockReturnValue({
          sessionId: 0, // ID는 아래에서 설정
          messages: [
            { id: 'old_msg_1', role: 'user', type: 'text', content: 'Old message', timestamp: 1000 },
          ],
          updatedAt: 1000,
        }),
        saveMessageSession: vi.fn().mockResolvedValue(undefined),
        deleteMessageSession: vi.fn(),
        listMessageSessions: vi.fn().mockReturnValue([]),
      };

      deps.persistence = mockPersistence;
      pylon = new Pylon(config, deps);

      // 워크스페이스 생성 + 대화 생성 후 삭제 (ID 1이 재사용 가능해짐)
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const firstConv = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      deps.workspaceStore.deleteConversation(firstConv.entityId);

      // Act: 새 대화 생성 (ID 재사용됨)
      pylon.handleMessage({
        type: 'conversation_create',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId, name: 'New Conv' },
      });

      // Assert: 새 대화에 기존 메시지가 없어야 함
      // 기존 메시지 파일이 있었다면 클리어되어야 함
      await new Promise((resolve) => setTimeout(resolve, 10));

      const newConv = deps.workspaceStore.getWorkspace(workspace.workspaceId)!.conversations[0];
      const messages = deps.messageStore.getMessages(newConv.entityId);
      expect(messages).toHaveLength(0);
    });

    it('should_delete_message_file_for_new_conversation_id_if_exists', async () => {
      // Arrange: 영속성 어댑터 모킹
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

      // 워크스페이스 생성
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');

      mockPersistence.deleteMessageSession.mockClear();

      // Act: 새 대화 생성
      pylon.handleMessage({
        type: 'conversation_create',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId, name: 'New Conv' },
      });

      // Assert: 생성된 entityId에 대해 기존 메시지 파일이 있으면 삭제해야 함
      await new Promise((resolve) => setTimeout(resolve, 10));

      const newConv = deps.workspaceStore.getWorkspace(workspace.workspaceId)!.conversations.find(
        (c) => c.name === 'New Conv'
      );
      expect(mockPersistence.deleteMessageSession).toHaveBeenCalledWith(String(newConv!.entityId));
    });
  });

  // ==========================================================================
  // 통합 테스트: 워크스페이스 삭제 후 재생성
  // ==========================================================================

  describe('통합: 워크스페이스 삭제 후 재생성', () => {
    it('should_not_show_old_messages_when_workspace_recreated_with_same_id', async () => {
      // Arrange: 영속성 어댑터 모킹
      const mockPersistence = {
        loadWorkspaceStore: vi.fn(),
        saveWorkspaceStore: vi.fn().mockResolvedValue(undefined),
        loadMessageSession: vi.fn().mockReturnValue(null), // 삭제되었으므로 null
        saveMessageSession: vi.fn().mockResolvedValue(undefined),
        deleteMessageSession: vi.fn(),
        listMessageSessions: vi.fn().mockReturnValue([]),
      };

      deps.persistence = mockPersistence;
      pylon = new Pylon(config, deps);

      // 1단계: 워크스페이스 생성 및 메시지 추가
      const { workspace: ws1 } = deps.workspaceStore.createWorkspace('Test1', 'C:\\test');
      const conv1 = deps.workspaceStore.createConversation(ws1.workspaceId)!;
      deps.messageStore.addUserMessage(conv1.entityId, 'Old message from deleted workspace');

      // 2단계: 워크스페이스 삭제
      pylon.handleMessage({
        type: 'workspace_delete',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: ws1.workspaceId },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // 3단계: 같은 ID로 재생성 (ID 재사용)
      pylon.handleMessage({
        type: 'workspace_create',
        from: { deviceId: 'client-1' },
        payload: { name: 'Test2', workingDir: 'C:\\test2' },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: 새 워크스페이스에 이전 메시지가 없어야 함
      const workspaces = deps.workspaceStore.getAllWorkspaces();
      expect(workspaces).toHaveLength(1);

      // 새 워크스페이스의 대화 (있다면)에 이전 메시지가 없어야 함
      const newWs = workspaces[0];
      for (const conv of newWs.conversations) {
        const messages = deps.messageStore.getMessages(conv.entityId);
        expect(messages).toHaveLength(0);
      }
    });
  });

  // ==========================================================================
  // 통합 테스트: 대화 삭제 후 같은 ID로 생성
  // ==========================================================================

  describe('통합: 대화 삭제 후 같은 ID로 생성', () => {
    it('should_not_show_old_messages_when_conversation_recreated_with_same_id', async () => {
      // Arrange: 영속성 어댑터 모킹
      const mockPersistence = {
        loadWorkspaceStore: vi.fn(),
        saveWorkspaceStore: vi.fn().mockResolvedValue(undefined),
        loadMessageSession: vi.fn().mockReturnValue(null),
        saveMessageSession: vi.fn().mockResolvedValue(undefined),
        deleteMessageSession: vi.fn(),
        listMessageSessions: vi.fn().mockReturnValue([]),
      };

      deps.persistence = mockPersistence;
      pylon = new Pylon(config, deps);

      // 1단계: 워크스페이스 생성
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conv1 = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      const originalEntityId = conv1.entityId;

      // 메시지 추가
      deps.messageStore.addUserMessage(originalEntityId, 'Old message from deleted conversation');

      // 2단계: 대화 삭제
      pylon.handleMessage({
        type: 'conversation_delete',
        from: { deviceId: 'client-1' },
        payload: { entityId: originalEntityId },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // 3단계: 새 대화 생성 (ID 재사용됨)
      pylon.handleMessage({
        type: 'conversation_create',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId, name: 'New Conv' },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: 새 대화가 재사용된 ID로 생성됨
      const updatedWs = deps.workspaceStore.getWorkspace(workspace.workspaceId)!;
      const newConv = updatedWs.conversations[0];

      // ID가 재사용되었을 것임 (localId=1)
      expect(newConv.entityId).toBe(originalEntityId);

      // 하지만 이전 메시지가 없어야 함
      const messages = deps.messageStore.getMessages(newConv.entityId);
      expect(messages).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 엣지 케이스: 영속성 어댑터가 없는 경우
  // ==========================================================================

  describe('엣지 케이스', () => {
    it('should_handle_workspace_delete_without_persistence_adapter', () => {
      // Arrange: 영속성 어댑터 없음
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      deps.messageStore.addUserMessage(conversation.entityId, 'Hello');

      // Act: 워크스페이스 삭제 (영속성 어댑터 없음)
      pylon.handleMessage({
        type: 'workspace_delete',
        from: { deviceId: 'client-1' },
        payload: { workspaceId: workspace.workspaceId },
      });

      // Assert: 에러 없이 정상 처리 (메모리 캐시만 클리어)
      expect(deps.messageStore.getMessages(conversation.entityId)).toHaveLength(0);
    });

    it('should_handle_conversation_delete_without_persistence_adapter', () => {
      // Arrange: 영속성 어댑터 없음
      const { workspace } = deps.workspaceStore.createWorkspace('Test', 'C:\\test');
      const conversation = deps.workspaceStore.createConversation(workspace.workspaceId)!;
      deps.messageStore.addUserMessage(conversation.entityId, 'Hello');

      // Act: 대화 삭제 (영속성 어댑터 없음)
      pylon.handleMessage({
        type: 'conversation_delete',
        from: { deviceId: 'client-1' },
        payload: { entityId: conversation.entityId },
      });

      // Assert: 에러 없이 정상 처리 (메모리 캐시만 클리어)
      expect(deps.messageStore.getMessages(conversation.entityId)).toHaveLength(0);
    });
  });
});
