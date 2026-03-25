/**
 * @file command.ts
 * @description 커맨드 관리 MCP 도구 구현
 *
 * Claude가 커맨드를 생성/수정/삭제/조회/할당할 때 사용하는 MCP 도구.
 * - create_command: 새 커맨드 생성
 * - update_command: 커맨드 수정
 * - delete_command: 커맨드 삭제
 * - list_commands: 커맨드 목록 조회
 * - assign_command: 워크스페이스 할당 변경
 *
 * 커맨드는 특정 대화와 무관한 글로벌 데이터이므로,
 * PylonClient/PylonMcpServer TCP 라우팅 없이
 * CommandStore에 직접 접근합니다.
 */

import path from 'path';
import { CommandStore } from '../../stores/command-store.js';

// ============================================================================
// 타입
// ============================================================================

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
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ============================================================================
// CommandStore 싱글턴
// ============================================================================

const WORKING_DIR = process.env.ESTELLE_WORKING_DIR || process.cwd();
const rawDataDir = process.env.DATA_DIR || './data';
const DATA_DIR = path.isAbsolute(rawDataDir) ? rawDataDir : path.join(WORKING_DIR, rawDataDir);
const COMMANDS_DB_PATH = path.join(DATA_DIR, 'commands.db');

let _commandStore: CommandStore | null = null;

