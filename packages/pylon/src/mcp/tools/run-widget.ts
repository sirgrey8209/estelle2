/**
 * @file run-widget.ts
 * @description run_widget MCP 도구 구현
 *
 * 인터랙티브 Widget 세션을 시작하고 완료까지 대기합니다.
 */

import { PylonClient } from '../pylon-client.js';

// ============================================================================
// Types
// ============================================================================

interface RunWidgetArgs {
  command?: string;
  cwd?: string;
  args?: string[];
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
// Tool Definition
// ============================================================================

export function getRunWidgetToolDefinition() {
  return {
    name: 'run_widget',
    description: '인터랙티브 위젯 세션을 시작합니다. 유저와의 상호작용이 완료될 때까지 대기합니다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: '실행할 CLI 명령어 (예: pnpm dev)',
        },
        cwd: {
          type: 'string',
          description: '작업 디렉토리 (절대 경로)',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'CLI 인자 (선택)',
        },
      },
      required: ['command', 'cwd'],
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function createSuccessResponse(data: Record<string, unknown>): McpResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

function createErrorResponse(message: string): McpResponse {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function createPylonClient(): PylonClient {
  const mcpPort = parseInt(process.env.ESTELLE_MCP_PORT || '9880', 10);
  return new PylonClient({
    host: '127.0.0.1',
    port: mcpPort,
  });
}

// ============================================================================
// Main
// ============================================================================

export async function executeRunWidget(
  args: RunWidgetArgs,
  meta: ToolMeta,
): Promise<McpResponse> {
  if (!args.command) {
    return createErrorResponse('command is required');
  }

  if (!args.cwd) {
    return createErrorResponse('cwd is required');
  }

  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.runWidget({
      command: args.command,
      cwd: args.cwd,
      args: args.args,
      toolUseId: meta.toolUseId,
    });

    if (!result.success) {
      return createErrorResponse(result.error ?? 'Widget session failed');
    }

    return createSuccessResponse({
      success: true,
      result: result.result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Widget session failed: ${message}`);
  }
}
