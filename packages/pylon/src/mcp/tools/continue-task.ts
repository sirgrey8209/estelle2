/**
 * @file continue-task.ts
 * @description continue_task MCP 도구 구현
 *
 * Claude가 세션을 재시작하고 작업을 계속할 때 사용하는 MCP 도구.
 * 히스토리를 유지하면서 재시작 로그를 추가하고 새 세션을 시작합니다.
 *
 * - 환경변수 ESTELLE_MCP_PORT로 PylonMcpServer에 직접 연결
 * - toolUseId 기반 lookup_and_* 액션으로 conversationId 자동 해결
 * - MCP 표준 응답 포맷 반환
 */

import { PylonClient } from '../pylon-client.js';

// ============================================================================
// 타입
// ============================================================================

interface ToolMeta {
  toolUseId: string;
}

interface McpTextContent {
  type: 'text';
  text: string;
}

interface ToolResult {
  content: McpTextContent[];
  isError?: boolean;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * MCP 성공 응답 생성
 */
function createSuccessResponse(data: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

/**
 * MCP 에러 응답 생성
 */
function createErrorResponse(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/**
 * PylonClient 인스턴스 생성 (환경변수 기반)
 */
function createPylonClient(): PylonClient {
  const mcpPort = parseInt(process.env.ESTELLE_MCP_PORT || '9880', 10);
  return new PylonClient({
    host: '127.0.0.1',
    port: mcpPort,
  });
}

// ============================================================================
// executeContinueTask
// ============================================================================

/**
 * continue_task MCP 도구 실행
 *
 * @param args - 도구 인자 (reason)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeContinueTask(
  args: { reason?: string },
  meta: ToolMeta,
): Promise<ToolResult> {
  // toolUseId 검증
  if (!meta.toolUseId || meta.toolUseId === '') {
    return createErrorResponse('toolUseId is required');
  }

  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.continueTaskByToolUseId(
      meta.toolUseId,
      args.reason,
    );

    if (!result.success) {
      return createErrorResponse(result.error ?? 'toolUseId not found');
    }

    return createSuccessResponse({
      success: true,
      message: result.message ?? '세션 재시작됨',
      newSession: result.newSession ?? true,
      systemMessageAdded: result.systemMessageAdded ?? true,
      historyPreserved: result.historyPreserved ?? true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Session restart failed: ${message}`);
  }
}

// ============================================================================
// 도구 정의
// ============================================================================

/**
 * continue_task 도구 정의 반환
 */
export function getContinueTaskToolDefinition(): ToolDefinition {
  return {
    name: 'continue_task',
    description: '세션을 재시작하고 작업을 계속합니다. 히스토리는 유지됩니다.',
    inputSchema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: '재시작 사유 (선택, 예: 토큰 한도 초과)',
        },
      },
      required: [],
    },
  };
}
