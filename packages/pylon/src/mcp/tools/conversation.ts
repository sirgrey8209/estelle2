/**
 * @file conversation.ts
 * @description 대화 관리 MCP 도구 구현
 *
 * Claude가 대화를 생성/삭제/이름변경할 때 사용하는 MCP 도구.
 * - create_conversation: 현재 워크스페이스에 새 대화 생성 (파일 첨부 가능)
 * - delete_conversation: 대화 삭제 (현재 대화 제외)
 * - rename_conversation: 대화명 변경
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
// executeCreateConversation
// ============================================================================

/**
 * create_conversation MCP 도구 실행
 *
 * @param args - 도구 인자 (name, files)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeCreateConversation(
  args: { name?: string; files?: string[] },
  meta: ToolMeta,
): Promise<ToolResult> {
  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.createConversationByToolUseId(
      meta.toolUseId,
      args.name,
      args.files,
    );

    if (!result.success) {
      return createErrorResponse(result.error ?? '대화 생성에 실패했습니다');
    }

    return createSuccessResponse({
      success: true,
      conversation: result.conversation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`대화 생성 실패: ${message}`);
  }
}

// ============================================================================
// executeDeleteConversation
// ============================================================================

/**
 * delete_conversation MCP 도구 실행
 *
 * @param args - 도구 인자 (target)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeDeleteConversation(
  args: { target?: string },
  meta: ToolMeta,
): Promise<ToolResult> {
  // target 검증
  if (!args.target || args.target === '') {
    return createErrorResponse('삭제할 대화를 지정해주세요 (target 필수)');
  }

  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.deleteConversationByToolUseId(
      meta.toolUseId,
      args.target,
    );

    if (!result.success) {
      return createErrorResponse(result.error ?? '대화 삭제에 실패했습니다');
    }

    return createSuccessResponse({
      success: true,
      deleted: result.conversation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`대화 삭제 실패: ${message}`);
  }
}

// ============================================================================
// executeRenameConversation
// ============================================================================

/**
 * rename_conversation MCP 도구 실행
 *
 * @param args - 도구 인자 (newName, target)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeRenameConversation(
  args: { newName?: string; target?: string },
  meta: ToolMeta,
): Promise<ToolResult> {
  // newName 검증
  if (!args.newName || args.newName.trim() === '') {
    return createErrorResponse('새 대화명을 입력해주세요 (newName 필수)');
  }

  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.renameConversationByToolUseId(
      meta.toolUseId,
      args.newName,
      args.target,
    );

    if (!result.success) {
      return createErrorResponse(result.error ?? '대화명 변경에 실패했습니다');
    }

    return createSuccessResponse({
      success: true,
      conversation: result.conversation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`대화명 변경 실패: ${message}`);
  }
}

// ============================================================================
// 도구 정의
// ============================================================================

/**
 * create_conversation 도구 정의 반환
 */
export function getCreateConversationToolDefinition(): ToolDefinition {
  return {
    name: 'create_conversation',
    description: '현재 워크스페이스에 새 대화를 생성합니다. 파일을 첨부할 수 있습니다.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '대화 이름 (선택, 기본값: "새 대화")',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: '연결할 파일 경로 배열 (선택)',
        },
      },
      required: [],
    },
  };
}

/**
 * delete_conversation 도구 정의 반환
 */
export function getDeleteConversationToolDefinition(): ToolDefinition {
  return {
    name: 'delete_conversation',
    description: '대화를 삭제합니다. 현재 대화는 삭제할 수 없습니다.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: '삭제할 대화의 이름 또는 ID',
        },
      },
      required: ['target'],
    },
  };
}

/**
 * rename_conversation 도구 정의 반환
 */
export function getRenameConversationToolDefinition(): ToolDefinition {
  return {
    name: 'rename_conversation',
    description: '대화의 이름을 변경합니다. target이 없으면 현재 대화 이름을 변경합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        newName: {
          type: 'string',
          description: '새 대화명',
        },
        target: {
          type: 'string',
          description: '대상 대화 이름 또는 ID (선택, 없으면 현재 대화)',
        },
      },
      required: ['newName'],
    },
  };
}
