/**
 * @file run-widget-inline.ts
 * @description run_widget_inline MCP 도구 구현
 *
 * CLI 프로세스 없이 인라인 위젯을 렌더링합니다.
 */

import { PylonClient } from '../pylon-client.js';

// ============================================================================
// Types
// ============================================================================

interface RunWidgetInlineArgs {
  html: string;
  code?: string;
  height?: number;
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

export function getRunWidgetInlineToolDefinition() {
  return {
    name: 'run_widget_inline',
    description: '인라인 위젯을 렌더링합니다. CLI 프로세스 없이 Client에서 직접 실행됩니다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        html: {
          type: 'string',
          description: 'HTML 템플릿 (CSS 포함 가능)',
        },
        code: {
          type: 'string',
          description: 'JavaScript 코드 (선택)',
        },
        height: {
          type: 'number',
          description: '초기 높이 픽셀 (선택, 기본 auto)',
        },
      },
      required: ['html'],
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

export async function executeRunWidgetInline(
  args: RunWidgetInlineArgs,
  meta: ToolMeta,
): Promise<McpResponse> {
  if (!args.html) {
    return createErrorResponse('html is required');
  }

  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.runWidgetInline({
      html: args.html,
      code: args.code,
      height: args.height,
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
