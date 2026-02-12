/**
 * @file server.ts
 * @description Estelle MCP Server
 *
 * Beacon이 Claude SDK에 등록하는 MCP 서버.
 * Claude가 대화 중 사용할 수 있는 도구를 제공합니다.
 *
 * 등록 도구:
 * - send_file: 사용자에게 파일 전송
 * - link_doc / unlink_doc / list_docs: 문서 연결 관리
 * - deploy: stage/release 배포
 */

import fs from 'fs';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { executeSendFile } from './tools/send-file.js';
import {
  executeLinkDoc,
  executeUnlinkDoc,
  executeListDocs,
  getLinkDocToolDefinition,
  getUnlinkDocToolDefinition,
  getListDocsToolDefinition,
} from './tools/link-document.js';
import { executeDeploy, deployToolDefinition } from './tools/deploy.js';

const WORKING_DIR = process.env.ESTELLE_WORKING_DIR || process.cwd();

// DEBUG: 파일 로그
const LOG_FILE = path.join(WORKING_DIR, '.estelle-mcp-debug.log');
function debugLog(message: string): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, logLine);
  } catch {
    // 로그 실패 무시
  }
}

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
    getLinkDocToolDefinition(),
    getUnlinkDocToolDefinition(),
    getListDocsToolDefinition(),
    deployToolDefinition,
  ],
}));

// 도구 실행
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const meta = (request.params as Record<string, unknown>)._meta as Record<string, unknown> | undefined;
  const toolUseId = (meta?.['claudecode/toolUseId'] as string) || '';

  debugLog(`[MCP] Tool call: ${request.params.name}, toolUseId: ${toolUseId}`);

  const { name, arguments: args } = request.params;

  switch (name) {
    case 'send_file': {
      const result = await executeSendFile(WORKING_DIR, args as { path?: string; description?: string });
      return result as unknown as Record<string, unknown>;
    }
    case 'link_doc': {
      const result = await executeLinkDoc(args as { path?: string }, { toolUseId });
      return result as unknown as Record<string, unknown>;
    }
    case 'unlink_doc': {
      const result = await executeUnlinkDoc(args as { path?: string }, { toolUseId });
      return result as unknown as Record<string, unknown>;
    }
    case 'list_docs': {
      const result = await executeListDocs(args as Record<string, unknown>, { toolUseId });
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
