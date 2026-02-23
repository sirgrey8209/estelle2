/**
 * @file send-file.ts
 * @description send_file MCP 도구 구현
 *
 * Claude가 사용자에게 파일을 전송할 때 사용하는 MCP 도구.
 * PylonClient를 통해 PylonMcpServer로 요청을 보냅니다.
 */

import { PylonClient } from '../pylon-client.js';

// ============================================================================
// 타입
// ============================================================================

interface SendFileArgs {
  path?: string;
  description?: string;
}

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
 */
function createErrorResponse(message: string): McpResponse {
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
// 메인 함수
// ============================================================================

/**
 * send_file MCP 도구 실행
 *
 * @param args - 도구 인자 (path, description)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeSendFile(
  args: SendFileArgs,
  meta: ToolMeta,
): Promise<McpResponse> {
  // 1. path 인자 검증
  if (!args.path || args.path === '') {
    return createErrorResponse('path is required');
  }

  // 2. PylonClient로 send_file 요청 (toolUseId 기반)
  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.sendFileByToolUseId(
      meta.toolUseId,
      args.path,
      args.description,
    );

    if (!result.success) {
      return createErrorResponse(result.error ?? 'File not found');
    }

    return createSuccessResponse({
      success: true,
      file: result.file,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Send file failed: ${message}`);
  }
}
