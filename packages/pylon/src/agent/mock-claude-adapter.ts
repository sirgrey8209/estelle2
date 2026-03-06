/**
 * @file mock-claude-adapter.ts
 * @description 테스트용 Mock Claude 어댑터
 *
 * 실제 Claude SDK 없이 메시지 시퀀스를 시뮬레이션합니다.
 * E2E Mock 테스트에서 Pylon의 ClaudeManager 동작을 검증할 때 사용합니다.
 *
 * @example
 * ```typescript
 * const mockAdapter = new MockClaudeAdapter();
 *
 * // 간단한 텍스트 응답 설정
 * mockAdapter.setSimpleResponse('Hello! How can I help you?');
 *
 * // ClaudeManager에 주입
 * const manager = new ClaudeManager({
 *   adapter: mockAdapter,
 *   onEvent: (sessionId, event) => console.log(event),
 *   getPermissionMode: () => 'default',
 * });
 * ```
 */

import type {
  ClaudeAdapter,
  ClaudeQueryOptions,
  ClaudeMessage,
} from './claude-manager.js';

/**
 * Mock Claude 응답 시나리오 타입
 */
export type MockScenario =
  | MockSimpleTextScenario
  | MockToolUseScenario
  | MockErrorScenario
  | MockStreamingScenario
  | MockCustomScenario;

/**
 * 간단한 텍스트 응답 시나리오
 */
export interface MockSimpleTextScenario {
  type: 'simple_text';
  text: string;
}

/**
 * 도구 사용 시나리오
 */
export interface MockToolUseScenario {
  type: 'tool_use';
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResult?: string;
  toolError?: boolean;
  /** 도구 실행 후 최종 응답 텍스트 */
  finalText?: string;
}

/**
 * 에러 시나리오
 */
export interface MockErrorScenario {
  type: 'error';
  error: string;
}

/**
 * 스트리밍 텍스트 시나리오
 */
export interface MockStreamingScenario {
  type: 'streaming';
  /** 청크 단위로 전송할 텍스트 배열 */
  chunks: string[];
  /** 청크 간 딜레이 (ms) */
  delayMs?: number;
}

/**
 * 커스텀 메시지 시퀀스 시나리오
 */
export interface MockCustomScenario {
  type: 'custom';
  messages: ClaudeMessage[];
}

/**
 * Mock Claude 어댑터
 *
 * 테스트에서 실제 Claude SDK 없이 응답을 시뮬레이션합니다.
 */
export class MockClaudeAdapter implements ClaudeAdapter {
  private scenarios: MockScenario[] = [];
  private scenarioIndex = 0;
  private sessionIdCounter = 0;

  /**
   * 시나리오 설정 (여러 개)
   *
   * @param scenarios - 순차적으로 실행할 시나리오 배열
   */
  setScenarios(scenarios: MockScenario[]): void {
    this.scenarios = scenarios;
    this.scenarioIndex = 0;
  }

  /**
   * 단일 시나리오 설정
   *
   * @param scenario - 시나리오
   */
  setScenario(scenario: MockScenario): void {
    this.scenarios = [scenario];
    this.scenarioIndex = 0;
  }

  /**
   * 간단한 텍스트 응답 설정
   *
   * @param text - 응답 텍스트
   */
  setSimpleResponse(text: string): void {
    this.setScenario({ type: 'simple_text', text });
  }

  /**
   * 에러 응답 설정
   *
   * @param error - 에러 메시지
   */
  setErrorResponse(error: string): void {
    this.setScenario({ type: 'error', error });
  }

  /**
   * 도구 사용 응답 설정
   *
   * @param toolName - 도구 이름
   * @param toolInput - 도구 입력
   * @param options - 추가 옵션
   */
  setToolUseResponse(
    toolName: string,
    toolInput: Record<string, unknown>,
    options?: { toolResult?: string; toolError?: boolean; finalText?: string }
  ): void {
    this.setScenario({
      type: 'tool_use',
      toolName,
      toolInput,
      ...options,
    });
  }

  /**
   * 시나리오 인덱스 리셋
   */
  reset(): void {
    this.scenarioIndex = 0;
  }

  /**
   * Claude에 쿼리 실행 (Mock)
   */
  async *query(options: ClaudeQueryOptions): AsyncIterable<ClaudeMessage> {
    const scenario = this.scenarios[this.scenarioIndex];
    if (!scenario) {
      // 시나리오 없으면 빈 응답
      return;
    }

    // 다음 쿼리를 위해 인덱스 증가
    this.scenarioIndex = Math.min(
      this.scenarioIndex + 1,
      this.scenarios.length - 1
    );

    const sessionId = `mock-session-${++this.sessionIdCounter}`;

    // abort 체크 헬퍼
    const checkAbort = () => {
      if (options.abortController?.signal.aborted) {
        throw new Error('Aborted');
      }
    };

    switch (scenario.type) {
      case 'simple_text':
        yield* this.generateSimpleText(sessionId, scenario.text, checkAbort);
        break;

      case 'tool_use':
        yield* this.generateToolUse(sessionId, scenario, options, checkAbort);
        break;

      case 'error':
        throw new Error(scenario.error);

      case 'streaming':
        yield* this.generateStreaming(sessionId, scenario, checkAbort);
        break;

      case 'custom':
        for (const msg of scenario.messages) {
          checkAbort();
          yield msg;
        }
        break;
    }
  }

