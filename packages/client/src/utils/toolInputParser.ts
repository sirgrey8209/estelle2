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

    default: {
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
