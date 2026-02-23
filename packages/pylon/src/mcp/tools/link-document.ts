/**
 * @file link-document.ts
 * @description link/unlink/list MCP 도구 구현
 *
 * Claude가 문서를 현재 대화에 연결/해제하거나 연결된 문서 목록을 조회할 때 사용하는 MCP 도구.
 * - 환경변수 ESTELLE_MCP_PORT로 PylonMcpServer에 직접 연결
 * - toolUseId 기반 lookup_and_* 액션으로 conversationId 자동 해결
 * - MCP 표준 응답 포맷 반환
 */

import fs from 'fs';
import path from 'path';
import { PylonClient } from '../pylon-client.js';

// 디버그 로그 파일 (DATA_DIR/logs/ 에 저장)
const DATA_DIR = process.env.DATA_DIR || './data';
const LOG_DIR = path.join(DATA_DIR, 'logs');
const DEBUG_LOG = path.join(LOG_DIR, 'link-document.log');

// 로그 디렉토리 생성
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch {
  // 디렉토리 생성 실패 무시
}

function debugLog(msg: string): void {
  const ts = new Date().toISOString();
  try {
    fs.appendFileSync(DEBUG_LOG, `[${ts}] ${msg}\n`);
  } catch { /* ignore */ }
}

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

// ============================================================================
// executeLinkDoc
// ============================================================================

/**
 * link_doc MCP 도구 실행
 *
 * @param args - 도구 인자 (path)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeLinkDoc(
  args: { path?: string },
  meta: ToolMeta,
): Promise<ToolResult> {
  // 1. path 인자 검증
  if (!args.path || args.path === '') {
    return createErrorResponse('path is required');
  }

  // 2. PylonClient로 link 요청 (toolUseId 기반)
  try {
    const pylonClient = createPylonClient();
    debugLog(`PylonClient.linkByToolUseId: port=${pylonClient.port}, toolUseId=${meta.toolUseId}`);
    const linkResult = await pylonClient.linkByToolUseId(meta.toolUseId, args.path);

    if (!linkResult.success) {
      return createErrorResponse(linkResult.error ?? 'File not found');
    }

    return createSuccessResponse({
      success: true,
      path: args.path,
      docs: linkResult.docs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Link failed: ${message}`);
  }
}

// ============================================================================
// executeUnlinkDoc
// ============================================================================

/**
 * unlink_doc MCP 도구 실행
 *
 * @param args - 도구 인자 (path)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeUnlinkDoc(
  args: { path?: string },
  meta: ToolMeta,
): Promise<ToolResult> {
  // 1. path 인자 검증
  if (!args.path || args.path === '') {
    return createErrorResponse('path is required');
  }

  // 2. PylonClient로 unlink 요청 (toolUseId 기반)
  try {
    const pylonClient = createPylonClient();
    const unlinkResult = await pylonClient.unlinkByToolUseId(meta.toolUseId, args.path);

    if (!unlinkResult.success) {
      return createErrorResponse(unlinkResult.error ?? 'Document not found');
    }

    return createSuccessResponse({
      success: true,
      path: args.path,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Unlink failed: ${message}`);
  }
}

// ============================================================================
// executeListDocs
// ============================================================================

/**
 * list_docs MCP 도구 실행
 *
 * @param _args - 도구 인자 (없음)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeListDocs(
  _args: Record<string, unknown>,
  meta: ToolMeta,
): Promise<ToolResult> {
  // 1. PylonClient로 list 요청 (toolUseId 기반)
  try {
    const pylonClient = createPylonClient();
    const listResult = await pylonClient.listByToolUseId(meta.toolUseId);

    if (!listResult.success) {
      return createErrorResponse(listResult.error ?? 'List failed');
    }

    return createSuccessResponse({
      success: true,
      docs: listResult.docs ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`List failed: ${message}`);
  }
}

// ============================================================================
// 도구 정의
// ============================================================================

/**
 * link_doc 도구 정의 반환
 */
export function getLinkDocToolDefinition(): ToolDefinition {
  return {
    name: 'link_doc',
    description: 'Link a document to the current conversation for reference',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the document to link',
        },
      },
      required: ['path'],
    },
  };
}

/**
 * unlink_doc 도구 정의 반환
 */
export function getUnlinkDocToolDefinition(): ToolDefinition {
  return {
    name: 'unlink_doc',
    description: 'Unlink a document from the current conversation',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the document to unlink',
        },
      },
      required: ['path'],
    },
  };
}

/**
 * list_docs 도구 정의 반환
 */
export function getListDocsToolDefinition(): ToolDefinition {
  return {
    name: 'list_docs',
    description: 'List all documents linked to the current conversation',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  };
}
