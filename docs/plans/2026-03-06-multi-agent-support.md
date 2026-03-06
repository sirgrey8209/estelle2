# Multi-Agent Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Claude Code와 Codex를 공통 인터페이스로 추상화하여 대화 생성 시 에이전트를 선택할 수 있게 함

**Architecture:** 기존 `claude/` 디렉토리를 `agent/`로 리네이밍하고, `AgentAdapter` 인터페이스에 `CodexSDKAdapter`를 추가. 대화(Conversation) 타입에 `agentType` 필드를 추가하고 MCP 도구/클라이언트 UI에서 에이전트 선택 지원.

**Tech Stack:** TypeScript, @openai/codex-sdk, pnpm monorepo

**핵심 원칙:** Claude Code 기존 로직에 영향 없이 리네이밍만 수행. Codex 어댑터는 완전히 새로 추가.

---

## Phase 1: 리네이밍 (로직 변경 없음)

### Task 1.1: AgentType 타입 정의 추가

**Files:**
- Create: `packages/core/src/types/agent.ts`
- Modify: `packages/core/src/types/index.ts`

**Step 1: agent.ts 파일 생성**

```typescript
// packages/core/src/types/agent.ts
/**
 * @file agent.ts
 * @description 에이전트 타입 정의
 *
 * Estelle이 지원하는 AI 에이전트 타입을 정의합니다.
 */

/**
 * 에이전트 타입
 *
 * @description
 * - `claude`: Claude Code (Anthropic)
 * - `codex`: Codex CLI (OpenAI)
 */
export type AgentType = 'claude' | 'codex';

/**
 * 기본 에이전트 타입
 */
export const DEFAULT_AGENT_TYPE: AgentType = 'claude';

/**
 * AgentType 타입 가드
 */
export function isAgentType(value: unknown): value is AgentType {
  return value === 'claude' || value === 'codex';
}
```

**Step 2: core/types/index.ts에 export 추가**

`packages/core/src/types/index.ts` 끝에 추가:

```typescript
export {
  type AgentType,
  DEFAULT_AGENT_TYPE,
  isAgentType,
} from './agent.js';
```

**Step 3: 빌드 확인**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/core/src/types/agent.ts packages/core/src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(core): add AgentType type definition

- Add AgentType = 'claude' | 'codex'
- Add DEFAULT_AGENT_TYPE constant
- Add isAgentType type guard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Conversation 타입에 agentType 필드 추가

**Files:**
- Modify: `packages/core/src/types/workspace.ts:63-94`

**Step 1: Conversation 인터페이스에 agentType 추가**

`packages/core/src/types/workspace.ts`에서 import 추가:

```typescript
import type { AgentType } from './agent.js';
```

`Conversation` 인터페이스에 필드 추가 (linkedDocuments 앞에):

```typescript
  /** 에이전트 타입 (claude, codex) */
  agentType: AgentType;
```

**Step 2: 빌드 확인**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: 타입 에러 발생 (Conversation 생성하는 곳에서 agentType 누락)

**Step 3: Conversation 생성 부분 수정**

Grep으로 Conversation 생성 부분을 찾아서 `agentType: 'claude'` 추가.
(workspace-store.ts, pylon-mcp-server.ts 등)

**Step 4: 빌드 확인**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: BUILD SUCCESS

**Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(core): add agentType field to Conversation

- Add agentType: AgentType to Conversation interface
- Default to 'claude' in all existing conversation creation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: claude/ 디렉토리를 agent/로 리네이밍

**Files:**
- Rename: `packages/pylon/src/claude/` → `packages/pylon/src/agent/`
- Modify: All files importing from `./claude/`

**Step 1: 디렉토리 이동**

```bash
cd /home/estelle/estelle2/packages/pylon/src
git mv claude agent
```

**Step 2: import 경로 수정**

모든 `./claude/` 또는 `../claude/` import를 `./agent/` 또는 `../agent/`로 변경:
- `packages/pylon/src/bin.ts`
- `packages/pylon/src/pylon.ts`
- `packages/pylon/src/index.ts`
- `packages/pylon/src/stores/workspace-store.ts`
- `packages/pylon/src/servers/pylon-mcp-server.ts`

**Step 3: 빌드 확인**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(pylon): rename claude/ directory to agent/

- Move packages/pylon/src/claude/ to packages/pylon/src/agent/
- Update all import paths
- No logic changes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: 타입/클래스 리네이밍 (Claude → Agent)

**Files:**
- Modify: `packages/pylon/src/agent/claude-manager.ts`
- Modify: `packages/pylon/src/agent/index.ts`
- Modify: All files using Claude* types

