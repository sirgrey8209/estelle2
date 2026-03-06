/**
 * @file codex-sdk-adapter.ts
 * @description OpenAI Codex SDK를 래핑하는 어댑터
 *
 * @openai/codex-sdk의 Thread API를 AgentAdapter 인터페이스에 맞게 래핑합니다.
 * Codex의 ThreadEvent를 AgentMessage 형식으로 변환합니다.
 *
 * @example
 * ```typescript
 * import { CodexSDKAdapter } from './codex-sdk-adapter.js';
 *
 * const adapter = new CodexSDKAdapter();
 *
 * const manager = new AgentManager({
 *   adapter,
 *   onEvent: (sessionId, event) => console.log(event),
 *   getPermissionMode: () => 'default',
 * });
 * ```
 */

import { Codex } from '@openai/codex-sdk';
import type {
  AgentAdapter,
  AgentQueryOptions,
  AgentMessage,
} from './agent-manager.js';

/**
 * Codex ThreadEvent 타입 정의 (SDK에서 제공하는 이벤트)
 *
 * @description
 * Codex SDK의 runStreamed에서 반환되는 이벤트 타입입니다.
 */
interface CodexThreadEvent {
  type: string;
  thread_id?: string;
  agent_message?: {
    content?: Array<{
      type: string;
      text?: string;
    }>;
  };
  command_execution?: {
    id?: string;
    command?: string;
    output?: string;
    exit_code?: number;
  };
  function_call?: {
    id?: string;
    name?: string;
    arguments?: string;
    result?: string;
    error?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

/**
 * CodexSDKAdapter - OpenAI Codex SDK 어댑터
 *
 * @description
 * @openai/codex-sdk를 AgentAdapter 인터페이스로 래핑합니다.
 * Codex의 ThreadEvent를 AgentMessage로 변환하여 AgentManager와 호환되게 합니다.
 *
 * 이벤트 변환:
 * - thread.started → system (init)
 * - turn.started → stream_event (message_start)
 * - item.completed (agent_message) → assistant
 * - item.completed (command_execution) → user (tool_result)
 * - item.completed (function_call) → assistant/user (tool_use/tool_result)
 * - turn.completed → result (turn_complete)
 */
export class CodexSDKAdapter implements AgentAdapter {
  /** Codex 클라이언트 인스턴스 */
  private codex: Codex;

  /**
   * CodexSDKAdapter 생성자
   */
  constructor() {
    this.codex = new Codex();
  }

  /**
   * Agent에 쿼리 실행
   *
   * @param options - 쿼리 옵션
   * @returns AgentMessage 스트림
   */
  async *query(options: AgentQueryOptions): AsyncIterable<AgentMessage> {
    // Thread 시작
    const thread = this.codex.startThread({
      workingDirectory: options.cwd,
      // Codex는 자체 approval policy 사용
      approvalPolicy: 'never',
      // 샌드박스 모드
      sandboxMode: 'workspace-write',
    });

    // 스트리밍 실행 (signal이 없을 때는 옵션 객체 생략)
    const signal = options.abortController?.signal;
    const { events } = await thread.runStreamed(
      options.prompt,
      signal ? { signal } : undefined,
    );

    // 이벤트 변환 및 전달
    for await (const event of events) {
      const messages = this.convertEvent(event as CodexThreadEvent);
      for (const msg of messages) {
        yield msg;
      }
    }
  }

  /**
   * Codex ThreadEvent를 AgentMessage로 변환
   *
   * @param event - Codex ThreadEvent
   * @returns AgentMessage 배열
   */
  private convertEvent(event: CodexThreadEvent): AgentMessage[] {
    const messages: AgentMessage[] = [];

    switch (event.type) {
      case 'thread.started':
        // 세션 초기화
        messages.push({
          type: 'system',
          subtype: 'init',
          session_id:
            event.thread_id ||
            `codex_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          model: 'codex',
          tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
        });
        break;

      case 'turn.started':
        // 턴 시작 - message_start 이벤트
        messages.push({
          type: 'stream_event',
          event: {
            type: 'message_start',
          },
        });
        break;

      case 'item.completed':
        // 아이템 완료 - agent_message 또는 command_execution
        if (event.agent_message) {
          // agent_message → assistant 메시지
          const content: Array<{
            type: string;
            text?: string;
            name?: string;
            id?: string;
            input?: Record<string, unknown>;
            tool_use_id?: string;
            is_error?: boolean;
            content?: string | Array<{ type: string; text?: string }>;
          }> = event.agent_message.content?.map((c) => ({
            type: c.type,
            text: c.text,
          })) || [];

          messages.push({
            type: 'assistant',
            message: {
              content,
            },
          });
        }

        if (event.command_execution) {
          // command_execution → user 메시지 (tool_result)
          const exec = event.command_execution;
          const isError = (exec.exit_code ?? 0) !== 0;

          messages.push({
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id:
                    exec.id ||
                    `exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
                  is_error: isError,
                  content: exec.output || '',
                },
              ],
            },
          });
        }

        if (event.function_call) {
          // function_call → tool_use + tool_result
          const fn = event.function_call;
          const toolUseId =
            fn.id ||
            `fn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

          // JSON 파싱 (실패 시 빈 객체 fallback)
          let parsedInput: Record<string, unknown> = {};
          if (fn.arguments) {
            try {
              parsedInput = JSON.parse(fn.arguments);
            } catch {
              // JSON 파싱 실패 시 빈 객체 사용
            }
          }

          // tool_use (assistant)
          messages.push({
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'tool_use',
                  id: toolUseId,
                  name: fn.name || 'unknown',
                  input: parsedInput,
                },
              ],
            },
          });

          // tool_result (user)
          if (fn.result !== undefined || fn.error !== undefined) {
            messages.push({
              type: 'user',
              message: {
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: toolUseId,
                    is_error: !!fn.error,
                    content: fn.error || fn.result || '',
                  },
                ],
              },
            });
          }
        }
        break;

      case 'turn.completed':
        // 턴 완료 - result 이벤트
        messages.push({
          type: 'result',
          subtype: 'turn_complete',
          usage: event.usage
            ? {
                input_tokens: event.usage.input_tokens || 0,
                output_tokens: event.usage.output_tokens || 0,
              }
            : undefined,
        });
        break;
    }

    return messages;
  }
}
