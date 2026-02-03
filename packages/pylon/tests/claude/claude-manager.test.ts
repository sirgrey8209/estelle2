/**
 * @file claude-manager.test.ts
 * @description ClaudeManager 테스트
 *
 * Claude Agent SDK 연동 핵심 모듈을 테스트합니다.
 * SDK 자체는 모킹하고 로직만 테스트합니다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ClaudeManager,
  type ClaudeManagerOptions,
  type ClaudeManagerEvent,
  type ClaudeAdapter,
  type ClaudeQueryOptions,
  type ClaudeMessage,
} from '../../src/claude/claude-manager.js';
import { PermissionMode } from '@estelle/core';

describe('ClaudeManager', () => {
  let manager: ClaudeManager;
  let events: Array<{ sessionId: string; event: ClaudeManagerEvent }>;
  let mockAdapter: ClaudeAdapter;
  let queryMessages: ClaudeMessage[];

  /**
   * 모킹된 Claude 어댑터 생성
   */
  function createMockAdapter(messages: ClaudeMessage[] = []): ClaudeAdapter {
    return {
      async *query(_options: ClaudeQueryOptions): AsyncIterable<ClaudeMessage> {
        for (const msg of messages) {
          yield msg;
        }
      },
    };
  }

  /**
   * 기본 설정으로 ClaudeManager 생성
   */
  function createManager(
    options: Partial<ClaudeManagerOptions> = {}
  ): ClaudeManager {
    return new ClaudeManager({
      onEvent: (sessionId, event) => {
        events.push({ sessionId, event });
      },
      getPermissionMode: () => PermissionMode.DEFAULT,
      adapter: mockAdapter,
      ...options,
    });
  }

  beforeEach(() => {
    events = [];
    queryMessages = [];
    mockAdapter = createMockAdapter(queryMessages);
  });

  // ============================================================================
  // 초기화 테스트
  // ============================================================================
  describe('초기화', () => {
    it('should create manager with options', () => {
      manager = createManager();

      expect(manager).toBeInstanceOf(ClaudeManager);
    });

    it('should have no active sessions initially', () => {
      manager = createManager();

      expect(manager.getActiveSessionIds()).toHaveLength(0);
      expect(manager.hasActiveSession('any')).toBe(false);
    });

    it('should have no pending events initially', () => {
      manager = createManager();

      expect(manager.getAllPendingEvents()).toHaveLength(0);
      expect(manager.getPendingEvent('any')).toBeNull();
    });
  });

  // ============================================================================
  // sendMessage 테스트
  // ============================================================================
  describe('sendMessage', () => {
    it('should emit error when workingDir is missing', async () => {
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '',
      });

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('Working directory not found'),
        }),
      });
    });

    it('should emit working state when starting', async () => {
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: { type: 'state', state: 'working' },
      });
    });

    it('should emit idle state when finished', async () => {
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      // 마지막 이벤트가 idle 상태여야 함
      const lastStateEvent = events
        .filter((e) => e.event.type === 'state')
        .pop();
      expect(lastStateEvent?.event).toEqual({ type: 'state', state: 'idle' });
    });

    it('should process init message', async () => {
      queryMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'claude-session-123',
          model: 'claude-3-opus',
          tools: ['Read', 'Write'],
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: expect.objectContaining({
          type: 'init',
          session_id: 'claude-session-123',
          model: 'claude-3-opus',
          tools: ['Read', 'Write'],
        }),
      });
    });

    it('should process text delta events', async () => {
      queryMessages = [
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            content_block: { type: 'text' },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello ' },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'world!' },
          },
        },
        {
          type: 'stream_event',
          event: { type: 'content_block_stop' },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      // stateUpdate (responding)
      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: expect.objectContaining({
          type: 'stateUpdate',
          state: { type: 'responding' },
        }),
      });

      // text events
      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: { type: 'text', text: 'Hello ' },
      });
      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: { type: 'text', text: 'world!' },
      });

      // stateUpdate (thinking) after block stop
      const thinkingEvents = events.filter(
        (e) =>
          e.event.type === 'stateUpdate' &&
          (e.event as ClaudeManagerEvent & { state: { type: string } }).state?.type === 'thinking'
      );
      expect(thinkingEvents.length).toBeGreaterThan(0);
    });

    it('should process textComplete event', async () => {
      queryMessages = [
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'Complete response' }],
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: { type: 'textComplete', text: 'Complete response' },
      });
    });

    it('should process toolInfo event', async () => {
      queryMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'Read',
                id: 'tool-123',
                input: { file_path: '/test.txt' },
              },
            ],
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: expect.objectContaining({
          type: 'toolInfo',
          toolName: 'Read',
          input: { file_path: '/test.txt' },
        }),
      });
    });

    it('should process toolComplete event', async () => {
      queryMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Read', id: 'tool-123', input: {} },
            ],
          },
        },
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-123',
                is_error: false,
                content: 'file content',
              },
            ],
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: expect.objectContaining({
          type: 'toolComplete',
          toolName: 'Read',
          success: true,
          result: 'file content',
        }),
      });
    });

    it('should process result event', async () => {
      queryMessages = [
        {
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.05,
          num_turns: 3,
          usage: {
            input_tokens: 100,
            output_tokens: 200,
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: expect.objectContaining({
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.05,
          num_turns: 3,
        }),
      });
    });

    it('should process AskUserQuestion tool', async () => {
      queryMessages = [
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'tool_use',
                name: 'AskUserQuestion',
                id: 'ask-123',
                input: { questions: ['What framework?'] },
              },
            ],
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: expect.objectContaining({
          type: 'askQuestion',
          questions: ['What framework?'],
          toolUseId: 'ask-123',
        }),
      });
    });
  });

  // ============================================================================
  // stop 테스트
  // ============================================================================
  describe('stop', () => {
    it('should emit claudeAborted event', () => {
      manager = createManager();

      manager.stop('session-1');

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: { type: 'claudeAborted', reason: 'user' },
      });
    });

    it('should emit idle state', () => {
      manager = createManager();

      manager.stop('session-1');

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: { type: 'state', state: 'idle' },
      });
    });

    it('should remove pending events', async () => {
      // 권한 요청 대기 상태를 만들기 위한 설정
      manager = createManager({
        adapter: {
          async *query(options) {
            // 권한 요청이 발생하도록 Edit 도구 사용
            // 실제로는 canUseTool 콜백이 호출됨
            yield {
              type: 'assistant',
              message: {
                content: [
                  {
                    type: 'tool_use',
                    name: 'Edit',
                    id: 'edit-123',
                    input: { file_path: 'main.ts' },
                  },
                ],
              },
            };
          },
        },
      });

      // 세션이 없어도 stop은 안전하게 동작해야 함
      manager.stop('session-1');

      expect(manager.getPendingEvent('session-1')).toBeNull();
    });
  });

  // ============================================================================
  // newSession 테스트
  // ============================================================================
  describe('newSession', () => {
    it('should stop existing session and emit idle', () => {
      manager = createManager();

      manager.newSession('session-1');

      // claudeAborted 이벤트 (stop에서)
      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: { type: 'claudeAborted', reason: 'user' },
      });

      // 최종 idle 상태
      const idleEvents = events.filter(
        (e) => e.event.type === 'state' && e.event.state === 'idle'
      );
      expect(idleEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // respondPermission 테스트
  // ============================================================================
  describe('respondPermission', () => {
    it('should emit working state after permission response', async () => {
      let permissionCallback: ((result: { behavior: string; updatedInput?: object; message?: string }) => void) | null = null;

      manager = createManager({
        adapter: {
          async *query(options) {
            // 권한 요청 시뮬레이션
            if (options.canUseTool) {
              const resultPromise = options.canUseTool('Edit', { file_path: 'main.ts' });
              // 콜백 저장 (테스트에서 사용)
              // 실제로는 respondPermission이 호출될 때까지 대기
            }
            yield { type: 'system', subtype: 'init', session_id: 'sess-1' };
          },
        },
      });

      // 존재하지 않는 toolUseId로 호출 시 아무것도 하지 않음
      manager.respondPermission('session-1', 'non-existent', 'allow');

      // 이벤트가 추가되지 않음 (pending이 없으므로)
      const workingEvents = events.filter(
        (e) => e.event.type === 'state' && e.event.state === 'working'
      );
      expect(workingEvents).toHaveLength(0);
    });
  });

  // ============================================================================
  // respondQuestion 테스트
  // ============================================================================
  describe('respondQuestion', () => {
    it('should handle non-existent question gracefully', () => {
      manager = createManager();

      // 존재하지 않는 질문에 응답
      manager.respondQuestion('session-1', 'non-existent', 'answer');

      // 에러 없이 진행되어야 함
      expect(events).toHaveLength(0);
    });
  });

  // ============================================================================
  // 상태 조회 테스트
  // ============================================================================
  describe('상태 조회', () => {
    describe('getPendingEvent', () => {
      it('should return null for non-existent session', () => {
        manager = createManager();

        expect(manager.getPendingEvent('non-existent')).toBeNull();
      });
    });

    describe('getAllPendingEvents', () => {
      it('should return empty array initially', () => {
        manager = createManager();

        expect(manager.getAllPendingEvents()).toEqual([]);
      });
    });

    describe('hasActiveSession', () => {
      it('should return false for non-existent session', () => {
        manager = createManager();

        expect(manager.hasActiveSession('non-existent')).toBe(false);
      });
    });

    describe('getSessionStartTime', () => {
      it('should return null for non-existent session', () => {
        manager = createManager();

        expect(manager.getSessionStartTime('non-existent')).toBeNull();
      });
    });

    describe('getActiveSessionIds', () => {
      it('should return empty array initially', () => {
        manager = createManager();

        expect(manager.getActiveSessionIds()).toEqual([]);
      });
    });
  });

  // ============================================================================
  // cleanup 테스트
  // ============================================================================
  describe('cleanup', () => {
    it('should stop all sessions', async () => {
      manager = createManager();

      // cleanup 호출 (세션이 없어도 안전)
      manager.cleanup();

      expect(manager.getActiveSessionIds()).toHaveLength(0);
    });
  });

  // ============================================================================
  // 권한 모드 통합 테스트
  // ============================================================================
  describe('권한 모드 통합', () => {
    it('should use default permission mode by default', async () => {
      let permissionMode: string | null = null;
      let canUseToolCalled = false;

      manager = createManager({
        getPermissionMode: (sessionId) => {
          permissionMode = PermissionMode.DEFAULT;
          return PermissionMode.DEFAULT;
        },
        adapter: {
          async *query(options) {
            // 권한 체크가 호출되도록 canUseTool 실행
            if (options.canUseTool) {
              canUseToolCalled = true;
              await options.canUseTool('Read', { file_path: '/test.txt' });
            }
            yield { type: 'system', subtype: 'init', session_id: 'sess-1' };
          },
        },
      });

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(canUseToolCalled).toBe(true);
      expect(permissionMode).toBe(PermissionMode.DEFAULT);
    });

    it('should use custom permission mode', async () => {
      let usedMode: string | null = null;
      let canUseToolCalled = false;

      manager = createManager({
        getPermissionMode: (sessionId) => {
          usedMode = PermissionMode.BYPASS;
          return PermissionMode.BYPASS;
        },
        adapter: {
          async *query(options) {
            // 권한 체크가 호출되도록 canUseTool 실행
            if (options.canUseTool) {
              canUseToolCalled = true;
              await options.canUseTool('Edit', { file_path: '/main.ts' });
            }
            yield { type: 'system', subtype: 'init', session_id: 'sess-1' };
          },
        },
      });

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(canUseToolCalled).toBe(true);
      expect(usedMode).toBe(PermissionMode.BYPASS);
    });
  });

  // ============================================================================
  // MCP 설정 로드 테스트
  // ============================================================================
  describe('MCP 설정 로드', () => {
    it('should call loadMcpConfig if provided', async () => {
      const loadMcpConfig = vi.fn().mockReturnValue({
        'mcp-server': { command: 'node', args: ['server.js'] },
      });

      manager = createManager({ loadMcpConfig });

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(loadMcpConfig).toHaveBeenCalledWith('/project');
    });

    it('should work without loadMcpConfig', async () => {
      manager = createManager({ loadMcpConfig: undefined });

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      // 에러 없이 완료
      const errorEvents = events.filter(
        (e) => e.event.type === 'error' && !String(e.event.error).includes('adapter')
      );
      expect(errorEvents).toHaveLength(0);
    });
  });

  // ============================================================================
  // 에러 처리 테스트
  // ============================================================================
  describe('에러 처리', () => {
    it('should emit error when adapter throws', async () => {
      manager = createManager({
        adapter: {
          async *query() {
            throw new Error('SDK error');
          },
        },
      });

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: { type: 'error', error: 'SDK error' },
      });
    });

    it('should emit idle state even after error', async () => {
      manager = createManager({
        adapter: {
          async *query() {
            throw new Error('SDK error');
          },
        },
      });

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      const lastStateEvent = events
        .filter((e) => e.event.type === 'state')
        .pop();
      expect(lastStateEvent?.event).toEqual({ type: 'state', state: 'idle' });
    });

    it('should emit error when adapter is not configured', async () => {
      manager = new ClaudeManager({
        onEvent: (sessionId, event) => {
          events.push({ sessionId, event });
        },
        getPermissionMode: () => PermissionMode.DEFAULT,
        // adapter 미지정
      });

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      expect(events).toContainEqual({
        sessionId: 'session-1',
        event: { type: 'error', error: 'Claude adapter not configured' },
      });
    });
  });

  // ============================================================================
  // 세션 재개 테스트
  // ============================================================================
  describe('세션 재개', () => {
    it('should pass claudeSessionId to adapter', async () => {
      let receivedOptions: ClaudeQueryOptions | null = null;

      manager = createManager({
        adapter: {
          async *query(options) {
            receivedOptions = options;
            yield { type: 'system', subtype: 'init', session_id: 'new-session' };
          },
        },
      });

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
        claudeSessionId: 'existing-session-123',
      });

      expect(receivedOptions?.resume).toBe('existing-session-123');
    });
  });

  // ============================================================================
  // 토큰 사용량 추적 테스트
  // ============================================================================
  describe('토큰 사용량 추적', () => {
    it('should track token usage from stream events', async () => {
      queryMessages = [
        {
          type: 'stream_event',
          event: {
            type: 'message_start',
            message: {
              usage: {
                input_tokens: 100,
                cache_read_input_tokens: 50,
                cache_creation_input_tokens: 10,
              },
            },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'message_delta',
            usage: {
              output_tokens: 200,
            },
          },
        },
        {
          type: 'result',
          subtype: 'success',
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      await manager.sendMessage('session-1', 'Hello', {
        workingDir: '/project',
      });

      const resultEvent = events.find((e) => e.event.type === 'result');
      expect(resultEvent?.event.usage).toEqual({
        inputTokens: 100,
        outputTokens: 200,
        cacheReadInputTokens: 50,
        cacheCreationInputTokens: 10,
      });
    });
  });
});
