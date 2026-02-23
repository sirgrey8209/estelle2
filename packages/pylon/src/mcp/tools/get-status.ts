/**
 * @file get-status.ts
 * @description get_status MCP 도구 구현
 *
 * Claude가 현재 대화/Pylon의 상태를 조회할 때 사용하는 MCP 도구.
 * PylonClient를 통해 PylonMcpServer로 요청을 보냅니다.
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

interface McpResponse {
  content: McpTextContent[];
  isError?: boolean;
}

// ============================================================================
// 도구 정의
// ============================================================================

export const getStatusToolDefinition = {
  name: 'get_status',
  description: '현재 대화 및 Pylon의 상태를 조회합니다. 환경(dev/stage/release), 버전, 워크스페이스 정보, 연결된 문서 목록을 반환합니다.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * MCP 성공 응답 생성
 */
function createSuccessResponse(data: Record<string, unknown>): McpResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

/**
 * MCP 에러 응답 생성
 * 에러 응답도 JSON 형식으로 반환하여 클라이언트에서 파싱 가능하도록 함
 */
function createErrorResponse(message: string): McpResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }],
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
// 메인 함수
// ============================================================================

/**
 * get_status MCP 도구 실행
 *
 * @param _args - 도구 인자 (없음)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeGetStatus(
  _args: Record<string, unknown>,
  meta: ToolMeta,
): Promise<McpResponse> {
  // 1. toolUseId 검증
  if (!meta.toolUseId || meta.toolUseId === '') {
    return createErrorResponse('toolUseId is required');
  }

  // 2. PylonClient로 get_status 요청 (toolUseId 기반)
  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.getStatusByToolUseId(meta.toolUseId);

    if (!result.success) {
      return createErrorResponse(result.error ?? 'Get status failed');
    }

    return createSuccessResponse({
      success: true,
      status: result.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Get status failed: ${message}`);
  }
}
