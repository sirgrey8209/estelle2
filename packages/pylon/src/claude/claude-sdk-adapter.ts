/**
 * @file claude-sdk-adapter.ts
 * @description Claude Agent SDK를 래핑하는 어댑터
 *
 * @anthropic-ai/claude-agent-sdk의 query 함수를 ClaudeAdapter 인터페이스에 맞게 래핑합니다.
 * SDK의 메시지를 그대로 전달하므로 ClaudeManager에서 처리합니다.
 *
 * @example
 * ```typescript
 * import { ClaudeSDKAdapter } from './claude-sdk-adapter.js';
 *
 * const adapter = new ClaudeSDKAdapter();
 *
 * const manager = new ClaudeManager({
 *   adapter,
 *   onEvent: (sessionId, event) => console.log(event),
 *   getPermissionMode: () => 'default',
 * });
 * ```
 */

import {
  query,
  type CanUseTool,
  type PermissionResult,
  type McpServerConfig,
  type SettingSource,
} from '@anthropic-ai/claude-agent-sdk';
import type {
  ClaudeAdapter,
  ClaudeQueryOptions,
  ClaudeMessage,
  PermissionCallbackResult,
} from './claude-manager.js';

/**
 * v2의 PermissionCallbackResult를 SDK의 canUseTool 형식으로 래핑
 *
 * SDK의 canUseTool은 세 번째 매개변수로 options를 받고,
 * deny 시 message가 필수입니다.
 */
function wrapCanUseTool(
  canUseTool?: (
    toolName: string,
    input: Record<string, unknown>
  ) => Promise<PermissionCallbackResult>
): CanUseTool | undefined {
  if (!canUseTool) return undefined;

  return async (
    toolName: string,
    input: Record<string, unknown>,
    _options: {
      signal: AbortSignal;
      suggestions?: unknown[];
      blockedPath?: string;
      decisionReason?: string;
      toolUseID: string;
      agentID?: string;
    }
  ): Promise<PermissionResult> => {
    const result = await canUseTool(toolName, input);

    if (result.behavior === 'allow') {
      return {
        behavior: 'allow',
        updatedInput: result.updatedInput,
      };
    } else {
      return {
        behavior: 'deny',
        message: result.message || 'Permission denied',
      };
    }
  };
}

/**
 * Claude Agent SDK 어댑터
 *
 * @description
 * @anthropic-ai/claude-agent-sdk의 query 함수를 ClaudeAdapter 인터페이스로 래핑합니다.
 * SDK에서 반환하는 메시지 스트림을 그대로 yield합니다.
 *
 * SDK 메시지 타입:
 * - system (subtype: init): 세션 초기화
 * - assistant: Claude 응답 (텍스트, 도구 사용)
 * - user: 도구 실행 결과
 * - stream_event: 스트리밍 이벤트 (토큰, 델타)
 * - tool_progress: 도구 실행 진행 상황
 * - result: 최종 결과 (비용, 토큰 사용량)
 */
export class ClaudeSDKAdapter implements ClaudeAdapter {
  /**
   * Claude에 쿼리 실행
   *
   * @param options - 쿼리 옵션
   * @returns SDK 메시지 스트림
   */
  async *query(options: ClaudeQueryOptions): AsyncIterable<ClaudeMessage> {
    const sdkOptions = {
      cwd: options.cwd,
      abortController: options.abortController,
      includePartialMessages: options.includePartialMessages ?? true,
      settingSources: (options.settingSources ?? ['user', 'project', 'local']) as SettingSource[],
      resume: options.resume,
      mcpServers: options.mcpServers as Record<string, McpServerConfig> | undefined,
      canUseTool: wrapCanUseTool(options.canUseTool),
      // DEPRECATED: Beacon 사용 시 env는 Beacon이 관리
      // 직접 SDK 사용 시에만 필요하지만, 현재는 Beacon을 통해 호출됨
      // env: options.env,
    };

    // SDK query 호출
    const sdkQuery = query({
      prompt: options.prompt,
      options: sdkOptions,
    });

    // SDK 메시지를 그대로 yield
    // SDK 메시지 타입과 ClaudeMessage 타입이 호환되므로 변환 없이 전달
    for await (const msg of sdkQuery) {
      yield msg as ClaudeMessage;
    }
  }
}