**Step 1: claude-manager.ts 내 타입 리네이밍**

| Before | After |
|--------|-------|
| `ClaudeManagerEventType` | `AgentManagerEventType` |
| `ClaudeState` | `AgentState` |
| `ClaudeSession` | `AgentSession` |
| `ClaudeEventHandler` | `AgentEventHandler` |
| `ClaudeManagerEvent` | `AgentManagerEvent` |
| `ClaudeAdapter` | `AgentAdapter` |
| `ClaudeQueryOptions` | `AgentQueryOptions` |
| `ClaudeMessage` | `AgentMessage` |
| `ClaudeManagerOptions` | `AgentManagerOptions` |
| `ClaudeManager` | `AgentManager` |

파일명은 유지: `claude-manager.ts` → `agent-manager.ts`

**Step 2: index.ts export 수정**

`packages/pylon/src/agent/index.ts`에서 모든 export 이름 변경.

**Step 3: claude-sdk-adapter.ts 수정**

import 경로와 타입 이름 변경:

```typescript
import type {
  AgentAdapter,
  AgentQueryOptions,
  AgentMessage,
  PermissionCallbackResult,
} from './agent-manager.js';
```

**Step 4: 사용처 수정**

모든 `ClaudeManager`, `ClaudeAdapter` 등 사용처를 `AgentManager`, `AgentAdapter`로 변경.

**Step 5: 빌드 확인**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: BUILD SUCCESS

**Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(pylon): rename Claude* types to Agent*

- ClaudeManager → AgentManager
- ClaudeAdapter → AgentAdapter
- ClaudeSession → AgentSession
- ClaudeMessage → AgentMessage
- And all related types
- No logic changes, pure renaming

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Codex 어댑터 추가

### Task 2.1: @openai/codex-sdk 패키지 설치

**Files:**
- Modify: `packages/pylon/package.json`

**Step 1: 패키지 설치**

```bash
cd /home/estelle/estelle2/packages/pylon
pnpm add @openai/codex-sdk
```

**Step 2: 빌드 확인**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/pylon/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
deps(pylon): add @openai/codex-sdk

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: CodexSDKAdapter 구현

**Files:**
- Create: `packages/pylon/src/agent/codex-sdk-adapter.ts`
- Modify: `packages/pylon/src/agent/index.ts`

**Step 1: codex-sdk-adapter.ts 생성**

