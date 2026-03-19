/**
 * @file suggestion-manager.test.ts
 * @description SuggestionManager 테스트
 *
 * 대화 맥락에 기반한 자동 제안 생성 모듈을 테스트합니다.
 * AgentAdapter를 모킹하여 로직만 테스트합니다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SuggestionManager } from '../../src/agent/suggestion-manager.js';
import type {
  AgentAdapter,
  AgentQueryOptions,
  AgentMessage,
  AgentManagerEvent,
  AgentEventHandler,
} from '../../src/agent/agent-manager.js';

/**
 * assistant 메시지를 생성하는 헬퍼
 */
function createAssistantMessage(text: string): AgentMessage {
  return {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text }],
    },
  } as AgentMessage;
}

/**
 * 모킹된 어댑터 생성 - 지정된 메시지들을 순서대로 yield
 */
function createMockAdapter(messages: AgentMessage[]): AgentAdapter {
  return {
    async *query(_options: AgentQueryOptions): AsyncIterable<AgentMessage> {
      for (const msg of messages) {
        yield msg;
      }
    },
  };
}

/**
 * 에러를 발생시키는 어댑터 생성
 */
function createErrorAdapter(error: Error): AgentAdapter {
  return {
    async *query(_options: AgentQueryOptions): AsyncIterable<AgentMessage> {
      throw error;
    },
  };
}

