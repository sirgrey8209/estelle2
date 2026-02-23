/**
 * Tool Input Parser
 *
 * 도구 이름과 입력을 받아 사람이 읽기 좋은 형식으로 변환합니다.
 */

export interface ParsedToolInput {
  /** 설명 (예: "Read file", "Edit file") */
  desc: string;
  /** 명령/경로 (예: 파일 경로, 명령어) */
  cmd: string;
}

/**
 * MCP 도구 이름 파싱 결과
 */
export interface ParsedMcpToolName {
  /** MCP 도구인지 여부 */
  isMcp: boolean;
  /** MCP 서버 이름 (예: "estelle-mcp") */
  serverName: string;
  /** 실제 도구 이름 (예: "send_file") */
  toolName: string;
}

/**
 * MCP 서버명 정리
 * - 접두/접미 mcp 제거: -mcp, _mcp, mcp-, mcp_ (단어 경계에서만)
 * - 영문/한글 외 문자 trim
 * - 첫글자 대문자
 *
 * @example
 * formatMcpServerName('estelle-mcp') // 'Estelle'
 * formatMcpServerName('mcp-slack') // 'Slack'
 * formatMcpServerName('my_mcp_server') // 'My_mcp_server' (중간 mcp는 유지)
 */
function formatMcpServerName(serverName: string): string {
  let result = serverName;

  // 접두/접미 mcp만 제거 (대소문자 무시)
  // 시작: mcp- 또는 mcp_
  result = result.replace(/^mcp[-_]/i, '');
  // 끝: -mcp 또는 _mcp
  result = result.replace(/[-_]mcp$/i, '');

  // 영문/한글 외 앞뒤 문자 trim
  result = result.replace(/^[^a-zA-Z가-힣]+/, '').replace(/[^a-zA-Z가-힣]+$/, '');

  // 빈 문자열이면 원본 반환
  if (!result) {
    result = serverName;
  }

  // 첫글자 대문자
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * MCP 도구 이름 파싱
 * 형식: mcp__{server}__{tool}
 *
 * @example
 * parseMcpToolName('mcp__estelle-mcp__send_file')
 * // { isMcp: true, serverName: 'Estelle', toolName: 'send_file' }
 */
export function parseMcpToolName(fullToolName: string): ParsedMcpToolName {
  if (!fullToolName.startsWith('mcp__')) {
    return { isMcp: false, serverName: '', toolName: fullToolName };
  }

  // mcp__{server}__{tool} 형식
  const withoutPrefix = fullToolName.slice(5); // 'mcp__' 제거
  const separatorIdx = withoutPrefix.indexOf('__');

  if (separatorIdx === -1) {
    return { isMcp: true, serverName: formatMcpServerName(withoutPrefix), toolName: '' };
  }

  return {
    isMcp: true,
    serverName: formatMcpServerName(withoutPrefix.slice(0, separatorIdx)),
    toolName: withoutPrefix.slice(separatorIdx + 2),
  };
}

/**
 * 도구 입력을 파싱합니다.
 *
 * @param toolName 도구 이름
 * @param input 도구 입력
 * @returns 파싱된 결과
 */
export function parseToolInput(
  toolName: string,
  input?: Record<string, unknown>
): ParsedToolInput {
  if (!input) {
    return { desc: toolName, cmd: '' };
  }

  switch (toolName) {
    case 'Bash':
      return {
        desc: (input.description as string) || 'Run command',
        cmd: (input.command as string) || '',
      };

    case 'Read':
      return {
        desc: 'Read file',
        cmd: (input.file_path as string) || '',
      };

    case 'Edit':
      return {
        desc: 'Edit file',
        cmd: (input.file_path as string) || '',
      };

    case 'Write':
      return {
        desc: 'Write file',
        cmd: (input.file_path as string) || '',
      };

    case 'Glob': {
      const path = input.path as string | undefined;
      return {
        desc: path ? `Search in ${path}` : 'Search files',
        cmd: (input.pattern as string) || '',
      };
    }

    case 'Grep': {
      const path = input.path as string | undefined;
      return {
        desc: path ? `Search in ${path}` : 'Search content',
        cmd: (input.pattern as string) || '',
      };
    }

    case 'WebFetch':
      return {
        desc: 'Fetch URL',
        cmd: (input.url as string) || '',
      };

    case 'WebSearch':
      return {
        desc: 'Web search',
        cmd: (input.query as string) || '',
      };

    case 'Task': {
      const prompt = (input.prompt as string) || '';
      return {
        desc: (input.description as string) || 'Run task',
        cmd: prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt,
      };
    }

    case 'TodoWrite': {
      const todos = input.todos;
      const count = Array.isArray(todos) ? todos.length : 0;
      return {
        desc: 'Update todos',
        cmd: `${count} items`,
      };
    }

    case 'ToolSearch':
      return {
        desc: (input.query as string) || '',
        cmd: '',
      };

    default: {
      // MCP 도구 처리
      const mcp = parseMcpToolName(toolName);
      if (mcp.isMcp) {
        return parseMcpToolInput(mcp.serverName, mcp.toolName, input);
      }

      // 첫 번째 string 값 찾기
      const firstVal = Object.values(input).find(
        (v) => typeof v === 'string'
      ) as string | undefined;
      return {
        desc: toolName,
        cmd:
          firstVal && firstVal.length > 80
            ? firstVal.substring(0, 80) + '...'
            : firstVal || '',
      };
    }
  }
}

/**
 * MCP 도구 입력 파싱
 */
function parseMcpToolInput(
  serverName: string,
  toolName: string,
  input: Record<string, unknown>
): ParsedToolInput {
  // estelle-mcp 서버 도구들
  if (serverName === 'estelle-mcp') {
    switch (toolName) {
      case 'send_file':
        return {
          desc: 'send file',
          cmd: (input.path as string) || '',
        };
      case 'link_doc':
        return {
          desc: 'link document',
          cmd: (input.path as string) || '',
        };
      case 'unlink_doc':
        return {
          desc: 'unlink document',
          cmd: (input.path as string) || '',
        };
      case 'list_docs':
        return {
          desc: 'list documents',
          cmd: '',
        };
      case 'deploy':
        return {
          desc: 'deploy',
          cmd: (input.target as string) || '',
        };
    }
  }

  // 기타 MCP 도구 - 도구명 표시
  const displayName = toolName.replace(/_/g, ' ');
  const firstVal = Object.values(input).find(
    (v) => typeof v === 'string'
  ) as string | undefined;

  return {
    desc: displayName,
    cmd: firstVal && firstVal.length > 80
      ? firstVal.substring(0, 80) + '...'
      : firstVal || '',
  };
}