  /**
   * 간단한 텍스트 응답 생성
   */
  private async *generateSimpleText(
    sessionId: string,
    text: string,
    checkAbort: () => void
  ): AsyncIterable<ClaudeMessage> {
    checkAbort();

    // 1. init 메시지
    yield {
      type: 'system',
      subtype: 'init',
      session_id: sessionId,
      model: 'claude-sonnet-4-20250514',
      tools: ['Read', 'Write', 'Edit', 'Bash'],
    };

    checkAbort();

    // 2. 스트리밍 시작
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        content_block: { type: 'text' },
      },
    };

    // 3. 텍스트 청크 (전체를 한 번에)
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text },
      },
    };

    // 4. 스트리밍 종료
    yield {
      type: 'stream_event',
      event: { type: 'content_block_stop' },
    };

    // 5. assistant 메시지 (완료)
    yield {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text }],
      },
    };

    checkAbort();

    // 6. result
    yield {
      type: 'result',
      subtype: 'success',
      total_cost_usd: 0.001,
      num_turns: 1,
      usage: {
        input_tokens: 100,
        output_tokens: text.length,
      },
    };
  }

  /**
   * 도구 사용 응답 생성
   */
  private async *generateToolUse(
    sessionId: string,
    scenario: MockToolUseScenario,
    options: ClaudeQueryOptions,
    checkAbort: () => void
  ): AsyncIterable<ClaudeMessage> {
    const toolUseId = `toolu_${Date.now()}`;

    checkAbort();

    // 1. init 메시지
    yield {
      type: 'system',
      subtype: 'init',
      session_id: sessionId,
      model: 'claude-sonnet-4-20250514',
      tools: ['Read', 'Write', 'Edit', 'Bash', scenario.toolName],
    };

    checkAbort();

    // 2. tool_use 시작 (stream_event)
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          name: scenario.toolName,
          id: toolUseId,
        },
      },
    };

    // 3. assistant 메시지 (도구 사용 요청)
    yield {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            name: scenario.toolName,
            id: toolUseId,
            input: scenario.toolInput,
          },
        ],
      },
    };

    checkAbort();

    // 4. 권한 확인 (canUseTool 콜백 호출)
    if (options.canUseTool) {
      const permResult = await options.canUseTool(
        scenario.toolName,
        scenario.toolInput
      );

      if (permResult.behavior === 'deny') {
        // 권한 거부 시 에러 결과
        yield {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseId,
                is_error: true,
                content: permResult.message || 'Permission denied',
              },
            ],
          },
        };

        yield {
          type: 'result',
          subtype: 'error',
          total_cost_usd: 0.001,
          num_turns: 1,
        };
        return;
      }
    }

    // 5. tool_progress
    yield {
      type: 'tool_progress',
      tool_name: scenario.toolName,
      elapsed_time_seconds: 0.5,
    };

    checkAbort();

    // 6. 도구 실행 결과 (user 메시지)
    yield {
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseId,
            is_error: scenario.toolError === true,
            content: scenario.toolResult || 'Tool executed successfully',
          },
        ],
      },
    };

    // 7. 최종 텍스트 응답 (있으면)
    if (scenario.finalText) {
      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          content_block: { type: 'text' },
        },
      };

      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: scenario.finalText },
        },
      };

      yield {
        type: 'stream_event',
        event: { type: 'content_block_stop' },
      };

      yield {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: scenario.finalText }],
        },
      };
    }

    // 8. result
    yield {
      type: 'result',
      subtype: scenario.toolError ? 'error' : 'success',
      total_cost_usd: 0.002,
      num_turns: 2,
      usage: {
        input_tokens: 200,
        output_tokens: 150,
      },
    };
  }

  /**
   * 스트리밍 텍스트 응답 생성
   */
  private async *generateStreaming(
    sessionId: string,
    scenario: MockStreamingScenario,
    checkAbort: () => void
  ): AsyncIterable<ClaudeMessage> {
    checkAbort();

    // 1. init 메시지
    yield {
      type: 'system',
      subtype: 'init',
      session_id: sessionId,
      model: 'claude-sonnet-4-20250514',
      tools: [],
    };

    checkAbort();

    // 2. 스트리밍 시작
    yield {
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        content_block: { type: 'text' },
      },
    };

    // 3. 청크별 전송
    const fullText: string[] = [];
    for (const chunk of scenario.chunks) {
      checkAbort();

      if (scenario.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, scenario.delayMs));
      }

      yield {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: chunk },
        },
      };

      fullText.push(chunk);
    }

    // 4. 스트리밍 종료
    yield {
      type: 'stream_event',
      event: { type: 'content_block_stop' },
    };

    // 5. assistant 메시지 (완료)
    yield {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: fullText.join('') }],
      },
    };

    // 6. result
    yield {
      type: 'result',
      subtype: 'success',
      total_cost_usd: 0.001,
      num_turns: 1,
    };
  }
}