describe('SuggestionManager', () => {
  let events: Array<{ sessionId: number; event: AgentManagerEvent }>;
  let onEvent: AgentEventHandler;

  beforeEach(() => {
    events = [];
    onEvent = (sessionId: number, event: AgentManagerEvent) => {
      events.push({ sessionId, event });
    };
  });

  // --------------------------------------------------------------------------
  // 1. Happy path: 3개 제안 생성 → loading → ready
  // --------------------------------------------------------------------------
  describe('happy path', () => {
    it('should emit loading then ready with 3 suggestions', async () => {
      const suggestions = ['첫 번째 제안', '두 번째 제안', '세 번째 제안'];
      const adapter = createMockAdapter([
        createAssistantMessage(JSON.stringify(suggestions)),
      ]);

      const manager = new SuggestionManager(adapter, onEvent);
      await manager.generate(1, 'agent-session-1', '/test/dir');

      // loading 이벤트가 먼저 나와야 함
      const loadingEvent = events.find(
        (e) =>
          e.sessionId === 1 &&
          e.event.type === 'suggestion' &&
          e.event.status === 'loading'
      );
      expect(loadingEvent).toBeDefined();

      // ready 이벤트에 items가 포함되어야 함
      const readyEvent = events.find(
        (e) =>
          e.sessionId === 1 &&
          e.event.type === 'suggestion' &&
          e.event.status === 'ready'
      );
      expect(readyEvent).toBeDefined();
      expect(readyEvent!.event.items).toEqual(suggestions);

      // loading이 ready보다 먼저 나와야 함
      const loadingIndex = events.indexOf(loadingEvent!);
      const readyIndex = events.indexOf(readyEvent!);
      expect(loadingIndex).toBeLessThan(readyIndex);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Adapter failure: loading → error
  // --------------------------------------------------------------------------
  describe('adapter failure', () => {
    it('should emit loading then error when adapter throws', async () => {
      const adapter = createErrorAdapter(new Error('API connection failed'));

      const manager = new SuggestionManager(adapter, onEvent);
      await manager.generate(1, 'agent-session-1', '/test/dir');

      const loadingEvent = events.find(
        (e) =>
          e.event.type === 'suggestion' && e.event.status === 'loading'
      );
      expect(loadingEvent).toBeDefined();

      const errorEvent = events.find(
        (e) =>
          e.event.type === 'suggestion' && e.event.status === 'error'
      );
      expect(errorEvent).toBeDefined();

      // ready 이벤트는 없어야 함
      const readyEvent = events.find(
        (e) =>
          e.event.type === 'suggestion' && e.event.status === 'ready'
      );
      expect(readyEvent).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Invalid JSON response: error
  // --------------------------------------------------------------------------
  describe('invalid JSON response', () => {
    it('should emit error when response is not valid JSON', async () => {
      const adapter = createMockAdapter([
        createAssistantMessage('This is not valid JSON at all'),
      ]);

      const manager = new SuggestionManager(adapter, onEvent);
      await manager.generate(1, 'agent-session-1', '/test/dir');

      const errorEvent = events.find(
        (e) =>
          e.event.type === 'suggestion' && e.event.status === 'error'
      );
      expect(errorEvent).toBeDefined();

      const readyEvent = events.find(
        (e) =>
          e.event.type === 'suggestion' && e.event.status === 'ready'
      );
      expect(readyEvent).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Non-array or wrong length response: error
  // --------------------------------------------------------------------------
  describe('non-array or wrong length response', () => {
    it('should emit error when response is not an array', async () => {
      const adapter = createMockAdapter([
        createAssistantMessage(JSON.stringify({ suggestion: 'not an array' })),
      ]);

      const manager = new SuggestionManager(adapter, onEvent);
      await manager.generate(1, 'agent-session-1', '/test/dir');

      const errorEvent = events.find(
        (e) =>
          e.event.type === 'suggestion' && e.event.status === 'error'
      );
      expect(errorEvent).toBeDefined();
    });

    it('should emit error when array has wrong length', async () => {
      const adapter = createMockAdapter([
        createAssistantMessage(JSON.stringify(['only one', 'only two'])),
      ]);

      const manager = new SuggestionManager(adapter, onEvent);
      await manager.generate(1, 'agent-session-1', '/test/dir');

      const errorEvent = events.find(
        (e) =>
          e.event.type === 'suggestion' && e.event.status === 'error'
      );
      expect(errorEvent).toBeDefined();
    });

    it('should emit error when array contains non-strings', async () => {
      const adapter = createMockAdapter([
        createAssistantMessage(JSON.stringify([1, 2, 3])),
      ]);

      const manager = new SuggestionManager(adapter, onEvent);
      await manager.generate(1, 'agent-session-1', '/test/dir');

      const errorEvent = events.find(
        (e) =>
          e.event.type === 'suggestion' && e.event.status === 'error'
      );
      expect(errorEvent).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Cancel: 진행 중인 생성 취소 시 ready 이벤트 없음
  // --------------------------------------------------------------------------
  describe('cancel', () => {
    it('should cancel ongoing generation and not emit ready', async () => {
      // 느린 어댑터: abort 시그널을 존중하며 지연 후 응답
      const slowAdapter: AgentAdapter = {
        async *query(options: AgentQueryOptions): AsyncIterable<AgentMessage> {
          // abort 시그널이 발생할 때까지 대기
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 5000);
            options.abortController.signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Aborted'));
            });
          });
          yield createAssistantMessage(
            JSON.stringify(['a', 'b', 'c'])
          );
        },
      };

      const manager = new SuggestionManager(slowAdapter, onEvent);

      // generate 시작 (완료를 기다리지 않음)
      const generatePromise = manager.generate(
        1,
        'agent-session-1',
        '/test/dir'
      );

      // 약간 지연 후 취소
      await new Promise((resolve) => setTimeout(resolve, 50));
      manager.cancel(1);

      // generate가 완료될 때까지 대기
      await generatePromise;

      // ready 이벤트는 없어야 함
      const readyEvent = events.find(
        (e) =>
          e.event.type === 'suggestion' && e.event.status === 'ready'
      );
      expect(readyEvent).toBeUndefined();
    });

    it('should cancel previous generation when generate is called again', async () => {
      const capturedAbortControllers: AbortController[] = [];

      // 첫 번째 호출은 느리게, 두 번째 호출은 즉시 응답
      let callCount = 0;
      const trackingAdapter: AgentAdapter = {
        async *query(
          options: AgentQueryOptions
        ): AsyncIterable<AgentMessage> {
          capturedAbortControllers.push(options.abortController);
          callCount++;

          if (callCount === 1) {
            // 첫 번째 호출: abort될 때까지 대기
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, 5000);
              options.abortController.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new Error('Aborted'));
              });
            });
          }

          yield createAssistantMessage(
            JSON.stringify(['a', 'b', 'c'])
          );
        },
      };

      const manager = new SuggestionManager(trackingAdapter, onEvent);

      // 첫 번째 generate (완료를 기다리지 않음)
      const firstPromise = manager.generate(1, 'agent-session-1', '/test/dir');

      // 약간 지연 후 두 번째 generate (같은 sessionId) - 이전 것이 취소되어야 함
      await new Promise((resolve) => setTimeout(resolve, 50));
      const secondPromise = manager.generate(1, 'agent-session-2', '/test/dir');

      await Promise.all([firstPromise, secondPromise]);

      // 첫 번째 abortController가 abort 되었어야 함
      expect(capturedAbortControllers[0].signal.aborted).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Cache: 생성 완료 후 재호출 시 캐시에서 즉시 반환
  // --------------------------------------------------------------------------
  describe('cache', () => {
    it('should return cached suggestions on second generate call', async () => {
      const suggestions = ['첫 번째', '두 번째', '세 번째'];
      let queryCount = 0;
      const countingAdapter: AgentAdapter = {
        async *query(_options: AgentQueryOptions): AsyncIterable<AgentMessage> {
          queryCount++;
          yield createAssistantMessage(JSON.stringify(suggestions));
        },
      };

      const manager = new SuggestionManager(countingAdapter, onEvent);

      // 첫 번째 호출: 생성
      await manager.generate(1, 'agent-session-1', '/test/dir');
      expect(queryCount).toBe(1);
      expect(events.filter(e => e.event.status === 'ready')).toHaveLength(1);

      // 두 번째 호출: 캐시 히트 (adapter 호출 없음)
      await manager.generate(1, 'agent-session-1', '/test/dir');
      expect(queryCount).toBe(1); // adapter가 다시 호출되지 않음
      expect(events.filter(e => e.event.status === 'ready')).toHaveLength(2); // ready 이벤트는 다시 emit
    });

    it('should regenerate after clearCache', async () => {
      const suggestions = ['a', 'b', 'c'];
      let queryCount = 0;
      const countingAdapter: AgentAdapter = {
        async *query(_options: AgentQueryOptions): AsyncIterable<AgentMessage> {
          queryCount++;
          yield createAssistantMessage(JSON.stringify(suggestions));
        },
      };

      const manager = new SuggestionManager(countingAdapter, onEvent);

      await manager.generate(1, 'agent-session-1', '/test/dir');
      expect(queryCount).toBe(1);

      // 캐시 클리어
      manager.clearCache(1);

      // 다시 생성해야 함
      await manager.generate(1, 'agent-session-1', '/test/dir');
      expect(queryCount).toBe(2);
    });

    it('should clear cache on cancel', async () => {
      const suggestions = ['a', 'b', 'c'];
      let queryCount = 0;
      const countingAdapter: AgentAdapter = {
        async *query(_options: AgentQueryOptions): AsyncIterable<AgentMessage> {
          queryCount++;
          yield createAssistantMessage(JSON.stringify(suggestions));
        },
      };

      const manager = new SuggestionManager(countingAdapter, onEvent);

      await manager.generate(1, 'agent-session-1', '/test/dir');
      expect(queryCount).toBe(1);

      // cancel → 캐시도 삭제
      manager.cancel(1);

      // 다시 생성해야 함
      await manager.generate(1, 'agent-session-1', '/test/dir');
      expect(queryCount).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Query options: forkSession, resume 등이 올바르게 전달되는지 확인
  // --------------------------------------------------------------------------
  describe('query options', () => {
    it('should pass forkSession: true and resume with agentSessionId', async () => {
      let capturedOptions: AgentQueryOptions | null = null;

      const capturingAdapter: AgentAdapter = {
        async *query(
          options: AgentQueryOptions
        ): AsyncIterable<AgentMessage> {
          capturedOptions = options;
          yield createAssistantMessage(
            JSON.stringify(['a', 'b', 'c'])
          );
        },
      };

      const manager = new SuggestionManager(capturingAdapter, onEvent);
      await manager.generate(1, 'agent-session-42', '/test/dir');

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.forkSession).toBe(true);
      expect(capturedOptions!.resume).toBe('agent-session-42');
      expect(capturedOptions!.cwd).toBe('/test/dir');
      expect(capturedOptions!.prompt).toBeTruthy();
      expect(capturedOptions!.abortController).toBeInstanceOf(AbortController);
    });
  });
});