```typescript
// packages/pylon/src/agent/codex-sdk-adapter.ts
/**
 * @file codex-sdk-adapter.ts
 * @description OpenAI Codex SDK를 래핑하는 어댑터
 *
 * @openai/codex-sdk의 Thread를 AgentAdapter 인터페이스에 맞게 래핑합니다.
 * Codex 이벤트를 AgentMessage 형식으로 변환하여 AgentManager에서 처리할 수 있게 합니다.
 */

import { Codex } from '@openai/codex-sdk';
import type { Thread, ThreadEvent } from '@openai/codex-sdk';
import type {
  AgentAdapter,
  AgentQueryOptions,
  AgentMessage,
} from './agent-manager.js';

/**
 * Codex SDK 어댑터
 *
 * @description
 * @openai/codex-sdk의 Thread를 AgentAdapter 인터페이스로 래핑합니다.
 * Codex 이벤트를 Claude SDK 메시지 형식으로 변환하여 기존 AgentManager와 호환됩니다.
 */
export class CodexSDKAdapter implements AgentAdapter {
  private codex: Codex;
  private threads: Map<string, Thread> = new Map();

  constructor() {
    this.codex = new Codex();
  }

  /**
   * Codex에 쿼리 실행
   *
   * @param options - 쿼리 옵션
   * @returns 변환된 AgentMessage 스트림
   */
  async *query(options: AgentQueryOptions): AsyncIterable<AgentMessage> {
    // 스레드 생성 또는 재개
    const thread = options.resume
      ? this.codex.resumeThread(options.resume)
      : this.codex.startThread({
          workingDirectory: options.cwd,
          approvalPolicy: 'never', // MVP: 자동 승인
          sandboxMode: 'workspace-write',
        });

    // 스레드 ID 저장 (나중에 재개용)
    const threadId = (thread as { id?: string }).id;
    if (threadId) {
      this.threads.set(threadId, thread);
    }

    // AbortSignal 설정
    const signal = options.abortController?.signal;

    try {
      const { events } = await thread.runStreamed(options.prompt, { signal });

      for await (const event of events) {
        yield this.convertToAgentMessage(event, threadId);
      }
    } catch (err) {
      // 중단 시 에러 무시
      if (signal?.aborted) {
        return;
      }
      throw err;
    }
  }

  /**
   * Codex 이벤트를 AgentMessage로 변환
   *
   * @description
   * Codex 이벤트를 Claude SDK 메시지 형식으로 변환합니다.
   * AgentManager가 동일한 로직으로 처리할 수 있게 합니다.
   */
  private convertToAgentMessage(
    event: ThreadEvent,
    threadId?: string
  ): AgentMessage {
    switch (event.type) {
      case 'thread.started':
        return {
          type: 'system',
          subtype: 'init',
          session_id: threadId || event.thread_id,
          model: 'codex',
          tools: [],
        };

      case 'turn.started':
        return {
          type: 'stream_event',
          event: { type: 'message_start', message: { usage: {} } },
        };

      case 'item.completed':
        return this.convertItemCompleted(event);

      case 'turn.completed':
        return {
          type: 'result',
          subtype: 'turn_complete',
          usage: event.usage
            ? {
                input_tokens: event.usage.input_tokens,
                output_tokens: event.usage.output_tokens,
              }
            : undefined,
        };

      case 'turn.failed':
        return {
          type: 'result',
          subtype: 'error',
        };

      default:
        // 알 수 없는 이벤트는 빈 메시지로 변환
        return { type: 'unknown' };
    }
  }

  /**
   * item.completed 이벤트 변환
   */
  private convertItemCompleted(event: ThreadEvent): AgentMessage {
    const item = (event as { item?: { type: string; [key: string]: unknown } }).item;
    if (!item) {
      return { type: 'unknown' };
    }

    switch (item.type) {
      case 'agent_message':
        return {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'text',
                text: (item as { text?: string }).text || '',
              },
            ],
          },
        };

      case 'command_execution':
        return {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: (item as { id?: string }).id,
                content: (item as { aggregated_output?: string }).aggregated_output || '',
                is_error: (item as { status?: string }).status === 'failed',
              },
            ],
          },
        };

      case 'file_change':
        return {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: (item as { id?: string }).id,
                content: JSON.stringify((item as { changes?: unknown[] }).changes || []),
                is_error: (item as { status?: string }).status === 'failed',
              },
            ],
          },
        };

      case 'mcp_tool_call':
        return {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: (item as { id?: string }).id,
                content: JSON.stringify((item as { result?: unknown }).result || {}),
                is_error: (item as { status?: string }).status === 'failed',
              },
            ],
          },
        };

      default:
        return { type: 'unknown' };
    }
  }
}
```

**Step 2: index.ts에 export 추가**

`packages/pylon/src/agent/index.ts`에 추가:

```typescript
export { CodexSDKAdapter } from './codex-sdk-adapter.js';
```

**Step 3: 빌드 확인**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/pylon/src/agent/codex-sdk-adapter.ts packages/pylon/src/agent/index.ts
git commit -m "$(cat <<'EOF'
feat(pylon): add CodexSDKAdapter

- Implement AgentAdapter interface for Codex SDK
- Convert Codex ThreadEvents to AgentMessage format
- Support thread resume via session ID

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: AgentManager에서 에이전트 선택 로직 추가

**Files:**
- Modify: `packages/pylon/src/agent/agent-manager.ts`

**Step 1: AgentManagerOptions에 어댑터 팩토리 추가**

```typescript
export interface AgentManagerOptions {
  // ... 기존 필드 ...

  /** Claude SDK 어댑터 */
  claudeAdapter?: AgentAdapter;

  /** Codex SDK 어댑터 */
  codexAdapter?: AgentAdapter;
}
```

**Step 2: 생성자에서 어댑터 저장**

```typescript
private readonly claudeAdapter?: AgentAdapter;
private readonly codexAdapter?: AgentAdapter;

constructor(options: AgentManagerOptions) {
  // ... 기존 코드 ...
  this.claudeAdapter = options.claudeAdapter;
  this.codexAdapter = options.codexAdapter;
}
```

**Step 3: SendMessageOptions에 agentType 추가**

```typescript
export interface SendMessageOptions {
  // ... 기존 필드 ...

  /** 에이전트 타입 (기본값: 'claude') */
  agentType?: AgentType;
}
```

**Step 4: runQuery에서 어댑터 선택**

