/**
 * @file workspace-store.test.ts
 * @description WorkspaceStore 테스트
 *
 * 워크스페이스 영속 저장 기능을 테스트합니다.
 * - workspaceId: number (1~127)
 * - entityId: EntityId (pylonId + workspaceId + localConvId 비트 팩)
 * - 삭제된 ID는 할당 시 검색으로 재사용
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkspaceStore,
  type WorkspaceStoreData,
} from '../../src/stores/workspace-store.js';
import {
  ConversationStatus,
  PermissionMode,
  encodeEntityId,
  decodeEntityId,
} from '@estelle/core';
import type { EntityId } from '@estelle/core';

const PYLON_ID = 1;

describe('WorkspaceStore', () => {
  let store: WorkspaceStore;

  beforeEach(() => {
    store = new WorkspaceStore(PYLON_ID);
  });

  // ============================================================================
  // 초기화 테스트
  // ============================================================================
  describe('초기화', () => {
    it('should have empty initial state', () => {
      expect(store.getActiveState().activeWorkspaceId).toBeNull();
      expect(store.getActiveState().activeConversationId).toBeNull();
      expect(store.getAllWorkspaces()).toHaveLength(0);
    });

    it('should initialize from existing data', () => {
      const entityId = encodeEntityId(PYLON_ID, 1, 1);
      const existingData: WorkspaceStoreData = {
        activeWorkspaceId: 1,
        activeConversationId: entityId,
        workspaces: [
          {
            workspaceId: 1,
            name: 'Test Workspace',
            workingDir: 'C:\\test',
            conversations: [
              {
                entityId,
                name: 'Test Conversation',
                claudeSessionId: null,
                status: ConversationStatus.IDLE,
                unread: false,
                permissionMode: PermissionMode.DEFAULT,
                createdAt: Date.now(),
              },
            ],
            createdAt: Date.now(),
            lastUsed: Date.now(),
          },
        ],
      };

      const loadedStore = new WorkspaceStore(PYLON_ID, existingData);

      expect(loadedStore.getAllWorkspaces()).toHaveLength(1);
      expect(loadedStore.getActiveState().activeWorkspaceId).toBe(1);
    });
  });

  // ============================================================================
  // Workspace CRUD 테스트
  // ============================================================================
  describe('Workspace CRUD', () => {
    describe('createWorkspace', () => {
      it('should create workspace with first conversation', () => {
        const result = store.createWorkspace('New Workspace', 'C:\\workspace');

        expect(result.workspace.name).toBe('New Workspace');
        expect(result.workspace.workingDir).toBe('C:\\workspace');
        expect(result.workspace.conversations).toHaveLength(1);
        expect(result.conversation.name).toBe('새 대화');
        expect(result.conversation.status).toBe(ConversationStatus.IDLE);
      });

      it('should assign numeric workspaceId starting from 1', () => {
        const result = store.createWorkspace('WS1', 'C:\\ws1');

        expect(result.workspace.workspaceId).toBe(1);
        expect(typeof result.workspace.workspaceId).toBe('number');
      });

      it('should assign entityId with correct encoding', () => {
        const result = store.createWorkspace('WS1', 'C:\\ws1');
        const expected = encodeEntityId(PYLON_ID, 1, 1);

        expect(result.conversation.entityId).toBe(expected);
        expect(typeof result.conversation.entityId).toBe('number');
      });

      it('should set new workspace as active', () => {
        const result = store.createWorkspace('New Workspace', 'C:\\workspace');

        expect(store.getActiveState().activeWorkspaceId).toBe(
          result.workspace.workspaceId
        );
        expect(store.getActiveState().activeConversationId).toBe(
          result.conversation.entityId
        );
      });

      it('should generate sequential workspace IDs', () => {
        const result1 = store.createWorkspace('WS1', 'C:\\ws1');
        const result2 = store.createWorkspace('WS2', 'C:\\ws2');

        expect(result1.workspace.workspaceId).toBe(1);
        expect(result2.workspace.workspaceId).toBe(2);
      });

      it('should generate unique entityIds across workspaces', () => {
        const result1 = store.createWorkspace('WS1', 'C:\\ws1');
        const result2 = store.createWorkspace('WS2', 'C:\\ws2');

        // 다른 워크스페이스의 첫 대화는 서로 다른 entityId를 가짐
        expect(result1.conversation.entityId).not.toBe(result2.conversation.entityId);

        // 각각 올바른 워크스페이스에 속함
        const decoded1 = decodeEntityId(result1.conversation.entityId);
        const decoded2 = decodeEntityId(result2.conversation.entityId);
        expect(decoded1.workspaceId).toBe(1);
        expect(decoded2.workspaceId).toBe(2);
        // 둘 다 로컬 ID는 1
        expect(decoded1.conversationId).toBe(1);
        expect(decoded2.conversationId).toBe(1);
      });

      it('should use default working directory if not provided', () => {
        const result = store.createWorkspace('Test');

        expect(result.workspace.workingDir).toBeDefined();
        expect(typeof result.workspace.workingDir).toBe('string');
      });
    });

    describe('getWorkspace', () => {
      it('should return workspace by numeric ID', () => {
        const { workspace } = store.createWorkspace('Test', 'C:\\test');

        const found = store.getWorkspace(workspace.workspaceId);

        expect(found).not.toBeNull();
        expect(found?.name).toBe('Test');
      });

      it('should return null for non-existent workspace', () => {
        const found = store.getWorkspace(999);

        expect(found).toBeNull();
      });
    });

    describe('getAllWorkspaces', () => {
      it('should return all workspaces with isActive flag', () => {
        store.createWorkspace('WS1', 'C:\\ws1');
        const { workspace: ws2 } = store.createWorkspace('WS2', 'C:\\ws2');

        const workspaces = store.getAllWorkspaces();

        expect(workspaces).toHaveLength(2);
        const activeWs = workspaces.find((w) => w.isActive);
        expect(activeWs?.workspaceId).toBe(ws2.workspaceId);
      });
    });

    describe('getActiveWorkspace', () => {
      it('should return active workspace', () => {
        const { workspace } = store.createWorkspace('Active', 'C:\\active');

        const active = store.getActiveWorkspace();

        expect(active).not.toBeNull();
        expect(active?.workspaceId).toBe(workspace.workspaceId);
      });

      it('should return null when no active workspace', () => {
        const active = store.getActiveWorkspace();

        expect(active).toBeNull();
      });
    });

    describe('renameWorkspace', () => {
      it('should rename workspace', () => {
        const { workspace } = store.createWorkspace('Old Name', 'C:\\test');

        const result = store.renameWorkspace(workspace.workspaceId, 'New Name');

        expect(result).toBe(true);
        expect(store.getWorkspace(workspace.workspaceId)?.name).toBe('New Name');
      });

      it('should return false for non-existent workspace', () => {
        const result = store.renameWorkspace(999, 'New Name');

        expect(result).toBe(false);
      });
    });

    describe('updateWorkspace', () => {
      it('should update name when only name provided', () => {
        const { workspace } = store.createWorkspace('Old Name', 'C:\\test');

        const result = store.updateWorkspace(workspace.workspaceId, { name: 'New Name' });

        expect(result).toBe(true);
        const updated = store.getWorkspace(workspace.workspaceId);
        expect(updated?.name).toBe('New Name');
        expect(updated?.workingDir).toBe('C:\\test');
      });

      it('should update workingDir when only workingDir provided', () => {
        const { workspace } = store.createWorkspace('Test', 'C:\\old');

        const result = store.updateWorkspace(workspace.workspaceId, { workingDir: 'C:\\new' });

        expect(result).toBe(true);
        const updated = store.getWorkspace(workspace.workspaceId);
        expect(updated?.name).toBe('Test');
        expect(updated?.workingDir).toBe('C:\\new');
      });

      it('should update both name and workingDir when both provided', () => {
        const { workspace } = store.createWorkspace('Old Name', 'C:\\old');

        const result = store.updateWorkspace(workspace.workspaceId, {
          name: 'New Name',
          workingDir: 'C:\\new',
        });

        expect(result).toBe(true);
        const updated = store.getWorkspace(workspace.workspaceId);
        expect(updated?.name).toBe('New Name');
        expect(updated?.workingDir).toBe('C:\\new');
      });

      it('should return false when workspace not found', () => {
        const result = store.updateWorkspace(999, { name: 'Test' });

        expect(result).toBe(false);
      });

      it('should return false when no updates provided', () => {
        const { workspace } = store.createWorkspace('Test', 'C:\\test');

        const result = store.updateWorkspace(workspace.workspaceId, {});

        expect(result).toBe(false);
      });

      it('should trim whitespace from name', () => {
        const { workspace } = store.createWorkspace('Old', 'C:\\test');

        const result = store.updateWorkspace(workspace.workspaceId, { name: '  New Name  ' });

        expect(result).toBe(true);
        const updated = store.getWorkspace(workspace.workspaceId);
        expect(updated?.name).toBe('New Name');
      });

      it('should return false when name is empty after trim', () => {
        const { workspace } = store.createWorkspace('Test', 'C:\\test');

        const result = store.updateWorkspace(workspace.workspaceId, { name: '   ' });

        expect(result).toBe(false);
        const updated = store.getWorkspace(workspace.workspaceId);
        expect(updated?.name).toBe('Test');
      });

      it('should update lastUsed timestamp', () => {
        const { workspace } = store.createWorkspace('Test', 'C:\\test');
        const originalLastUsed = workspace.lastUsed;

        const result = store.updateWorkspace(workspace.workspaceId, { name: 'Updated' });

        expect(result).toBe(true);
        const updated = store.getWorkspace(workspace.workspaceId);
        expect(updated?.lastUsed).toBeGreaterThanOrEqual(originalLastUsed);
      });

      it('should normalize workingDir path', () => {
        const { workspace } = store.createWorkspace('Test', 'C:\\test');

        const result = store.updateWorkspace(workspace.workspaceId, { workingDir: 'C:/new/path' });

        expect(result).toBe(true);
        const updated = store.getWorkspace(workspace.workspaceId);
        expect(updated?.workingDir).toBeDefined();
      });
    });

    describe('deleteWorkspace', () => {
      it('should delete workspace', () => {
        const { workspace } = store.createWorkspace('ToDelete', 'C:\\delete');

        const result = store.deleteWorkspace(workspace.workspaceId);

        expect(result).toBe(true);
        expect(store.getWorkspace(workspace.workspaceId)).toBeNull();
      });

      it('should switch to next workspace when deleting active', () => {
        const { workspace: ws1 } = store.createWorkspace('WS1', 'C:\\ws1');
        const { workspace: ws2 } = store.createWorkspace('WS2', 'C:\\ws2');

        store.deleteWorkspace(ws2.workspaceId);

        expect(store.getActiveState().activeWorkspaceId).toBe(ws1.workspaceId);
      });

      it('should set null when deleting last workspace', () => {
        const { workspace } = store.createWorkspace('Only', 'C:\\only');

        store.deleteWorkspace(workspace.workspaceId);

        expect(store.getActiveState().activeWorkspaceId).toBeNull();
        expect(store.getActiveState().activeConversationId).toBeNull();
      });

      it('should return false for non-existent workspace', () => {
        const result = store.deleteWorkspace(999);

        expect(result).toBe(false);
      });
    });

    describe('setActiveWorkspace', () => {
      it('should set active workspace and conversation', () => {
        const { workspace: ws1 } = store.createWorkspace('WS1', 'C:\\ws1');
        store.createWorkspace('WS2', 'C:\\ws2');

        const result = store.setActiveWorkspace(ws1.workspaceId);

        expect(result).toBe(true);
        expect(store.getActiveState().activeWorkspaceId).toBe(ws1.workspaceId);
      });

      it('should set specific conversation when provided', () => {
        const { workspace } = store.createWorkspace('WS', 'C:\\ws');
        const conv = store.createConversation(workspace.workspaceId, 'New Conv');

        store.setActiveWorkspace(workspace.workspaceId, conv!.entityId);

        expect(store.getActiveState().activeConversationId).toBe(conv!.entityId);
      });

      it('should update lastUsed timestamp', () => {
        const { workspace } = store.createWorkspace('WS', 'C:\\ws');
        const originalLastUsed = workspace.lastUsed;

        store.setActiveWorkspace(workspace.workspaceId);

        const updated = store.getWorkspace(workspace.workspaceId);
        expect(updated?.lastUsed).toBeGreaterThanOrEqual(originalLastUsed);
      });

      it('should return false for non-existent workspace', () => {
        const result = store.setActiveWorkspace(999);

        expect(result).toBe(false);
      });
    });

    describe('reorderWorkspaces', () => {
      it('should reorder workspaces', () => {
        const { workspace: ws1 } = store.createWorkspace('WS1', 'C:\\ws1');
        const { workspace: ws2 } = store.createWorkspace('WS2', 'C:\\ws2');

        const result = store.reorderWorkspaces([ws2.workspaceId, ws1.workspaceId]);

        expect(result).toBe(true);
        const all = store.getAllWorkspaces();
        expect(all[0].workspaceId).toBe(ws2.workspaceId);
        expect(all[1].workspaceId).toBe(ws1.workspaceId);
      });

      it('should return false for invalid IDs', () => {
        store.createWorkspace('WS1', 'C:\\ws1');

        const result = store.reorderWorkspaces([999]);

        expect(result).toBe(false);
      });
    });

    describe('reorderConversations', () => {
      it('should reorder conversations within workspace', () => {
        const { workspace, conversation: conv1 } = store.createWorkspace('WS', 'C:\\ws');
        const conv2 = store.createConversation(workspace.workspaceId, 'Conv2')!;

        const result = store.reorderConversations(
          workspace.workspaceId,
          [conv2.entityId, conv1.entityId]
        );

        expect(result).toBe(true);
        const ws = store.getWorkspace(workspace.workspaceId)!;
        expect(ws.conversations[0].entityId).toBe(conv2.entityId);
        expect(ws.conversations[1].entityId).toBe(conv1.entityId);
      });

      it('should return false for invalid workspace', () => {
        const fakeEid = 999999 as EntityId;
        const result = store.reorderConversations(999, [fakeEid]);

        expect(result).toBe(false);
      });
    });
  });

  // ============================================================================
  // Conversation CRUD 테스트
  // ============================================================================
  describe('Conversation CRUD', () => {
    let workspaceId: number;

    beforeEach(() => {
      const { workspace } = store.createWorkspace('Test', 'C:\\test');
      workspaceId = workspace.workspaceId;
    });

    describe('createConversation', () => {
      it('should create conversation with default name', () => {
        const conv = store.createConversation(workspaceId);

        expect(conv).not.toBeNull();
        expect(conv?.name).toBe('새 대화');
        expect(conv?.status).toBe(ConversationStatus.IDLE);
        expect(conv?.unread).toBe(false);
        expect(conv?.permissionMode).toBe(PermissionMode.DEFAULT);
      });

      it('should create conversation with custom name', () => {
        const conv = store.createConversation(workspaceId, 'Custom Name');

        expect(conv?.name).toBe('Custom Name');
      });

      it('should assign sequential local IDs (via entityId decoding)', () => {
        // 첫 대화는 워크스페이스 생성 시 자동 생성 (localId=1)
        const conv2 = store.createConversation(workspaceId, 'Conv2');
        const conv3 = store.createConversation(workspaceId, 'Conv3');

        expect(decodeEntityId(conv2!.entityId).conversationId).toBe(2);
        expect(decodeEntityId(conv3!.entityId).conversationId).toBe(3);
      });

      it('should set new conversation as active', () => {
        const conv = store.createConversation(workspaceId, 'New');

        expect(store.getActiveState().activeConversationId).toBe(conv?.entityId);
      });

      it('should return null for non-existent workspace', () => {
        const conv = store.createConversation(999);

        expect(conv).toBeNull();
      });
    });

    describe('getConversation', () => {
      it('should return conversation by entityId', () => {
        const conv = store.createConversation(workspaceId, 'Test');

        const found = store.getConversation(conv!.entityId);

        expect(found).not.toBeNull();
        expect(found?.name).toBe('Test');
      });

      it('should return null for non-existent conversation', () => {
        const fakeId = encodeEntityId(PYLON_ID, workspaceId, 999);
        const found = store.getConversation(fakeId);

        expect(found).toBeNull();
      });
    });

    describe('getActiveConversation', () => {
      it('should return active conversation', () => {
        const conv = store.createConversation(workspaceId, 'Active');

        const active = store.getActiveConversation();

        expect(active).not.toBeNull();
        expect(active?.entityId).toBe(conv?.entityId);
      });

      it('should return null when no active conversation', () => {
        const emptyStore = new WorkspaceStore(PYLON_ID);

        const active = emptyStore.getActiveConversation();

        expect(active).toBeNull();
      });
    });

    describe('renameConversation', () => {
      it('should rename conversation', () => {
        const conv = store.createConversation(workspaceId, 'Old');

        const result = store.renameConversation(conv!.entityId, 'New');

        expect(result).toBe(true);
        const updated = store.getConversation(conv!.entityId);
        expect(updated?.name).toBe('New');
      });

      it('should return false for non-existent conversation', () => {
        const fakeId = encodeEntityId(PYLON_ID, workspaceId, 999);
        const result = store.renameConversation(fakeId, 'New');

        expect(result).toBe(false);
      });
    });

    describe('deleteConversation', () => {
      it('should delete conversation', () => {
        const conv = store.createConversation(workspaceId, 'ToDelete');

        const result = store.deleteConversation(conv!.entityId);

        expect(result).toBe(true);
        expect(store.getConversation(conv!.entityId)).toBeNull();
      });

      it('should switch active conversation when deleting active', () => {
        const workspace = store.getWorkspace(workspaceId);
        const firstConv = workspace!.conversations[0];
        const secondConv = store.createConversation(workspaceId, 'Second');

        store.deleteConversation(secondConv!.entityId);

        expect(store.getActiveState().activeConversationId).toBe(firstConv.entityId);
      });

      it('should return false for non-existent conversation', () => {
        const fakeId = encodeEntityId(PYLON_ID, workspaceId, 999);
        const result = store.deleteConversation(fakeId);

        expect(result).toBe(false);
      });
    });

    describe('setActiveConversation', () => {
      it('should set active conversation', () => {
        const workspace = store.getWorkspace(workspaceId);
        const firstConv = workspace!.conversations[0];
        store.createConversation(workspaceId, 'Second');

        const result = store.setActiveConversation(firstConv.entityId);

        expect(result).toBe(true);
        expect(store.getActiveState().activeConversationId).toBe(firstConv.entityId);
      });
    });
  });

  // ============================================================================
  // Conversation 상태 업데이트 테스트
  // ============================================================================
  describe('Conversation 상태 업데이트', () => {
    let entityId: EntityId;

    beforeEach(() => {
      const { conversation } = store.createWorkspace('Test', 'C:\\test');
      entityId = conversation.entityId;
    });

    describe('updateConversationStatus', () => {
      it('should update status', () => {
        const result = store.updateConversationStatus(entityId, ConversationStatus.WORKING);

        expect(result).toBe(true);
        const conv = store.getConversation(entityId);
        expect(conv?.status).toBe(ConversationStatus.WORKING);
      });

      it('should return false for non-existent conversation', () => {
        const fakeId = encodeEntityId(PYLON_ID, 1, 999);
        const result = store.updateConversationStatus(fakeId, ConversationStatus.WORKING);

        expect(result).toBe(false);
      });
    });

    describe('updateConversationUnread', () => {
      it('should update unread flag', () => {
        const result = store.updateConversationUnread(entityId, true);

        expect(result).toBe(true);
        const conv = store.getConversation(entityId);
        expect(conv?.unread).toBe(true);
      });
    });

    describe('updateClaudeSessionId', () => {
      it('should update claude session ID', () => {
        const sessionId = 'session-123';

        const result = store.updateClaudeSessionId(entityId, sessionId);

        expect(result).toBe(true);
        const conv = store.getConversation(entityId);
        expect(conv?.claudeSessionId).toBe(sessionId);
      });

      it('should update workspace lastUsed', () => {
        const { workspaceId } = decodeEntityId(entityId);
        const workspace = store.getWorkspace(workspaceId);
        const originalLastUsed = workspace!.lastUsed;

        store.updateClaudeSessionId(entityId, 'session-123');

        const updated = store.getWorkspace(workspaceId);
        expect(updated?.lastUsed).toBeGreaterThanOrEqual(originalLastUsed);
      });
    });
  });

  // ============================================================================
  // Permission Mode 테스트
  // ============================================================================
  describe('Permission Mode', () => {
    let entityId: EntityId;

    beforeEach(() => {
      const { conversation } = store.createWorkspace('Test', 'C:\\test');
      entityId = conversation.entityId;
    });

    describe('getConversationPermissionMode', () => {
      it('should return default permission mode', () => {
        const mode = store.getConversationPermissionMode(entityId);

        expect(mode).toBe(PermissionMode.DEFAULT);
      });

      it('should return default for non-existent conversation', () => {
        const fakeId = encodeEntityId(PYLON_ID, 1, 999);
        const mode = store.getConversationPermissionMode(fakeId);

        expect(mode).toBe(PermissionMode.DEFAULT);
      });
    });

    describe('setConversationPermissionMode', () => {
      it('should set permission mode', () => {
        const result = store.setConversationPermissionMode(
          entityId,
          PermissionMode.ACCEPT_EDITS
        );

        expect(result).toBe(true);
        expect(store.getConversationPermissionMode(entityId)).toBe(
          PermissionMode.ACCEPT_EDITS
        );
      });

      it('should return false for non-existent conversation', () => {
        const fakeId = encodeEntityId(PYLON_ID, 1, 999);
        const result = store.setConversationPermissionMode(fakeId, PermissionMode.BYPASS);

        expect(result).toBe(false);
      });
    });
  });

  // ============================================================================
  // Utility 메서드 테스트
  // ============================================================================
  describe('Utility 메서드', () => {
    describe('findWorkspaceByName', () => {
      it('should find workspace by exact name (case-insensitive)', () => {
        store.createWorkspace('MyWorkspace', 'C:\\ws');

        const found = store.findWorkspaceByName('myworkspace');

        expect(found).not.toBeNull();
        expect(found?.name).toBe('MyWorkspace');
      });

      it('should find workspace by partial name', () => {
        store.createWorkspace('My Long Workspace Name', 'C:\\ws');

        const found = store.findWorkspaceByName('Long');

        expect(found).not.toBeNull();
        expect(found?.name).toBe('My Long Workspace Name');
      });

      it('should return null for no match', () => {
        store.createWorkspace('Workspace', 'C:\\ws');

        const found = store.findWorkspaceByName('NotExist');

        expect(found).toBeNull();
      });
    });

    describe('findWorkspaceByWorkingDir', () => {
      it('should find workspace by working directory', () => {
        store.createWorkspace('Test', 'C:\\test\\project');

        const found = store.findWorkspaceByWorkingDir('C:\\test\\project');

        expect(found).not.toBeNull();
        expect(found?.name).toBe('Test');
      });

      it('should return null for no match', () => {
        store.createWorkspace('Test', 'C:\\test');

        const found = store.findWorkspaceByWorkingDir('C:\\other');

        expect(found).toBeNull();
      });
    });

    describe('getActiveState', () => {
      it('should return active IDs as numbers', () => {
        const { workspace, conversation } = store.createWorkspace('Test', 'C:\\test');

        const state = store.getActiveState();

        expect(state.activeWorkspaceId).toBe(workspace.workspaceId);
        expect(state.activeConversationId).toBe(conversation.entityId);
        expect(typeof state.activeWorkspaceId).toBe('number');
        expect(typeof state.activeConversationId).toBe('number');
      });
    });
  });

  // ============================================================================
  // 상태 초기화 테스트
  // ============================================================================
  describe('상태 초기화', () => {
    describe('resetActiveConversations', () => {
      it('should reset working status to idle and return entityIds', () => {
        const { conversation } = store.createWorkspace('Test', 'C:\\test');
        store.updateConversationStatus(conversation.entityId, ConversationStatus.WORKING);

        const resetIds = store.resetActiveConversations();

        expect(resetIds).toContain(conversation.entityId);
        const conv = store.getConversation(conversation.entityId);
        expect(conv?.status).toBe(ConversationStatus.IDLE);
      });

      it('should not reset idle status', () => {
        const { conversation } = store.createWorkspace('Test', 'C:\\test');

        const resetIds = store.resetActiveConversations();

        expect(resetIds).not.toContain(conversation.entityId);
      });

      it('should reset waiting status to idle', () => {
        const { conversation } = store.createWorkspace('Test', 'C:\\test');
        store.updateConversationStatus(conversation.entityId, ConversationStatus.WAITING);

        const resetIds = store.resetActiveConversations();

        expect(resetIds).toContain(conversation.entityId);
        const conv = store.getConversation(conversation.entityId);
        expect(conv?.status).toBe(ConversationStatus.IDLE);
      });
    });
  });

  // ============================================================================
  // 데이터 직렬화 테스트
  // ============================================================================
  describe('데이터 직렬화', () => {
    describe('toJSON', () => {
      it('should export all data with numeric IDs', () => {
        store.createWorkspace('WS1', 'C:\\ws1');
        store.createWorkspace('WS2', 'C:\\ws2');

        const data = store.toJSON();

        expect(data.workspaces).toHaveLength(2);
        expect(typeof data.activeWorkspaceId).toBe('number');
        expect(typeof data.activeConversationId).toBe('number');
        expect(typeof data.workspaces[0].workspaceId).toBe('number');
        expect(typeof data.workspaces[0].conversations[0].entityId).toBe('number');
      });
    });

    describe('fromJSON', () => {
      it('should restore from exported data', () => {
        store.createWorkspace('Test', 'C:\\test');
        const exported = store.toJSON();

        const restored = WorkspaceStore.fromJSON(PYLON_ID, exported);

        expect(restored.getAllWorkspaces()).toHaveLength(1);
        expect(restored.getAllWorkspaces()[0].name).toBe('Test');
      });

      it('should preserve entityIds after restore', () => {
        const { workspace, conversation } = store.createWorkspace('Test', 'C:\\test');
        const exported = store.toJSON();

        const restored = WorkspaceStore.fromJSON(PYLON_ID, exported);

        expect(restored.getActiveState().activeWorkspaceId).toBe(workspace.workspaceId);
        expect(restored.getActiveState().activeConversationId).toBe(conversation.entityId);
      });
    });
  });

  // ============================================================================
  // ID 할당 및 재사용 테스트
  // ============================================================================
  describe('ID 할당 및 재사용', () => {
    describe('워크스페이스 ID 재사용', () => {
      it('should reuse deleted workspace ID', () => {
        const { workspace: ws1 } = store.createWorkspace('WS1', 'C:\\ws1');
        store.createWorkspace('WS2', 'C:\\ws2');
        store.createWorkspace('WS3', 'C:\\ws3');

        expect(ws1.workspaceId).toBe(1);

        store.deleteWorkspace(1);

        const { workspace: ws4 } = store.createWorkspace('WS4', 'C:\\ws4');
        expect(ws4.workspaceId).toBe(1);
      });

      it('should reuse smallest available workspace ID', () => {
        store.createWorkspace('WS1', 'C:\\ws1');
        store.createWorkspace('WS2', 'C:\\ws2');
        store.createWorkspace('WS3', 'C:\\ws3');

        store.deleteWorkspace(1);
        store.deleteWorkspace(3);

        const { workspace } = store.createWorkspace('WS4', 'C:\\ws4');
        expect(workspace.workspaceId).toBe(1);

        const { workspace: ws5 } = store.createWorkspace('WS5', 'C:\\ws5');
        expect(ws5.workspaceId).toBe(3);

        const { workspace: ws6 } = store.createWorkspace('WS6', 'C:\\ws6');
        expect(ws6.workspaceId).toBe(4);
      });
    });

    describe('대화 ID 재사용', () => {
      it('should reuse deleted conversation local ID within workspace', () => {
        const { workspace } = store.createWorkspace('WS', 'C:\\ws');
        const conv2 = store.createConversation(workspace.workspaceId, 'Conv2')!;
        store.createConversation(workspace.workspaceId, 'Conv3');

        expect(decodeEntityId(conv2.entityId).conversationId).toBe(2);

        store.deleteConversation(conv2.entityId);

        const conv4 = store.createConversation(workspace.workspaceId, 'Conv4')!;
        expect(decodeEntityId(conv4.entityId).conversationId).toBe(2);
      });

      it('should reuse smallest available conversation local ID', () => {
        const { workspace, conversation: conv1 } = store.createWorkspace('WS', 'C:\\ws');
        store.createConversation(workspace.workspaceId, 'Conv2');
        store.createConversation(workspace.workspaceId, 'Conv3');

        // 1과 3 삭제
        store.deleteConversation(conv1.entityId);
        const ws = store.getWorkspace(workspace.workspaceId)!;
        const conv3 = ws.conversations.find(
          (c) => decodeEntityId(c.entityId).conversationId === 3
        )!;
        store.deleteConversation(conv3.entityId);

        const c1 = store.createConversation(workspace.workspaceId, 'New1')!;
        expect(decodeEntityId(c1.entityId).conversationId).toBe(1);

        const c2 = store.createConversation(workspace.workspaceId, 'New2')!;
        expect(decodeEntityId(c2.entityId).conversationId).toBe(3);

        const c3 = store.createConversation(workspace.workspaceId, 'New3')!;
        expect(decodeEntityId(c3.entityId).conversationId).toBe(4);
      });

      it('should have unique entityIds across workspaces even with same local IDs', () => {
        const { workspace: ws1 } = store.createWorkspace('WS1', 'C:\\ws1');
        const { workspace: ws2 } = store.createWorkspace('WS2', 'C:\\ws2');

        const conv1a = store.createConversation(ws1.workspaceId, 'Conv1A')!;
        const conv2a = store.createConversation(ws2.workspaceId, 'Conv2A')!;

        // 로컬 ID는 둘 다 2이지만 entityId는 다름
        expect(decodeEntityId(conv1a.entityId).conversationId).toBe(2);
        expect(decodeEntityId(conv2a.entityId).conversationId).toBe(2);
        expect(conv1a.entityId).not.toBe(conv2a.entityId);
      });
    });

    describe('직렬화 후 ID 할당 연속성', () => {
      it('should allocate correct IDs after fromJSON restore', () => {
        store.createWorkspace('WS1', 'C:\\ws1');
        store.createWorkspace('WS2', 'C:\\ws2');

        const restored = WorkspaceStore.fromJSON(PYLON_ID, store.toJSON());

        const { workspace: ws3 } = restored.createWorkspace('WS3', 'C:\\ws3');
        expect(ws3.workspaceId).toBe(3);
      });

      it('should detect gaps after fromJSON restore', () => {
        store.createWorkspace('WS1', 'C:\\ws1');
        store.createWorkspace('WS2', 'C:\\ws2');
        store.createWorkspace('WS3', 'C:\\ws3');
        store.deleteWorkspace(2);

        const restored = WorkspaceStore.fromJSON(PYLON_ID, store.toJSON());

        const { workspace } = restored.createWorkspace('WS4', 'C:\\ws4');
        expect(workspace.workspaceId).toBe(2);
      });
    });
  });
});
