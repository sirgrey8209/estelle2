/**
 * @file server.ts
 * @description Estelle MCP Server
 *
 * Pylon이 Claude SDK에 등록하는 MCP 서버.
 * Claude가 대화 중 사용할 수 있는 도구를 제공합니다.
 *
 * 등록 도구:
 * - send_file: 사용자에게 파일 전송
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { executeSendFile } from './tools/send-file.js';
import { executeDeploy } from './tools/deploy.js';

const WORKING_DIR = process.env.ESTELLE_WORKING_DIR || process.cwd();

const server = new Server(
  { name: 'estelle-mcp', version: '2.0.0' },
  { capabilities: { tools: {} } },
);

// 도구 목록
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'send_file',
      description: '사용자에게 파일을 전송합니다. 이미지, 마크다운, 텍스트 파일을 사용자 화면에 표시할 수 있습니다.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string',
            description: '전송할 파일의 절대 경로 또는 상대 경로',
          },
          description: {
            type: 'string',
            description: '파일에 대한 간단한 설명 (선택)',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'deploy',
      description: 'stage 또는 release 환경에 빌드 및 배포합니다. detached 프로세스로 실행되어 현재 세션에 영향을 주지 않습니다.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          target: {
            type: 'string',
            enum: ['stage', 'release'],
            description: '배포 대상 환경: stage 또는 release',
          },
        },
        required: ['target'],
      },
    },
  ],
}));

// 도구 실행
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'send_file': {
      const result = await executeSendFile(WORKING_DIR, args as { path?: string; description?: string });
      return result as unknown as Record<string, unknown>;
    }
    case 'deploy': {
      const result = await executeDeploy(args as { target?: string });
      return result as unknown as Record<string, unknown>;
    }
    default:
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      } as Record<string, unknown>;
  }
});

// 실행
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
