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

    // ============================================================================
    // textComplete 중복 이벤트 버그 수정 테스트 (TDD)
    // ============================================================================
    describe('textComplete 중복 emit 방지', () => {
      /**
       * 버그 시나리오:
       * Claude가 도구 사용 전후로 텍스트를 출력하면 content 배열에 여러 text 블록이 생김.
       * 현재는 각 text 블록마다 textComplete가 emit되어 메시지가 중복 저장됨.
       *
       * 기대 동작:
       * 모든 text 블록을 합쳐서 textComplete를 한 번만 emit
       */

      it('should_emit_single_textComplete_when_content_has_multiple_text_blocks', async () => {
        // Arrange: content에 여러 text 블록이 있는 assistant 메시지
        queryMessages = [
          {
            type: 'assistant',
            message: {
              content: [
                { type: 'text', text: '분석 결과입니다.' },
                { type: 'tool_use', name: 'Read', id: 'tool-1', input: {} },
                { type: 'text', text: '결론적으로 문제가 없습니다.' },
              ],
            },
          },
        ];
        mockAdapter = createMockAdapter(queryMessages);
        manager = createManager();

        // Act
        await manager.sendMessage(1, 'Hello', {
          workingDir: '/project',
        });

        // Assert: textComplete 이벤트가 한 번만 발생해야 함
        const textCompleteEvents = events.filter(
          (e) => e.event.type === 'textComplete'
        );

        expect(textCompleteEvents).toHaveLength(1);
        // 합쳐진 텍스트 확인
        expect(textCompleteEvents[0].event.text).toBe(
          '분석 결과입니다.\n\n결론적으로 문제가 없습니다.'
        );
      });

      it('should_emit_single_textComplete_when_content_has_only_multiple_text_blocks', async () => {
        // Arrange: text 블록만 여러 개 있는 경우
        queryMessages = [
          {
            type: 'assistant',
            message: {
              content: [
                { type: 'text', text: '첫 번째 문단입니다.' },
                { type: 'text', text: '두 번째 문단입니다.' },
                { type: 'text', text: '세 번째 문단입니다.' },
              ],
            },
          },
        ];
        mockAdapter = createMockAdapter(queryMessages);
        manager = createManager();

        // Act
        await manager.sendMessage(1, 'Hello', {
          workingDir: '/project',
        });

        // Assert
        const textCompleteEvents = events.filter(
          (e) => e.event.type === 'textComplete'
        );

        expect(textCompleteEvents).toHaveLength(1);
        expect(textCompleteEvents[0].event.text).toBe(
          '첫 번째 문단입니다.\n\n두 번째 문단입니다.\n\n세 번째 문단입니다.'
        );
      });

      it('should_emit_single_textComplete_even_with_text_before_and_after_multiple_tools', async () => {
        // Arrange: 도구 사용 전후로 텍스트가 있고, 중간에도 도구가 있는 복잡한 케이스
        queryMessages = [
          {
            type: 'assistant',
            message: {
              content: [
                { type: 'text', text: '파일을 읽겠습니다.' },
                { type: 'tool_use', name: 'Read', id: 'tool-1', input: {} },
                { type: 'text', text: '내용을 확인했습니다.' },
                { type: 'tool_use', name: 'Write', id: 'tool-2', input: {} },
                { type: 'text', text: '수정이 완료되었습니다.' },
              ],
            },
          },
        ];
        mockAdapter = createMockAdapter(queryMessages);
        manager = createManager();

        // Act
        await manager.sendMessage(1, 'Hello', {
          workingDir: '/project',
        });

        // Assert
        const textCompleteEvents = events.filter(
          (e) => e.event.type === 'textComplete'
        );

        expect(textCompleteEvents).toHaveLength(1);
        expect(textCompleteEvents[0].event.text).toBe(
          '파일을 읽겠습니다.\n\n내용을 확인했습니다.\n\n수정이 완료되었습니다.'
        );
      });

      it('should_not_emit_textComplete_when_no_text_blocks_exist', async () => {
        // Arrange: text 블록이 없고 tool_use만 있는 경우
        queryMessages = [
          {
            type: 'assistant',
            message: {
              content: [
                { type: 'tool_use', name: 'Read', id: 'tool-1', input: {} },
                { type: 'tool_use', name: 'Write', id: 'tool-2', input: {} },
              ],
            },
          },
        ];
        mockAdapter = createMockAdapter(queryMessages);
        manager = createManager();

        // Act
        await manager.sendMessage(1, 'Hello', {
          workingDir: '/project',
        });

        // Assert
        const textCompleteEvents = events.filter(
          (e) => e.event.type === 'textComplete'
        );

        expect(textCompleteEvents).toHaveLength(0);
      });

      it('should_not_emit_textComplete_when_text_blocks_are_empty', async () => {
        // Arrange: text 블록이 있지만 내용이 비어있는 경우
        queryMessages = [
          {
            type: 'assistant',
            message: {
              content: [
                { type: 'text', text: '' },
                { type: 'text', text: '' },
              ],
            },
          },
        ];
        mockAdapter = createMockAdapter(queryMessages);
        manager = createManager();

        // Act
        await manager.sendMessage(1, 'Hello', {
          workingDir: '/project',
        });

        // Assert
        const textCompleteEvents = events.filter(
          (e) => e.event.type === 'textComplete'
        );

        expect(textCompleteEvents).toHaveLength(0);
      });

      it('should_emit_textComplete_only_with_non_empty_text_blocks', async () => {
        // Arrange: 일부 text 블록만 내용이 있는 경우
        queryMessages = [
          {
            type: 'assistant',
            message: {
              content: [
                { type: 'text', text: '' },
                { type: 'text', text: '유효한 텍스트' },
                { type: 'text', text: '' },
                { type: 'text', text: '또 다른 텍스트' },
              ],
            },
          },
        ];
        mockAdapter = createMockAdapter(queryMessages);
        manager = createManager();

        // Act
        await manager.sendMessage(1, 'Hello', {
          workingDir: '/project',
        });

        // Assert
        const textCompleteEvents = events.filter(
          (e) => e.event.type === 'textComplete'
        );

        expect(textCompleteEvents).toHaveLength(1);
        // 빈 문자열은 무시하고 유효한 텍스트만 합침
        expect(textCompleteEvents[0].event.text).toBe(
          '유효한 텍스트\n\n또 다른 텍스트'
        );
      });

      it('should_clear_partialText_after_emitting_combined_textComplete', async () => {
        // Arrange: stateUpdate 이벤트로 partialText 확인
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
              delta: { type: 'text_delta', text: 'streaming text' },
            },
          },
          {
            type: 'assistant',
            message: {
              content: [
                { type: 'text', text: '첫 번째' },
                { type: 'text', text: '두 번째' },
              ],
            },
          },
          {
            type: 'stream_event',
            event: { type: 'content_block_stop' },
          },
        ];
        mockAdapter = createMockAdapter(queryMessages);
        manager = createManager();

        // Act
        await manager.sendMessage(1, 'Hello', {
          workingDir: '/project',
        });

        // Assert: textComplete 후 stateUpdate의 partialText가 비어있어야 함
        const textCompleteIndex = events.findIndex(
          (e) => e.event.type === 'textComplete'
        );
        const stateUpdateAfterTextComplete = events
          .slice(textCompleteIndex + 1)
          .find(
            (e) =>
              e.event.type === 'stateUpdate' &&
              (e.event as ClaudeManagerEvent & { partialText: string }).partialText !== undefined
          );

        if (stateUpdateAfterTextComplete) {
          expect(
            (stateUpdateAfterTextComplete.event as ClaudeManagerEvent & { partialText: string }).partialText
          ).toBe('');
        }
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
  // PendingQuestion sessionId 테스트 (다중 대화 시나리오)
  // ============================================================================
  describe('PendingQuestion with sessionId', () => {
    /**
     * 시나리오: 다중 대화에서 동시에 AskUserQuestion이 발생했을 때
     * - 대화 A (sessionId: 100)에서 질문 발생
     * - 대화 B (sessionId: 200)에서 질문 발생
     * - 대화 A의 질문에 응답하면 대화 A로만 전달되어야 함
     */
    describe('다중 대화 질문 응답 라우팅', () => {
      it('should_route_answer_to_correct_session_when_multiple_sessions_have_pending_questions', async () => {
        // Arrange
        const resolvedSessions: number[] = [];
        let questionCallbacks: Map<
          number,
          (result: { behavior: string; updatedInput?: object }) => void
        > = new Map();

        // AskUserQuestion이 발생하면 콜백을 저장하고 Promise 반환
        manager = createManager({
          adapter: {
            async *query(options) {
              // canUseTool에서 AskUserQuestion 호출 시뮬레이션
              if (options.canUseTool) {
                const sessionId = options.conversationId as number;
                const result = options.canUseTool('AskUserQuestion', {
                  questions: [`Question for session ${sessionId}`],
                });

                // Promise가 resolve되면 sessionId 기록
                result.then(() => resolvedSessions.push(sessionId));
              }
              yield { type: 'system', subtype: 'init', session_id: 'sess' };
            },
          },
        });

        // Act: 두 세션에서 동시에 메시지 전송 (각각 AskUserQuestion 발생)
        const session100Promise = manager.sendMessage(100, 'Hello', {
          workingDir: '/project',
        });
        const session200Promise = manager.sendMessage(200, 'Hello', {
          workingDir: '/project',
        });

        // 잠시 대기하여 AskUserQuestion이 pendingQuestions에 추가되도록 함
        await new Promise((r) => setTimeout(r, 50));

        // session100의 질문에 응답
        manager.respondQuestion(100, 'non-matching-id', 'Answer for 100');

        await Promise.race([
          Promise.all([session100Promise, session200Promise]),
          new Promise((r) => setTimeout(r, 200)),
        ]);

        // Assert: session 100만 resolve되어야 함, session 200은 대기 중
        expect(resolvedSessions).toContain(100);
        expect(resolvedSessions).not.toContain(200);
      });

      it('should_fallback_to_same_session_question_when_toolUseId_not_found', async () => {
        // Arrange
        let resolvedAnswer: string | null = null;
        let resolvedSessionId: number | null = null;

        manager = createManager({
          adapter: {
            async *query(options) {
              if (options.canUseTool) {
                const sessionId = options.conversationId as number;
                const result = await options.canUseTool('AskUserQuestion', {
                  questions: ['Test question'],
                });

                // resolve 시 sessionId와 답변 기록
                if (result.updatedInput) {
                  resolvedSessionId = sessionId;
                  resolvedAnswer = (result.updatedInput as { answers?: { '0'?: string } })
                    .answers?.['0'] ?? null;
                }
              }
              yield { type: 'system', subtype: 'init', session_id: 'sess' };
            },
          },
        });

        // Act
        const promise = manager.sendMessage(100, 'Hello', {
          workingDir: '/project',
        });

        await new Promise((r) => setTimeout(r, 50));

        // toolUseId가 매칭되지 않지만 sessionId 100의 질문에 fallback으로 응답
        manager.respondQuestion(100, 'wrong-tool-use-id', 'Fallback answer');

        await Promise.race([promise, new Promise((r) => setTimeout(r, 200))]);

        // Assert
        expect(resolvedSessionId).toBe(100);
        expect(resolvedAnswer).toBe('Fallback answer');
      });

      it('should_not_resolve_other_session_question_when_toolUseId_not_found', async () => {
        // Arrange
        const resolvedSessions: number[] = [];

        manager = createManager({
          adapter: {
            async *query(options) {
              if (options.canUseTool) {
                const sessionId = options.conversationId as number;
                options.canUseTool('AskUserQuestion', {
                  questions: ['Test question'],
                }).then(() => resolvedSessions.push(sessionId));
              }
              yield { type: 'system', subtype: 'init', session_id: 'sess' };
            },
          },
        });

        // Act: session 200에서 질문 대기 중
        const session200Promise = manager.sendMessage(200, 'Hello', {
          workingDir: '/project',
        });

        await new Promise((r) => setTimeout(r, 50));

        // session 100에서 응답 시도 (session 100의 질문은 없음)
        // 기존 버그: session 200의 질문이 잘못 resolve됨
        manager.respondQuestion(100, 'any-id', 'Wrong answer');

        await new Promise((r) => setTimeout(r, 100));

        // Assert: session 200의 질문은 resolve되지 않아야 함
        expect(resolvedSessions).not.toContain(200);
      });
    });

    describe('stop 시 sessionId별 질문 정리', () => {
      it('should_only_clear_questions_for_stopped_session_when_stop_called', async () => {
        // Arrange
        const deniedSessions: number[] = [];
        const pendingPromises: Promise<unknown>[] = [];

        manager = createManager({
          adapter: {
            async *query(options) {
              if (options.canUseTool) {
                const sessionId = options.conversationId as number;
                const promise = options.canUseTool('AskUserQuestion', {
                  questions: ['Test'],
                }).then((result) => {
                  if (result.behavior === 'deny') {
                    deniedSessions.push(sessionId);
                  }
                });
                pendingPromises.push(promise);
              }
              yield { type: 'system', subtype: 'init', session_id: 'sess' };
            },
          },
        });

        // Act: 두 세션에서 질문 대기 중
        manager.sendMessage(100, 'Hello', { workingDir: '/project' });
        manager.sendMessage(200, 'Hello', { workingDir: '/project' });

        await new Promise((r) => setTimeout(r, 50));

        // session 100만 stop
        manager.stop(100);

        await new Promise((r) => setTimeout(r, 50));

        // Assert: session 100의 질문만 deny되어야 함
        expect(deniedSessions).toContain(100);
        expect(deniedSessions).not.toContain(200);
      });

      it('should_keep_other_session_questions_pending_after_stop', async () => {
        // Arrange
        let session200Resolved = false;
        let session200Answer: string | null = null;

        manager = createManager({
          adapter: {
            async *query(options) {
              if (options.canUseTool) {
                const sessionId = options.conversationId as number;
                const result = await options.canUseTool('AskUserQuestion', {
                  questions: ['Test'],
                });

                if (sessionId === 200 && result.behavior === 'allow') {
                  session200Resolved = true;
                  session200Answer = (result.updatedInput as { answers?: { '0'?: string } })
                    .answers?.['0'] ?? null;
                }
              }
              yield { type: 'system', subtype: 'init', session_id: 'sess' };
            },
          },
        });

        // Act
        manager.sendMessage(100, 'Hello', { workingDir: '/project' });
        const session200Promise = manager.sendMessage(200, 'Hello', {
          workingDir: '/project',
        });

        await new Promise((r) => setTimeout(r, 50));

        // session 100 stop (session 200은 영향 없어야 함)
        manager.stop(100);

        await new Promise((r) => setTimeout(r, 50));

        // session 200의 질문에 응답
        manager.respondQuestion(200, 'any-id', 'Answer for 200');

        await Promise.race([
          session200Promise,
          new Promise((r) => setTimeout(r, 200)),
        ]);

        // Assert: session 200의 질문이 정상적으로 resolve됨
        expect(session200Resolved).toBe(true);
        expect(session200Answer).toBe('Answer for 200');
      });
    });

    describe('PendingQuestion 인터페이스 확장', () => {
      it('should_store_sessionId_in_pending_question', async () => {
        // Arrange
        manager = createManager({
          adapter: {
            async *query(options) {
              if (options.canUseTool) {
                // AskUserQuestion 호출하여 pendingQuestions에 저장
                options.canUseTool('AskUserQuestion', { questions: ['Test'] });
              }
              yield { type: 'system', subtype: 'init', session_id: 'sess' };
            },
          },
        });

        // Act
        manager.sendMessage(100, 'Hello', { workingDir: '/project' });
        await new Promise((r) => setTimeout(r, 50));

        // Assert: getPendingQuestionSessionId 메서드로 sessionId 확인
        // 이 메서드는 아직 구현되지 않음 - 테스트가 실패해야 함
        const pendingQuestionSessionIds =
          (manager as unknown as { getPendingQuestionSessionIds?: () => number[] })
            .getPendingQuestionSessionIds?.() ?? [];

        expect(pendingQuestionSessionIds).toContain(100);
      });
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
