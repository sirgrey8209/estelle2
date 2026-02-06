# Claude Agent SDK - query() 옵션 가이드

Claude Agent SDK의 `query()` 함수에서 사용 가능한 모든 옵션을 정리한 문서.

## 옵션 요약

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| settingSources | `SettingSource[]` | `[]` | 설정 로드 소스 |
| permissionMode | `PermissionMode` | `'default'` | 권한 처리 모드 |
| systemPrompt | `string \| preset` | - | 시스템 프롬프트 |
| canUseTool | `CanUseTool` | - | 도구 권한 콜백 |
| maxBudgetUsd | `number` | 무제한 | 최대 예산 (USD) |
| maxTurns | `number` | 무제한 | 최대 대화 턴 수 |
| maxThinkingTokens | `number` | - | 사고 프로세스 최대 토큰 |
| mcpServers | `Record<string, McpServerConfig>` | `{}` | MCP 서버 설정 |
| resume | `string` | - | 재개할 세션 ID |
| outputFormat | `{ type, schema }` | - | 구조화된 출력 형식 |
| sandbox | `SandboxSettings` | - | 샌드박스 설정 |
| hooks | `Record<HookEvent, ...>` | `{}` | 이벤트 훅 |
| agents | `Record<string, AgentDefinition>` | - | 서브에이전트 정의 |
| allowedTools | `string[]` | 전체 | 허용 도구 목록 |
| disallowedTools | `string[]` | `[]` | 비허용 도구 목록 |
| betas | `SdkBeta[]` | `[]` | 베타 기능 |
| additionalDirectories | `string[]` | `[]` | 추가 접근 디렉토리 |
| model | `string` | CLI 기본값 | 사용할 모델 |
| fallbackModel | `string` | - | 폴백 모델 |
| cwd | `string` | `process.cwd()` | 작업 디렉토리 |
| continue | `boolean` | `false` | 최근 대화 계속 |
| includePartialMessages | `boolean` | `false` | 부분 메시지 포함 |
| abortController | `AbortController` | 새 인스턴스 | 취소 제어 |

---

## 상세 설명

### settingSources

파일 시스템에서 어떤 설정을 로드할지 제어.

**가능 값:**
- `'user'`: 전역 사용자 설정 (`~/.claude/settings.json`, `~/.claude/CLAUDE.md`)
- `'project'`: 프로젝트 설정 (`.claude/settings.json`, `CLAUDE.md`)
- `'local'`: 로컬 설정 (`.claude/settings.local.json`)

**중요:** CLAUDE.md를 로드하려면 `'project'` 포함 필수.

```typescript
settingSources: ['user', 'project', 'local']
```

**설정 우선순위** (낮은 것 → 높은 것):
1. User settings
2. Project settings
3. Local settings

---

### permissionMode

도구 사용 시 권한 처리 방식.

**가능 값:**
- `'default'`: 사용자에게 승인 요청
- `'acceptEdits'`: 파일 편집 자동 승인
- `'bypassPermissions'`: 모든 권한 체크 무시 (`allowDangerouslySkipPermissions: true` 필요)
- `'plan'`: 계획 모드 (실행 없이 계획만)

```typescript
permissionMode: 'acceptEdits'
```

---

### systemPrompt

모델의 동작을 정의하는 시스템 프롬프트.

**형태 1: 커스텀 문자열**
```typescript
systemPrompt: "You are a Python expert."
```

**형태 2: 프리셋 사용**
```typescript
systemPrompt: {
  type: 'preset',
  preset: 'claude_code'
}
```

**형태 3: 프리셋 + 추가 지시**
```typescript
systemPrompt: {
  type: 'preset',
  preset: 'claude_code',
  append: "Always include comments."
}
```

---

### canUseTool

도구 사용 전 커스텀 권한 검사 콜백.

**시그니처:**
```typescript
async (
  toolName: string,
  input: ToolInput,
  context: { signal?: AbortSignal; suggestions?: PermissionUpdate[] }
) => Promise<
  | { behavior: 'allow'; updatedInput?: ToolInput }
  | { behavior: 'deny'; message: string; interrupt?: boolean }
>
```

**예시:**
```typescript
canUseTool: async (toolName, input) => {
  // 위험한 명령어 차단
  if (toolName === 'Bash' && input.command?.includes('rm -rf /')) {
    return {
      behavior: 'deny',
      message: 'Dangerous command blocked',
      interrupt: true
    };
  }
  return { behavior: 'allow' };
}
```

---

### maxBudgetUsd

세션의 최대 예산 (USD).

```typescript
maxBudgetUsd: 5.00  // 최대 $5
```

예산 초과 시 `error_max_budget_usd` 서브타입 결과 반환.

---

### maxTurns

최대 대화 턴(왕복) 수.

```typescript
maxTurns: 10  // 최대 10번 왕복
```

---

### maxThinkingTokens

Extended thinking의 최대 토큰 수.

```typescript
maxThinkingTokens: 10000
```

---

### mcpServers

Model Context Protocol (MCP) 서버 연결.

**서버 타입:**
- `stdio`: 로컬 프로세스
- `sse`: Server-Sent Events URL
- `http`: HTTP 서버
- `sdk`: SDK 내부 서버

```typescript
mcpServers: {
  filesystem: {
    type: 'stdio',
    command: 'mcp-server-filesystem',
    args: ['/home/user/projects']
  }
}
```

