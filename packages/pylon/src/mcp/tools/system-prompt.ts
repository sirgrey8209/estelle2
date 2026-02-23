/**
 * @file system-prompt.ts
 * @description add_prompt MCP 도구 구현
 *
 * 파일 경로를 받아 시스템 프롬프트로 설정하고 새 세션을 시작합니다.
 * - 환경변수 ESTELLE_MCP_PORT로 PylonMcpServer에 직접 연결
 * - toolUseId 기반 lookup_and_set_system_prompt 액션으로 conversationId 자동 해결
 * - MCP 표준 응답 포맷 반환
 */

import fs from 'fs';
import path from 'path';
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
    properties: Record<string, { type: string; description?: string }>;
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

/**
 * 파일 경로를 절대 경로로 변환
 */
function resolveFilePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  // 상대 경로인 경우 ESTELLE_WORKING_DIR 기준으로 절대 경로 생성
  const workingDir = process.env.ESTELLE_WORKING_DIR || process.cwd();
  return path.resolve(workingDir, filePath);
}

// ============================================================================
// executeAddPrompt
// ============================================================================

/**
 * add_prompt MCP 도구 실행
 *
 * @param args - 도구 인자 (path)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeAddPrompt(
  args: { path?: string },
  meta: ToolMeta,
): Promise<ToolResult> {
  // 1. path 인자 검증
  if (!args.path || args.path === '') {
    return createErrorResponse('path is required');
  }

  // 2. toolUseId 검증
  if (!meta.toolUseId || meta.toolUseId === '') {
    return createErrorResponse('toolUseId is required');
  }

  // 3. 파일 경로 해석
  const absolutePath = resolveFilePath(args.path);

  // 4. 파일 존재 확인
  if (!fs.existsSync(absolutePath)) {
    return createErrorResponse(`File not found: ${absolutePath}`);
  }

  // 5. 디렉토리인지 확인
  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) {
    return createErrorResponse(`Path is a directory, not a file: ${absolutePath}`);
  }

  // 6. 파일 내용 읽기
  let content: string;
  try {
    content = fs.readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Failed to read file: ${message}`);
  }

  // 7. PylonClient로 시스템 프롬프트 설정 요청
  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.setSystemPromptByToolUseId(meta.toolUseId, content);

    if (!result.success) {
      return createErrorResponse(result.error ?? 'Failed to set system prompt');
    }

    return createSuccessResponse({
      success: true,
      message: result.message,
      newSession: result.newSession,
      path: absolutePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Failed to set system prompt: ${message}`);
  }
}

// ============================================================================
// 도구 정의
// ============================================================================

/**
 * add_prompt 도구 정의 반환
 */
export function getAddPromptToolDefinition(): ToolDefinition {
  return {
    name: 'add_prompt',
    description:
      'Add a custom system prompt from a file. The content will be appended to the default Claude Code system prompt. A new session will be started to apply the prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file containing the system prompt content',
        },
      },
      required: ['path'],
    },
  };
}
