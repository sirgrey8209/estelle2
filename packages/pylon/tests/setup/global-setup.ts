/**
 * @file global-setup.ts
 * @description Vitest 글로벌 설정 - 테스트 서버 시작/종료
 *
 * get-status.test.ts 등 MCP 도구 테스트에서 필요한 PylonMcpServer를 글로벌하게 시작합니다.
 * 포트 19879에서 리스닝합니다.
 */

import type { WorkspaceStore as WorkspaceStoreType } from '../../src/stores/workspace-store.js';
import type { PylonMcpServer as PylonMcpServerType } from '../../src/servers/pylon-mcp-server.js';

let server: PylonMcpServerType | null = null;
let workspaceStore: WorkspaceStoreType | null = null;

// 테스트용 상수
const TEST_PORT = 19879;
const PYLON_ID = 1;
// encodeConversationId(1, 1, 1) = (1 << 17) | (1 << 10) | 1 = 132097
const TEST_CONVERSATION_ID = 132097;
const TEST_TOOL_USE_IDS = [
  'toolu_get_status_test_123',
  'toolu_add_prompt_test_123',
];

export async function setup(): Promise<void> {
  // 동적 import로 모듈 로드 (빌드 전에도 동작하도록)
  const { WorkspaceStore } = await import('../../src/stores/workspace-store.js');
  const { PylonMcpServer } = await import('../../src/servers/pylon-mcp-server.js');

  // WorkspaceStore 설정
  workspaceStore = new WorkspaceStore(PYLON_ID);
  const { workspace } = workspaceStore.createWorkspace('Test Workspace', 'C:\\test');
  workspaceStore.createConversation(workspace.workspaceId, 'Test Conversation');

  // PylonMcpServer 시작
  server = new PylonMcpServer(workspaceStore, {
    port: TEST_PORT,
    getConversationIdByToolUseId: (toolUseId: string) => {
      if (TEST_TOOL_USE_IDS.includes(toolUseId)) {
        return TEST_CONVERSATION_ID;
      }
      return null;
    },
    onNewSession: () => {
      // 테스트에서는 실제로 새 세션을 시작하지 않음
    },
  });

  await server.listen();
  console.log(`[GlobalSetup] Test server started on port ${TEST_PORT}`);
}

export async function teardown(): Promise<void> {
  if (server) {
    await server.close();
    console.log('[GlobalSetup] Test server stopped');
  }
}