**SDK 도구 예시:**
```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const calculator = createSdkMcpServer({
  name: 'calculator',
  version: '1.0.0',
  tools: [
    tool('add', 'Add two numbers', { a: z.number(), b: z.number() },
      async (args) => ({
        content: [{ type: 'text', text: `${args.a + args.b}` }]
      })
    )
  ]
});

mcpServers: {
  calc: calculator
}
```

---

### resume

이전 세션 재개.

```typescript
resume: 'session-abc123'  // 세션 ID
```

---

### outputFormat

구조화된 출력 형식 (JSON Schema).

```typescript
outputFormat: {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' }
    },
    required: ['name', 'email']
  }
}
```

---

### sandbox

명령어 실행 샌드박싱.

**속성:**
- `enabled`: 샌드박스 활성화
- `autoAllowBashIfSandboxed`: bash 자동 승인
- `excludedCommands`: 샌드박스 우회 명령어 (예: docker)
- `allowUnsandboxedCommands`: 모델이 샌드박스 우회 요청 가능
- `network`: 네트워크 제한

```typescript
sandbox: {
  enabled: true,
  autoAllowBashIfSandboxed: true,
  excludedCommands: ['docker'],
  network: {
    allowLocalBinding: true,
    allowUnixSockets: ['/var/run/docker.sock']
  }
}
```

---

### hooks

이벤트 훅 콜백.

**가능한 이벤트:**
- `PreToolUse`: 도구 사용 전
- `PostToolUse`: 도구 사용 후
- `PostToolUseFailure`: 도구 실행 실패
- `UserPromptSubmit`: 사용자 프롬프트 제출
- `SessionStart`: 세션 시작
- `SessionEnd`: 세션 종료
- `Stop`: 정지
- `SubagentStart/Stop`: 서브에이전트 시작/종료
- `PreCompact`: 메시지 압축 전
- `Notification`: 알림

```typescript
hooks: {
  PreToolUse: [{
    matcher: 'Bash',  // 특정 도구에만 적용
    hooks: [
      async (input, toolUseId, context) => {
        console.log(`Running: ${input.tool_input.command}`);
        return {};
      }
    ]
  }],
  PostToolUse: [{
    hooks: [
      async (input, toolUseId, context) => {
        console.log(`Completed: ${input.tool_name}`);
        return {};
      }
    ]
  }]
}
```

---

### agents

프로그래밍 방식 서브에이전트 정의.

```typescript
agents: {
  codeReviewer: {
    description: "Review code for quality and bugs",
    prompt: "You are a strict code reviewer...",
    tools: ['Read', 'Grep'],
    model: 'opus'
  },
  tester: {
    description: "Run tests and verify functionality",
    prompt: "You are a QA engineer...",
    tools: ['Bash', 'Read'],
    model: 'sonnet'
  }
}
```

**AgentDefinition 속성:**
- `description`: 사용 시기 설명
- `prompt`: 에이전트 시스템 프롬프트
- `tools`: 도구 목록 (생략 시 모두 상속)
- `model`: `'sonnet' | 'opus' | 'haiku' | 'inherit'`

---

### allowedTools / disallowedTools

도구 사용 제한.

```typescript
// 이 도구들만 사용 가능
allowedTools: ['Read', 'Edit', 'Bash']

// 이 도구들은 사용 불가
disallowedTools: ['Write', 'WebFetch']
```

---

### betas

베타 기능 활성화.

**가능 값:**
- `'context-1m-2025-08-07'`: 100만 토큰 컨텍스트 윈도우

```typescript
betas: ['context-1m-2025-08-07']
```

---

### additionalDirectories

Claude가 접근 가능한 추가 디렉토리.

```typescript
additionalDirectories: [
  '/home/user/project-a',
  '/home/user/project-b'
]
```

---

### model / fallbackModel

모델 선택.

```typescript
model: 'claude-opus-4-5-20251101',
fallbackModel: 'claude-sonnet-4-20250514'  // 주 모델 실패 시
```

---

### cwd

작업 디렉토리.

```typescript
cwd: '/absolute/path/to/project'
```

---

### continue

최근 대화 계속.

```typescript
continue: true
```

---

## 종합 예시

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const result = query({
  prompt: "Review and test the code",
  options: {
    // 기본 설정
    model: 'claude-opus-4-5-20251101',
    cwd: '/path/to/project',

    // 시스템 프롬프트
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: "Focus on security and performance."
    },

    // 설정 로드 (CLAUDE.md 포함)
    settingSources: ['user', 'project', 'local'],

    // 도구 제한
    allowedTools: ['Read', 'Grep', 'Bash', 'Edit'],

    // 권한
    permissionMode: 'acceptEdits',
    canUseTool: async (tool, input) => {
      if (tool === 'Bash' && input.command?.includes('rm')) {
        return { behavior: 'deny', message: 'Deletion blocked' };
      }
      return { behavior: 'allow' };
    },

    // 서브에이전트
    agents: {
      reviewer: {
        description: "Code review specialist",
        prompt: "Review code for quality...",
        tools: ['Read', 'Grep']
      }
    },

    // 샌드박스
    sandbox: {
      enabled: true,
      network: { allowLocalBinding: true }
    },

    // 제한
    maxTurns: 10,
    maxBudgetUsd: 10.00,

    // 베타
    betas: ['context-1m-2025-08-07']
  }
});

for await (const message of result) {
  console.log(message);
}
```

---

## 참고

- [TypeScript Agent SDK Reference](https://platform.claude.com/docs/en/agent-sdk/typescript.md)
- [Python Agent SDK Reference](https://platform.claude.com/docs/en/agent-sdk/python.md)