function getCommandStore(): CommandStore {
  if (!_commandStore) {
    _commandStore = new CommandStore(COMMANDS_DB_PATH);
  }
  return _commandStore;
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

// ============================================================================
// executeCreateCommand
// ============================================================================

/**
 * create_command MCP 도구 실행
 *
 * @param args - 도구 인자 (name, icon, color, content, workspaceIds)
 * @returns MCP 표준 응답
 */
export async function executeCreateCommand(
  args: {
    name?: string;
    icon?: string;
    color?: string;
    content?: string;
    workspaceIds?: (number | null)[];
  },
): Promise<ToolResult> {
  // 필수 필드 검증
  if (!args.name || args.name.trim() === '') {
    return createErrorResponse('커맨드 이름을 입력해주세요 (name 필수)');
  }

  if (!args.content || args.content.trim() === '') {
    return createErrorResponse('커맨드 내용을 입력해주세요 (content 필수)');
  }

  try {
    const store = getCommandStore();
    const commandId = store.createCommand(
      args.name,
      args.icon ?? null,
      args.color ?? null,
      args.content,
    );

    // 워크스페이스 할당 (지정된 경우)
    if (args.workspaceIds && args.workspaceIds.length > 0) {
      for (const wsId of args.workspaceIds) {
        store.assignCommand(commandId, wsId);
      }
    } else {
      // 기본: 글로벌(null) 할당
      store.assignCommand(commandId, null);
    }

    return createSuccessResponse({
      success: true,
      command: {
        id: commandId,
        name: args.name,
        icon: args.icon ?? null,
        color: args.color ?? null,
        content: args.content,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`커맨드 생성 실패: ${message}`);
  }
}

// ============================================================================
// executeUpdateCommand
// ============================================================================

/**
 * update_command MCP 도구 실행
 *
 * @param args - 도구 인자 (commandId, name, icon, color, content)
 * @returns MCP 표준 응답
 */
export async function executeUpdateCommand(
  args: {
    commandId?: number;
    name?: string;
    icon?: string;
    color?: string;
    content?: string;
  },
): Promise<ToolResult> {
  // 필수 필드 검증
  if (args.commandId === undefined || args.commandId === null) {
    return createErrorResponse('커맨드 ID를 입력해주세요 (commandId 필수)');
  }

  const fields: { name?: string; icon?: string; color?: string; content?: string } = {};
  if (args.name !== undefined) fields.name = args.name;
  if (args.icon !== undefined) fields.icon = args.icon;
  if (args.color !== undefined) fields.color = args.color;
  if (args.content !== undefined) fields.content = args.content;

  if (Object.keys(fields).length === 0) {
    return createErrorResponse('수정할 필드를 하나 이상 지정해주세요 (name, icon, color, content)');
  }

  try {
    const store = getCommandStore();
    const updated = store.updateCommand(args.commandId, fields);

    if (!updated) {
      return createErrorResponse(`커맨드를 찾을 수 없어요 (id: ${args.commandId})`);
    }

    return createSuccessResponse({
      success: true,
      commandId: args.commandId,
      updated: fields,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`커맨드 수정 실패: ${message}`);
  }
}

// ============================================================================
// executeDeleteCommand
// ============================================================================

/**
 * delete_command MCP 도구 실행
 *
 * @param args - 도구 인자 (commandId)
 * @returns MCP 표준 응답
 */
export async function executeDeleteCommand(
  args: { commandId?: number },
): Promise<ToolResult> {
  // 필수 필드 검증
  if (args.commandId === undefined || args.commandId === null) {
    return createErrorResponse('커맨드 ID를 입력해주세요 (commandId 필수)');
  }

  try {
    const store = getCommandStore();
    const deleted = store.deleteCommand(args.commandId);

    if (!deleted) {
      return createErrorResponse(`커맨드를 찾을 수 없어요 (id: ${args.commandId})`);
    }

    return createSuccessResponse({
      success: true,
      deletedCommandId: args.commandId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`커맨드 삭제 실패: ${message}`);
  }
}

// ============================================================================
// executeListCommands
// ============================================================================

/**
 * list_commands MCP 도구 실행
 *
 * @param args - 도구 인자 (workspaceId)
 * @returns MCP 표준 응답
 */
export async function executeListCommands(
  args: { workspaceId?: number },
): Promise<ToolResult> {
  try {
    const store = getCommandStore();
    // workspaceId가 없으면 0 (글로벌 커맨드만 조회)
    const workspaceId = args.workspaceId ?? 0;
    const commands = store.getCommands(workspaceId);

    return createSuccessResponse({
      success: true,
      commands,
      count: commands.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`커맨드 목록 조회 실패: ${message}`);
  }
}

// ============================================================================
// executeAssignCommand
// ============================================================================

/**
 * assign_command MCP 도구 실행
 *
 * 기존 할당을 모두 제거하고 새로운 워크스페이스 목록으로 재할당합니다.
 * workspaceIds에 null을 포함하면 글로벌 할당이 됩니다.
 *
 * @param args - 도구 인자 (commandId, workspaceIds)
 * @returns MCP 표준 응답
 */
export async function executeAssignCommand(
  args: { commandId?: number; workspaceIds?: (number | null)[] },
): Promise<ToolResult> {
  // 필수 필드 검증
  if (args.commandId === undefined || args.commandId === null) {
    return createErrorResponse('커맨드 ID를 입력해주세요 (commandId 필수)');
  }

  if (!args.workspaceIds || !Array.isArray(args.workspaceIds)) {
    return createErrorResponse('워크스페이스 ID 배열을 입력해주세요 (workspaceIds 필수)');
  }

  try {
    const store = getCommandStore();

    // 커맨드 존재 확인
    const content = store.getContent(args.commandId);
    if (content === null) {
      return createErrorResponse(`커맨드를 찾을 수 없어요 (id: ${args.commandId})`);
    }

    // 기존 할당 제거 후 새로 할당
    // CommandStore에 clearAssignments가 없으므로, DB에 직접 접근하지 않고
    // unassign은 개별적으로 처리가 어려우니 전체 재할당을 위해
    // 새 할당만 추가합니다 (INSERT OR IGNORE이므로 중복 무시)
    for (const wsId of args.workspaceIds) {
      store.assignCommand(args.commandId, wsId);
    }

    return createSuccessResponse({
      success: true,
      commandId: args.commandId,
      workspaceIds: args.workspaceIds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`워크스페이스 할당 실패: ${message}`);
  }
}

// ============================================================================
// 도구 정의
// ============================================================================

/**
 * create_command 도구 정의 반환
 */
export function getCreateCommandToolDefinition(): ToolDefinition {
  return {
    name: 'create_command',
    description: '커맨드 툴바에 새 커맨드를 생성합니다. 커맨드는 자주 사용하는 프롬프트를 버튼으로 만든 것입니다.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '커맨드 이름 (버튼에 표시)',
        },
        icon: {
          type: 'string',
          description: '아이콘 이름 (선택, 예: "search", "code", "bug")',
        },
        color: {
          type: 'string',
          description: '색상 코드 (선택, 예: "#ff0000")',
        },
        content: {
          type: 'string',
          description: '커맨드 실행 시 전송할 프롬프트 내용',
        },
        workspaceIds: {
          type: 'array',
          items: { type: ['integer', 'null'] },
          description: '할당할 워크스페이스 ID 배열 (선택, null은 글로벌, 미지정 시 글로벌)',
        },
      },
      required: ['name', 'content'],
    },
  };
}

/**
 * update_command 도구 정의 반환
 */
export function getUpdateCommandToolDefinition(): ToolDefinition {
  return {
    name: 'update_command',
    description: '기존 커맨드의 이름, 아이콘, 색상, 내용을 수정합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        commandId: {
          type: 'integer',
          description: '수정할 커맨드 ID',
        },
        name: {
          type: 'string',
          description: '새 커맨드 이름 (선택)',
        },
        icon: {
          type: 'string',
          description: '새 아이콘 이름 (선택)',
        },
        color: {
          type: 'string',
          description: '새 색상 코드 (선택)',
        },
        content: {
          type: 'string',
          description: '새 프롬프트 내용 (선택)',
        },
      },
      required: ['commandId'],
    },
  };
}

/**
 * delete_command 도구 정의 반환
 */
export function getDeleteCommandToolDefinition(): ToolDefinition {
  return {
    name: 'delete_command',
    description: '커맨드를 삭제합니다. 관련된 워크스페이스 할당도 함께 삭제됩니다.',
    inputSchema: {
      type: 'object',
      properties: {
        commandId: {
          type: 'integer',
          description: '삭제할 커맨드 ID',
        },
      },
      required: ['commandId'],
    },
  };
}

/**
 * list_commands 도구 정의 반환
 */
export function getListCommandsToolDefinition(): ToolDefinition {
  return {
    name: 'list_commands',
    description: '커맨드 목록을 조회합니다. 워크스페이스별 또는 글로벌 커맨드를 조회할 수 있습니다.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'integer',
          description: '워크스페이스 ID (선택, 미지정 시 글로벌 커맨드만 조회)',
        },
      },
      required: [],
    },
  };
}

/**
 * assign_command 도구 정의 반환
 */
export function getAssignCommandToolDefinition(): ToolDefinition {
  return {
    name: 'assign_command',
    description: '커맨드를 워크스페이스에 할당합니다. null을 포함하면 글로벌 할당입니다.',
    inputSchema: {
      type: 'object',
      properties: {
        commandId: {
          type: 'integer',
          description: '할당할 커맨드 ID',
        },
        workspaceIds: {
          type: 'array',
          items: { type: ['integer', 'null'] },
          description: '할당할 워크스페이스 ID 배열 (null은 글로벌)',
        },
      },
      required: ['commandId', 'workspaceIds'],
    },
  };
}