```typescript
private async runQuery(...) {
  // ... 기존 코드 ...

  // 어댑터 선택
  const agentType = sessionInfo.agentType || 'claude';
  const adapter = agentType === 'codex' ? this.codexAdapter : this.claudeAdapter;

  if (!adapter) {
    this.emitEvent(sessionId, {
      type: 'error',
      error: `${agentType} adapter not configured`,
    });
    return;
  }

  // 쿼리 실행
  const query = adapter.query(queryOptions);
  // ... 나머지 코드 ...
}
```

**Step 5: 빌드 확인**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: BUILD SUCCESS

**Step 6: Commit**

```bash
git add packages/pylon/src/agent/agent-manager.ts
git commit -m "$(cat <<'EOF'
feat(pylon): add agent selection to AgentManager

- Add claudeAdapter and codexAdapter to options
- Add agentType to SendMessageOptions
- Select adapter based on agentType in runQuery

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: MCP 도구 및 대화 생성 연동

### Task 3.1: create_conversation MCP 도구에 agent 파라미터 추가

**Files:**
- Modify: `packages/pylon/src/mcp/tools/conversation.ts`
- Modify: `packages/pylon/src/mcp/pylon-client.ts`

**Step 1: executeCreateConversation 인자 수정**

```typescript
export async function executeCreateConversation(
  args: { name?: string; files?: string[]; agent?: string },
  meta: ToolMeta,
): Promise<ToolResult> {
  // ... 기존 코드 ...
  const result = await pylonClient.createConversationByToolUseId(
    meta.toolUseId,
    args.name,
    args.files,
    args.agent as AgentType | undefined,
  );
  // ...
}
```

**Step 2: 도구 정의에 agent 파라미터 추가**

```typescript
export function getCreateConversationToolDefinition(): ToolDefinition {
  return {
    // ... 기존 코드 ...
    inputSchema: {
      type: 'object',
      properties: {
        name: { ... },
        files: { ... },
        agent: {
          type: 'string',
          enum: ['claude', 'codex'],
          description: '사용할 에이전트 (선택, 기본값: "claude")',
        },
      },
      required: [],
    },
  };
}
```

**Step 3: PylonClient에 agent 파라미터 전달**

`packages/pylon/src/mcp/pylon-client.ts`:

```typescript
async createConversationByToolUseId(
  toolUseId: string,
  name?: string,
  files?: string[],
  agent?: AgentType,
): Promise<ConversationResult> {
  // ... agent를 요청에 포함 ...
}
```

**Step 4: 빌드 확인**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: BUILD SUCCESS

**Step 5: Commit**

```bash
git add packages/pylon/src/mcp/tools/conversation.ts packages/pylon/src/mcp/pylon-client.ts
git commit -m "$(cat <<'EOF'
feat(mcp): add agent parameter to create_conversation tool

- Add agent: 'claude' | 'codex' parameter
- Pass agent type through PylonClient

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: Pylon 초기화 시 어댑터 연결

**Files:**
- Modify: `packages/pylon/src/bin.ts`
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: bin.ts에서 두 어댑터 생성**

```typescript
import { ClaudeSDKAdapter, CodexSDKAdapter } from './agent/index.js';

// ... 기존 코드 ...

const claudeAdapter = new ClaudeSDKAdapter();
const codexAdapter = new CodexSDKAdapter();

// AgentManager 생성 시 전달
const agentManager = new AgentManager({
  claudeAdapter,
  codexAdapter,
  // ... 기존 옵션 ...
});
```

**Step 2: 빌드 확인**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/pylon/src/bin.ts
git commit -m "$(cat <<'EOF'
feat(pylon): initialize both Claude and Codex adapters

- Create ClaudeSDKAdapter and CodexSDKAdapter in bin.ts
- Pass both adapters to AgentManager

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: 클라이언트 UI (별도 세션에서 진행)

클라이언트 UI 변경은 별도 세션에서 진행:
- 워크스페이스/대화 생성 UI에 에이전트 선택 추가
- 에이전트 타입 표시 (아이콘/레이블)

---

## Verification Checklist

각 Phase 완료 후 확인:

1. **Phase 1 완료 후:**
   - [ ] `pnpm build` 성공
   - [ ] 기존 Claude 대화 정상 동작
   - [ ] 모든 import 경로 정상

2. **Phase 2 완료 후:**
   - [ ] `pnpm build` 성공
   - [ ] Codex SDK import 정상
   - [ ] CodexSDKAdapter 타입 검사 통과

3. **Phase 3 완료 후:**
   - [ ] `pnpm build` 성공
   - [ ] create_conversation 도구에 agent 파라미터 노출
   - [ ] 새 대화 생성 시 agentType 저장됨
