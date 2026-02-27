/**
 * @file in-memory-persistence.test.ts
 * @description InMemoryPersistence 테스트
 * 메시지는 SQLite MessageStore에서 관리되므로 여기서는 테스트하지 않습니다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryPersistence } from '../../src/persistence/in-memory-persistence.js';
import type { WorkspaceStoreData } from '../../src/stores/workspace-store.js';

describe('InMemoryPersistence', () => {
  let persistence: InMemoryPersistence;

  beforeEach(() => {
    persistence = new InMemoryPersistence();
  });

  describe('WorkspaceStore', () => {
    const testData: WorkspaceStoreData = {
      activeWorkspaceId: 'ws-1',
      activeConversationId: 'conv-1',
      workspaces: [
        {
          workspaceId: 'ws-1',
          name: 'Test Workspace',
          workingDir: '/test',
          conversations: [
            {
              conversationId: 'conv-1',
              name: 'Test Conversation',
              claudeSessionId: null,
              status: 'idle',
              unread: false,
              permissionMode: 'default',
              createdAt: Date.now(),
            },
          ],
        },
      ],
    };

    it('초기 상태에서는 undefined 반환', () => {
      expect(persistence.loadWorkspaceStore()).toBeUndefined();
    });

    it('saveWorkspaceStore 후 loadWorkspaceStore로 조회', async () => {
      await persistence.saveWorkspaceStore(testData);

      const loaded = persistence.loadWorkspaceStore();
      expect(loaded).toEqual(testData);
    });

    it('저장된 데이터는 깊은 복사로 격리됨', async () => {
      await persistence.saveWorkspaceStore(testData);

      // 원본 수정
      testData.activeWorkspaceId = 'modified';

      // 저장된 데이터는 변경되지 않음
      const loaded = persistence.loadWorkspaceStore();
      expect(loaded?.activeWorkspaceId).toBe('ws-1');
    });

    it('setWorkspaceStore로 직접 설정', () => {
      persistence.setWorkspaceStore(testData);

      expect(persistence.hasWorkspaceStore()).toBe(true);
      expect(persistence.loadWorkspaceStore()).toEqual(testData);
    });
  });

  describe('clear', () => {
    it('모든 데이터 초기화', async () => {
      // 데이터 저장
      await persistence.saveWorkspaceStore({
        activeWorkspaceId: 'ws-1',
        activeConversationId: null,
        workspaces: [],
      });

      // 초기화
      persistence.clear();

      // 모두 비어있어야 함
      expect(persistence.hasWorkspaceStore()).toBe(false);
    });
  });
});
