/**
 * @file in-memory-persistence.test.ts
 * @description InMemoryPersistence 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryPersistence } from '../../src/persistence/in-memory-persistence.js';
import type { WorkspaceStoreData } from '../../src/stores/workspace-store.js';
import type { SessionData } from '../../src/stores/message-store.js';

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

  describe('MessageSession', () => {
    const testSession: SessionData = {
      sessionId: 'session-1',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: Date.now(),
        },
      ],
      lastUpdated: Date.now(),
    };

    it('존재하지 않는 세션은 undefined 반환', () => {
      expect(persistence.loadMessageSession('nonexistent')).toBeUndefined();
    });

    it('saveMessageSession 후 loadMessageSession으로 조회', async () => {
      await persistence.saveMessageSession('session-1', testSession);

      const loaded = persistence.loadMessageSession('session-1');
      expect(loaded).toEqual(testSession);
    });

    it('listMessageSessions로 모든 세션 ID 조회', async () => {
      await persistence.saveMessageSession('session-1', testSession);
      await persistence.saveMessageSession('session-2', { ...testSession, sessionId: 'session-2' });

      const sessions = persistence.listMessageSessions();
      expect(sessions).toContain('session-1');
      expect(sessions).toContain('session-2');
      expect(sessions.length).toBe(2);
    });

    it('deleteMessageSession으로 세션 삭제', async () => {
      await persistence.saveMessageSession('session-1', testSession);
      expect(persistence.loadMessageSession('session-1')).toBeDefined();

      await persistence.deleteMessageSession('session-1');
      expect(persistence.loadMessageSession('session-1')).toBeUndefined();
    });

    it('setMessageSession으로 직접 설정', () => {
      persistence.setMessageSession('session-1', testSession);

      expect(persistence.getSessionCount()).toBe(1);
      expect(persistence.loadMessageSession('session-1')).toEqual(testSession);
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
      await persistence.saveMessageSession('session-1', {
        sessionId: 'session-1',
        messages: [],
        lastUpdated: Date.now(),
      });

      // 초기화
      persistence.clear();

      // 모두 비어있어야 함
      expect(persistence.hasWorkspaceStore()).toBe(false);
      expect(persistence.getSessionCount()).toBe(0);
    });
  });
});
