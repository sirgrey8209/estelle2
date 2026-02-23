/**
 * @file deploy.ts
 * @description deploy MCP 도구 구현
 *
 * Claude가 stage/release 빌드 및 배포를 실행할 때 사용하는 MCP 도구.
 * PylonClient를 통해 PylonMcpServer로 요청을 보냅니다.
 *
 * 제약사항:
 * - 자기 자신 환경으로는 배포할 수 없음 (release에서 release 배포 불가)
 * - promote는 stage에서만 실행 가능 (stage → release)
 */

import { PylonClient } from '../pylon-client.js';

// ============================================================================
// 타입
// ============================================================================

interface DeployArgs {
  target?: string;
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
// 도구 정의
// ============================================================================

export const deployToolDefinition = {
  name: 'deploy',
  description: `빌드 및 배포를 실행합니다.

- stage: 소스에서 stage 환경으로 빌드/배포
- release: 소스에서 release 환경으로 빌드/배포
- promote: stage 빌드를 release로 승격 (재빌드 없이)

제약: 자기 자신 환경으로는 배포 불가 (예: release에서 release 배포 불가)
권장: release 배포는 stage에서 promote 사용`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      target: {
        type: 'string',
        description: '배포 대상: stage, release, promote',
        enum: ['stage', 'release', 'promote'],
      },
    },
    required: ['target'],
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
 * deploy MCP 도구 실행
 *
 * @param args - 도구 인자 (target)
 * @param meta - 도구 메타 정보 (toolUseId)
 * @returns MCP 표준 응답
 */
export async function executeDeploy(
  args: DeployArgs,
  meta: ToolMeta,
): Promise<McpResponse> {
  // 1. target 검증
  if (!args.target || args.target === '') {
    return createErrorResponse('target is required');
  }

  const validTargets = ['stage', 'release', 'promote'];
  if (!validTargets.includes(args.target)) {
    return createErrorResponse(`Invalid target: ${args.target}. Must be one of: ${validTargets.join(', ')}`);
  }

  // 2. PylonClient로 deploy 요청 (toolUseId 기반)
  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.deployByToolUseId(meta.toolUseId, args.target);

    if (!result.success) {
      return createErrorResponse(result.error ?? 'Deploy failed');
    }

    // promote인 경우 메시지 다르게
    const actionName = args.target === 'promote' ? 'promote (stage → release)' : args.target;

    return createSuccessResponse({
      success: true,
      message: `${actionName} 배포가 완료되었어요.`,
      target: result.target,
      output: result.output,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Deploy failed: ${message}`);
  }
}
