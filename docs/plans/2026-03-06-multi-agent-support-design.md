# Multi-Agent Support Design (Claude + Codex)

## Overview

Estelle에서 Claude Code와 OpenAI Codex를 동시에 지원하기 위한 설계.
대화 생성 시 에이전트를 선택할 수 있고, 공통 인터페이스로 추상화하여 기존 Claude Code 기능에 영향을 주지 않음.

## Goals

1. 대화 생성 시 Claude / Codex 선택 가능
2. 공통 인터페이스(`AgentAdapter`)로 추상화
3. 기존 Claude Code 로직에 영향 없음 (리네이밍만, 로직 변경 최소화)
4. Codex 전용 기능은 MVP에서 제외, 나중에 추가

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    AgentManager                      │
│  (기존 ClaudeManager 리네이밍, 로직 유지)              │
├─────────────────────────────────────────────────────┤
│                   AgentAdapter                       │
│              (interface, 공통 계약)                   │
├────────────────────┬────────────────────────────────┤
│  ClaudeSDKAdapter  │       CodexSDKAdapter          │
│   (기존 유지)       │         (신규)                  │
└────────────────────┴────────────────────────────────┘
```

## Naming Changes

| Before | After |
|--------|-------|
| `ClaudeAdapter` | `AgentAdapter` |
| `ClaudeSDKAdapter` | `ClaudeSDKAdapter` (구현체, 유지) |
| `ClaudeManager` | `AgentManager` |
| `ClaudeSession` | `AgentSession` |
| `ClaudeQueryOptions` | `AgentQueryOptions` |
| `ClaudeMessage` | `AgentMessage` |
| `claude/` directory | `agent/` directory |

## Core Interfaces

```typescript
// packages/pylon/src/agent/types.ts

export type AgentType = 'claude' | 'codex';

export interface AgentAdapter {
  query(options: AgentQueryOptions): AsyncIterable<AgentMessage>;
}

export interface AgentQueryOptions {
  prompt: string;
  workingDir: string;
  sessionId?: string;           // 재개용
  systemPrompt?: string;
  systemReminder?: string;
  abortSignal?: AbortSignal;
  canUseTool?: CanUseToolCallback;
  // ... 기존 ClaudeQueryOptions와 동일
}

// AgentMessage는 기존 ClaudeMessage와 동일 (SDK 메시지 그대로 전달)
export type AgentMessage = SDKMessage;
```

## Agent Selection Flow

```
대화 생성 요청 (agentType: 'codex')
       ↓
Conversation 저장 (agentType 필드 포함)
       ↓
메시지 전송 시
       ↓
AgentManager.sendMessage()
       ↓
conversation.agentType에 따라 어댑터 선택
       ↓
ClaudeSDKAdapter 또는 CodexSDKAdapter
```

## Data Model Changes

### Conversation

```typescript
interface Conversation {
  conversationId: number;
  name: string;
  agentType: AgentType;  // 'claude' | 'codex' (기본값: 'claude')
  linkedDocuments?: LinkedDocument[];
  // ...
}
```

### MCP Tool

`create_conversation` 도구에 `agent` 파라미터 추가:

```typescript
{
  name: "create_conversation",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      files: { type: "array", items: { type: "string" } },
      agent: { type: "string", enum: ["claude", "codex"] }  // 신규
    }
  }
}
```

## File Structure

```
packages/pylon/src/
├── agent/                        # 기존 claude/ → agent/
│   ├── types.ts                  # AgentType, AgentAdapter, AgentQueryOptions 등
│   ├── agent-manager.ts          # 기존 claude-manager.ts 리네이밍
│   ├── claude-sdk-adapter.ts     # 기존 유지
│   └── codex-sdk-adapter.ts      # 신규
├── ...

packages/core/src/types/
├── conversation.ts               # agentType 필드 추가
├── conversation-agent.ts         # 기존 conversation-claude.ts 리네이밍 (또는 유지)
├── agent-manager.ts              # 기존 claude-manager.ts 리네이밍
├── ...
```

## CodexSDKAdapter Implementation

```typescript
// packages/pylon/src/agent/codex-sdk-adapter.ts

import { Codex, Thread, ThreadEvent } from "@openai/codex-sdk";

export class CodexSDKAdapter implements AgentAdapter {
  private codex: Codex;

  constructor() {
    this.codex = new Codex();
  }

  async *query(options: AgentQueryOptions): AsyncIterable<AgentMessage> {
    const thread = options.sessionId
      ? this.codex.resumeThread(options.sessionId)
      : this.codex.startThread({
          workingDirectory: options.workingDir,
          approvalPolicy: "never",  // MVP: 자동 승인
          sandboxMode: "workspace-write",
        });

    const { events } = await thread.runStreamed(options.prompt);

    for await (const event of events) {
      yield this.convertToAgentMessage(event);
    }
  }

  private convertToAgentMessage(event: ThreadEvent): AgentMessage {
    // Codex 이벤트 → AgentMessage 변환 로직
    // 기존 Claude SDK 메시지 형식에 맞춰 변환
  }
}
```

## Client UI Changes

워크스페이스 추가 UI에 에이전트 선택 버튼 추가:

- Claude (기본값)
- Codex

## Authentication

- Codex: 각 Pylon에서 `codex` CLI로 로그인 (ChatGPT 구독 사용)
- 환경 분리 없이 통합 (`~/.codex/` 공유)

## Out of Scope (MVP)

다음 Codex 전용 기능은 나중에 추가:
- `webSearchMode` (내장 웹 검색)
- `modelReasoningEffort` (5단계 추론 강도)
- `todo_list` 아이템
- `skipGitRepoCheck`
- MCP 서버 런타임 등록 (Codex는 config.toml만 지원)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| 리네이밍 시 기존 코드 깨짐 | 일괄 변경 + 타입 체크 + 테스트 |
| Codex 이벤트 변환 누락 | AgentMessage 타입 유니온으로 확장 가능하게 설계 |
| 인증 실패 | Codex 로그인 상태 체크 후 에러 메시지 표시 |

## Implementation Phases

### Phase 1: Renaming
- `claude/` → `agent/` 디렉토리 이동
- 타입/클래스 리네이밍
- import 경로 수정
- 테스트 통과 확인

### Phase 2: Codex Adapter
- `@openai/codex-sdk` 패키지 추가
- `CodexSDKAdapter` 구현
- 이벤트 변환 로직 구현

### Phase 3: Agent Selection
- `Conversation` 타입에 `agentType` 필드 추가
- MCP 도구 파라미터 추가
- `AgentManager`에서 어댑터 선택 로직 추가

### Phase 4: Client UI
- 대화 생성 UI에 에이전트 선택 추가
- 에이전트 타입 표시 UI
