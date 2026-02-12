/**
 * @file send-file.ts
 * @description send_file MCP 도구 구현
 *
 * Claude가 사용자에게 파일을 전송할 때 사용하는 MCP 도구.
 * - 파일 존재 확인
 * - MIME 타입 판별 (확장자 기반)
 * - 파일 타입 분류 (image/markdown/text/binary)
 * - 상대 경로 -> 절대 경로 변환
 * - MCP 표준 응답 포맷 반환
 */

import fs from 'fs';
import path from 'path';
import { BeaconClient, type LookupSuccessResult } from '../beacon-client.js';
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

interface FileInfo {
  filename: string;
  mimeType: string;
  fileType: FileType;
  size: number;
  path: string;
  description: string | null;
}

type FileType = 'image' | 'markdown' | 'text' | 'binary';

// ============================================================================
// 상수
// ============================================================================

const DEFAULT_MIME_TYPE = 'application/octet-stream';

const MIME_TYPES: Record<string, string> = {
  // 이미지
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',

  // 마크다운
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',

  // 텍스트
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.csv': 'text/csv',

  // 데이터 포맷
  '.json': 'application/json',
  '.xml': 'text/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',

  // 웹
  '.html': 'text/html',
  '.css': 'text/css',

  // 프로그래밍 언어
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.dart': 'text/x-dart',
  '.py': 'text/x-python',
  '.java': 'text/x-java',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.h': 'text/x-c',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',

  // 스크립트
  '.sh': 'text/x-shellscript',
  '.bat': 'text/x-batch',
  '.ps1': 'text/x-powershell',
};

// ============================================================================
// 내부 함수
// ============================================================================

/**
 * 확장자 기반 MIME 타입 판별
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? DEFAULT_MIME_TYPE;
}

/**
 * MIME 타입에 따른 파일 타입 분류
 */
function getFileType(mimeType: string): FileType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'text/markdown') return 'markdown';
  if (mimeType.startsWith('text/')) return 'text';
  return 'binary';
}

/**
 * 경로를 절대 경로로 변환
 */
function resolveFilePath(workingDir: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(workingDir, filePath);
}

/**
 * 파일 경로에서 FileInfo 구성
 */
function buildFileInfo(absolutePath: string, description?: string): FileInfo {
  const stat = fs.statSync(absolutePath);
  const mimeType = getMimeType(absolutePath);

  return {
    filename: path.basename(absolutePath),
    mimeType,
    fileType: getFileType(mimeType),
    size: stat.size,
    path: absolutePath,
    description: description ?? null,
  };
}

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

// ============================================================================
// 메인 함수
// ============================================================================

/**
 * send_file MCP 도구 실행
 *
 * @param workingDir - 작업 디렉토리 (상대 경로 해석 기준)
 * @param args - 도구 인자 (path, description)
 * @returns MCP 표준 응답
 */
export async function executeSendFile(
  workingDir: string,
  args: SendFileArgs,
): Promise<McpResponse> {
  // 1. path 인자 검증
  if (!args.path) {
    return createErrorResponse('path 인자가 필요해요.');
  }

  // 2. 절대 경로 변환
  const absolutePath = resolveFilePath(workingDir, args.path);

  // 3. 파일 존재 확인
  if (!fs.existsSync(absolutePath)) {
    return createErrorResponse(`파일을 찾을 수 없습니다: ${absolutePath}`);
  }

  // 4. 성공 응답 반환
  return createSuccessResponse({
    success: true,
    file: buildFileInfo(absolutePath, args.description),
  });
}

// ============================================================================
// PylonClient 통합 함수
// ============================================================================

/** PylonClient 통합 인자 타입 */
interface SendFileWithPylonArgs {
  path: string;
  description?: string;
}

/**
 * PylonClient를 통한 파일 전송
 *
 * MCP 도구가 Pylon을 통해 파일을 전송할 때 사용합니다.
 * BeaconClient lookup으로 mcpHost:mcpPort를 조회하여 동적 연결.
 *
 * @param toolUseId - 도구 호출 ID (BeaconClient lookup에 사용)
 * @param args - 도구 인자 (path, description)
 * @returns MCP 표준 응답
 */
export async function executeSendFileWithPylon(
  toolUseId: string,
  args: SendFileWithPylonArgs,
): Promise<McpResponse> {
  // 1. toolUseId 검증
  if (!toolUseId || toolUseId === '') {
    return createErrorResponse('유효하지 않은 toolUseId입니다.');
  }

  // 2. path 인자 검증
  if (!args.path) {
    return createErrorResponse('path 인자가 필요해요.');
  }

  // 3. BeaconClient로 conversationId, mcpHost, mcpPort 조회
  try {
    const beaconClient = BeaconClient.getInstance();
    const lookupResult = await beaconClient.lookup(toolUseId);

    if (!lookupResult.success) {
      return createErrorResponse(`Lookup failed: ${lookupResult.error}`);
    }

    const result = lookupResult as LookupSuccessResult;

    // 4. PylonClient를 통한 파일 전송 (동적 host:port)
    const pylonClient = new PylonClient({
      host: result.mcpHost,
      port: result.mcpPort,
    });

    const sendResult = await pylonClient.sendFile(result.conversationId, args.path, args.description);

    if (!sendResult.success) {
      return createErrorResponse(sendResult.error || '파일 전송에 실패했습니다.');
    }

    return createSuccessResponse({
      success: true,
      file: sendResult.file,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Pylon 연결에 실패했습니다.';

    // 연결 관련 에러인지 확인
    if (
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('Connection')
    ) {
      return createErrorResponse('Pylon에 연결되지 않았습니다.');
    }

    return createErrorResponse(errorMessage);
  }
}
