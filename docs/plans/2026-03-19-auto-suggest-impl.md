# Auto Suggest Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Claude 응답 완료 후 유저가 다음에 할 법한 대화 3개를 제안하는 기능 구현

**Architecture:** Pylon의 AgentManager에서 응답 완료 시 SDK의 `forkSession`으로 제안을 생성하고, CLAUDE_EVENT의 'suggestion' 서브타입으로 Client에 전달. Client는 InputBar 위에 세로 칩으로 표시하고, 탭하면 InputBar에 텍스트를 채움.

**Tech Stack:** Claude Agent SDK (`forkSession`), Zustand (conversationStore), React (SuggestionChips), shadcn/ui

---

### Task 1: Core — Suggestion 상태 타입 추가

**Files:**
- Modify: `packages/core/src/types/conversation-claude.ts:117-140`

**Step 1: conversation-claude.ts에 SuggestionState 타입 추가**

`WidgetSession` 인터페이스 아래, Factory Functions 섹션 앞에 추가:

```typescript
/**
 * 제안 상태
 *
 * @description
 * 자동 입력 제안 기능의 현재 상태입니다.
 * Claude 응답 완료 후 fork 세션으로 생성된 제안을 관리합니다.
 */
export interface SuggestionState {
  /** 제안 상태 */
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** 제안 텍스트 목록 (최대 3개) */
  items: string[];
}
```

**Step 2: ConversationClaudeState에 suggestions 필드 추가**

`ConversationClaudeState` 인터페이스의 `widgetSession` 필드 아래에 추가:

```typescript
  /** 자동 입력 제안 상태 */
  suggestions: SuggestionState;
```

**Step 3: createInitialClaudeState에 suggestions 초기값 추가**

```typescript
export function createInitialClaudeState(): ConversationClaudeState {
  return {
    status: 'idle',
    messages: [],
    textBuffer: '',
    pendingRequests: [],
    workStartTime: null,
    realtimeUsage: null,
    widgetSession: null,
    suggestions: { status: 'idle', items: [] },
  };
}
```

**Step 4: 타입 체크 실행**

Run: `pnpm --filter @estelle/core typecheck`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/core/src/types/conversation-claude.ts
git commit -m "feat(core): add SuggestionState type to ConversationClaudeState"
```

---

### Task 2: Core — AgentManagerEventType에 'suggestion' 추가

**Files:**
- Modify: `packages/pylon/src/agent/agent-manager.ts:89-105`

**Step 1: AgentManagerEventType에 'suggestion' 추가**

```typescript
export type AgentManagerEventType =
  | 'init'
  | 'stateUpdate'
  | 'text'
  | 'textComplete'
  | 'toolInfo'
  | 'toolProgress'
  | 'toolComplete'
  | 'askQuestion'
  | 'permission_request'
  | 'result'
  | 'error'
  | 'state'
  | 'agentAborted'
  | 'usage_update'
  | 'compactStart'
  | 'compactComplete'
  | 'suggestion';
```

**Step 2: 타입 체크 실행**

Run: `pnpm --filter @estelle/pylon typecheck`
Expected: PASS

**Step 3: 커밋**

```bash
git add packages/pylon/src/agent/agent-manager.ts
git commit -m "feat(pylon): add 'suggestion' to AgentManagerEventType"
```

---

### Task 3: Pylon — AgentQueryOptions에 forkSession 필드 추가

**Files:**
- Modify: `packages/pylon/src/agent/agent-manager.ts:309-348`
- Modify: `packages/pylon/src/agent/claude-sdk-adapter.ts:106-120`

**Step 1: AgentQueryOptions에 forkSession 필드 추가**

`resume` 필드 아래에 추가:

```typescript
  /** 재개할 세션 ID */
  resume?: string;

  /** 세션 분기 여부 (resume 시 새 세션 ID로 분기) */
  forkSession?: boolean;
```

**Step 2: claude-sdk-adapter.ts의 sdkOptions에 forkSession 전달**

`resume: options.resume,` 아래에 추가:

```typescript
      resume: options.resume,
      forkSession: options.forkSession,
```

**Step 3: 타입 체크 실행**

Run: `pnpm --filter @estelle/pylon typecheck`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/pylon/src/agent/agent-manager.ts packages/pylon/src/agent/claude-sdk-adapter.ts
git commit -m "feat(pylon): add forkSession option to AgentQueryOptions and SDK adapter"
```

---

### Task 4: Pylon — SuggestionManager 테스트 작성

**Files:**
- Create: `packages/pylon/tests/agent/suggestion-manager.test.ts`

**Step 1: 테스트 파일 작성**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuggestionManager } from '../../src/agent/suggestion-manager.js';
import type { AgentAdapter, AgentQueryOptions, AgentMessage, AgentEventHandler } from '../../src/agent/agent-manager.js';

// 테스트용 mock adapter
function createMockAdapter(response: string): AgentAdapter {
  return {
    async *query(_options: AgentQueryOptions): AsyncIterable<AgentMessage> {
      yield {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: response }],
        },
      } as AgentMessage;
    },
  };
}

function createFailingAdapter(): AgentAdapter {
  return {
    async *query(): AsyncIterable<AgentMessage> {
      throw new Error('Fork session failed');
    },
  };
}

describe('SuggestionManager', () => {
  let emittedEvents: Array<{ sessionId: number; event: Record<string, unknown> }>;
  let onEvent: AgentEventHandler;

  beforeEach(() => {
    emittedEvents = [];
    onEvent = (sessionId, event) => {
      emittedEvents.push({ sessionId, event: event as Record<string, unknown> });
    };
  });

  describe('generate', () => {
    it('should emit loading then ready with 3 suggestions', async () => {
      const adapter = createMockAdapter('["첫 번째 제안", "두 번째 제안", "세 번째 제안"]');
      const manager = new SuggestionManager({ adapter, onEvent });

      await manager.generate(100, 'session-abc', '/work');

      expect(emittedEvents).toHaveLength(2);
      expect(emittedEvents[0].event).toEqual({
        type: 'suggestion',
        status: 'loading',
      });
      expect(emittedEvents[1].event).toEqual({
        type: 'suggestion',
        status: 'ready',
        items: ['첫 번째 제안', '두 번째 제안', '세 번째 제안'],
      });
    });

    it('should emit error on adapter failure', async () => {
      const adapter = createFailingAdapter();
      const manager = new SuggestionManager({ adapter, onEvent });

      await manager.generate(100, 'session-abc', '/work');

      expect(emittedEvents).toHaveLength(2);
      expect(emittedEvents[0].event.type).toBe('suggestion');
      expect(emittedEvents[0].event.status).toBe('loading');
      expect(emittedEvents[1].event.type).toBe('suggestion');
      expect(emittedEvents[1].event.status).toBe('error');
    });

    it('should emit error on invalid JSON response', async () => {
      const adapter = createMockAdapter('this is not json');
      const manager = new SuggestionManager({ adapter, onEvent });

      await manager.generate(100, 'session-abc', '/work');

      const lastEvent = emittedEvents[emittedEvents.length - 1];
      expect(lastEvent.event.status).toBe('error');
    });

    it('should emit error if response is not an array of 3 strings', async () => {
      const adapter = createMockAdapter('["only one"]');
      const manager = new SuggestionManager({ adapter, onEvent });

      await manager.generate(100, 'session-abc', '/work');

      const lastEvent = emittedEvents[emittedEvents.length - 1];
      expect(lastEvent.event.status).toBe('error');
    });

    it('should cancel previous generation when called again', async () => {
      const adapter = createMockAdapter('["a", "b", "c"]');
      const manager = new SuggestionManager({ adapter, onEvent });

      // 첫 번째 호출 (완료되기 전에 두 번째 호출)
      const promise1 = manager.generate(100, 'session-abc', '/work');
      manager.cancel(100);
      await promise1;

      // cancel 후에는 ready가 emit되지 않아야 함
      const readyEvents = emittedEvents.filter(e => e.event.status === 'ready');
      expect(readyEvents).toHaveLength(0);
    });

    it('should use forkSession: true and resume with agentSessionId', async () => {
      let capturedOptions: AgentQueryOptions | null = null;
      const adapter: AgentAdapter = {
        async *query(options: AgentQueryOptions): AsyncIterable<AgentMessage> {
          capturedOptions = options;
          yield {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: '["a", "b", "c"]' }],
            },
          } as AgentMessage;
        },
      };
      const manager = new SuggestionManager({ adapter, onEvent });

      await manager.generate(100, 'session-abc', '/work');

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.resume).toBe('session-abc');
      expect(capturedOptions!.forkSession).toBe(true);
    });
  });

  describe('cancel', () => {
    it('should abort ongoing generation', async () => {
      const adapter = createMockAdapter('["a", "b", "c"]');
      const manager = new SuggestionManager({ adapter, onEvent });

      manager.cancel(100);
      // cancel은 진행 중인 것이 없어도 에러를 발생시키지 않아야 함
    });
  });
});
```

**Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @estelle/pylon vitest run tests/agent/suggestion-manager.test.ts`
Expected: FAIL (SuggestionManager 모듈이 없음)

**Step 3: 커밋**

```bash
git add packages/pylon/tests/agent/suggestion-manager.test.ts
git commit -m "test(pylon): add SuggestionManager tests"
```

---

### Task 5: Pylon — SuggestionManager 구현

**Files:**
- Create: `packages/pylon/src/agent/suggestion-manager.ts`

**Step 1: SuggestionManager 구현**

```typescript
/**
 * @file suggestion-manager.ts
 * @description 유저 대화 입력 제안 생성기
 *
 * Claude 응답 완료 후 세션을 fork하여 유저가 다음에 할 법한 대화를 제안합니다.
 */

import type {
  AgentAdapter,
  AgentQueryOptions,
  AgentEventHandler,
} from './agent-manager.js';

const SUGGESTION_PROMPT = `You are generating suggested user inputs for a conversation.
Based on the conversation so far, suggest exactly 3 short messages that the user would most likely want to say next.

Rules:
- Each suggestion must be concise (under 80 characters)
- Suggestions should cover different possible directions
- Write in the same language the user has been using
- Do not explain or add commentary
- Output ONLY a JSON array of 3 strings

Example output:
["첫 번째 제안", "두 번째 제안", "세 번째 제안"]`;

const SUGGESTION_TIMEOUT_MS = 10_000;

interface SuggestionManagerOptions {
  adapter: AgentAdapter;
  onEvent: AgentEventHandler;
}

export class SuggestionManager {
  private readonly adapter: AgentAdapter;
  private readonly onEvent: AgentEventHandler;
  private readonly activeControllers = new Map<number, AbortController>();

  constructor(options: SuggestionManagerOptions) {
    this.adapter = options.adapter;
    this.onEvent = options.onEvent;
  }

  /**
   * 제안 생성
   *
   * @param sessionId - 대화 세션 ID
   * @param agentSessionId - fork할 Agent 세션 ID
   * @param workingDir - 작업 디렉토리
   */
  async generate(
    sessionId: number,
    agentSessionId: string,
    workingDir: string
  ): Promise<void> {
    // 기존 진행 중인 제안 취소
    this.cancel(sessionId);

    const abortController = new AbortController();
    this.activeControllers.set(sessionId, abortController);

    this.onEvent(sessionId, { type: 'suggestion', status: 'loading' });

    try {
      const responseText = await this.queryForSuggestions(
        agentSessionId,
        workingDir,
        abortController
      );

      // 취소되었으면 결과 무시
      if (abortController.signal.aborted) return;

      const items = this.parseSuggestions(responseText);

      this.onEvent(sessionId, {
        type: 'suggestion',
        status: 'ready',
        items,
      });
    } catch (err) {
      if (abortController.signal.aborted) return;

      this.onEvent(sessionId, { type: 'suggestion', status: 'error' });
    } finally {
      this.activeControllers.delete(sessionId);
    }
  }

  /**
   * 진행 중인 제안 생성 취소
   */
  cancel(sessionId: number): void {
    const controller = this.activeControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(sessionId);
    }
  }

  private async queryForSuggestions(
    agentSessionId: string,
    workingDir: string,
    abortController: AbortController
  ): Promise<string> {
    const queryOptions: AgentQueryOptions = {
      prompt: SUGGESTION_PROMPT,
      cwd: workingDir,
      abortController,
      resume: agentSessionId,
      forkSession: true,
      includePartialMessages: false,
      settingSources: ['user', 'project', 'local'],
    };

    // 타임아웃 설정
    const timeout = setTimeout(() => {
      abortController.abort();
    }, SUGGESTION_TIMEOUT_MS);

    let responseText = '';

    try {
      for await (const msg of this.adapter.query(queryOptions)) {
        if (abortController.signal.aborted) break;

        const msgAny = msg as Record<string, unknown>;
        if (msgAny.type === 'assistant' && msgAny.message) {
          const message = msgAny.message as Record<string, unknown>;
          if (Array.isArray(message.content)) {
            for (const block of message.content) {
              const blockAny = block as Record<string, unknown>;
              if (blockAny.type === 'text' && typeof blockAny.text === 'string') {
                responseText = blockAny.text;
              }
            }
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    return responseText;
  }

  private parseSuggestions(text: string): string[] {
    // JSON 배열 추출 (응답에 추가 텍스트가 있을 수 있으므로)
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      throw new Error('No JSON array found in response');
    }

    const parsed = JSON.parse(match[0]);

    if (
      !Array.isArray(parsed) ||
      parsed.length !== 3 ||
      !parsed.every((item: unknown) => typeof item === 'string')
    ) {
      throw new Error('Response must be a JSON array of exactly 3 strings');
    }

    return parsed as string[];
  }
}
```

**Step 2: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @estelle/pylon vitest run tests/agent/suggestion-manager.test.ts`
Expected: PASS (6 tests)

**Step 3: 타입 체크 실행**

Run: `pnpm --filter @estelle/pylon typecheck`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/pylon/src/agent/suggestion-manager.ts
git commit -m "feat(pylon): implement SuggestionManager with fork session"
```

---

### Task 6: Pylon — AgentManager에 SuggestionManager 통합

**Files:**
- Modify: `packages/pylon/src/agent/agent-manager.ts:590-636` (sendMessage finally 블록)
- Modify: `packages/pylon/src/agent/agent-manager.ts:500-560` (생성자 영역)

**Step 1: AgentManager 생성자에 SuggestionManager 인스턴스 추가**

AgentManager 클래스에 필드 추가:

```typescript
  /** 제안 생성 매니저 */
  private readonly suggestionManager: SuggestionManager;
```

생성자에서 초기화 (claudeAdapter가 설정된 직후):

```typescript
    this.suggestionManager = new SuggestionManager({
      adapter: this.claudeAdapter || this.adapter,
      onEvent: this.onEvent,
    });
```

Import 추가:

```typescript
import { SuggestionManager } from './suggestion-manager.js';
```

**Step 2: AgentManager에 autoSuggest 설정 관리 추가**

필드 추가:

```typescript
  /** 대화별 자동 제안 활성화 상태 */
  private readonly autoSuggestEnabled = new Map<number, boolean>();
```

public 메서드 추가:

```typescript
  /**
   * 자동 제안 활성화/비활성화
   */
  setAutoSuggest(sessionId: number, enabled: boolean): void {
    this.autoSuggestEnabled.set(sessionId, enabled);
    if (!enabled) {
      this.suggestionManager.cancel(sessionId);
    }
  }
```

**Step 3: sendMessage finally 블록에서 제안 생성 트리거**

`finally` 블록 수정 (`agent-manager.ts:631-635`):

```typescript
    } finally {
      const session = this.sessions.get(sessionId);
      const agentSessionId = session?.agentSessionId;
      const workingDir = options.workingDir;

      this.sessions.delete(sessionId);
      this.pendingEvents.delete(sessionId);
      this.emitEvent(sessionId, { type: 'state', state: 'idle' });

      // 자동 제안 생성 (비동기, fire-and-forget)
      if (
        this.autoSuggestEnabled.get(sessionId) &&
        agentSessionId &&
        workingDir
      ) {
        this.suggestionManager.generate(sessionId, agentSessionId, workingDir)
          .catch(() => { /* 제안 생성 실패는 무시 */ });
      }
    }
```

**Step 4: sendMessage에서 working 전환 시 기존 제안 취소**

`this.emitEvent(sessionId, { type: 'state', state: 'working' });` 바로 아래에 추가 (`agent-manager.ts:612` 근처):

```typescript
    this.emitEvent(sessionId, { type: 'state', state: 'working' });
    this.suggestionManager.cancel(sessionId);
```

**Step 5: 타입 체크 실행**

Run: `pnpm --filter @estelle/pylon typecheck`
Expected: PASS

**Step 6: 커밋**

```bash
git add packages/pylon/src/agent/agent-manager.ts
git commit -m "feat(pylon): integrate SuggestionManager into AgentManager"
```

---

### Task 7: Pylon — autoSuggest 설정 전달 경로 구축

**Files:**
- Modify: `packages/pylon/src/pylon.ts` (handleMessage에 auto_suggest 설정 처리 추가)
- Modify: `packages/core/src/constants/message-type.ts` (AUTO_SUGGEST_SET 메시지 타입 추가)

**Step 1: message-type.ts에 AUTO_SUGGEST_SET 추가**

Claude 관련 메시지 타입 섹션에 추가:

```typescript
  /** 자동 제안 모드 설정 */
  AUTO_SUGGEST_SET: 'auto_suggest_set',
```

**Step 2: pylon.ts에서 AUTO_SUGGEST_SET 메시지 처리**

handleMessage 메서드 내, Claude 관련 메시지 처리 근처에 추가:

```typescript
    case MessageType.AUTO_SUGGEST_SET: {
      const { conversationId, enabled } = msg.payload as {
        conversationId: number;
        enabled: boolean;
      };
      this.deps.agentManager.setAutoSuggest(conversationId, enabled);
      break;
    }
```

**Step 3: 타입 체크 실행**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/core/src/constants/message-type.ts packages/pylon/src/pylon.ts
git commit -m "feat: add AUTO_SUGGEST_SET message type and Pylon handler"
```

---

### Task 8: Client Store — suggestions 상태 관리 추가

**Files:**
- Modify: `packages/client/src/stores/conversationStore.ts`
- Test: `packages/client/src/stores/conversationStore.test.ts`

**Step 1: 테스트 추가**

`conversationStore.test.ts`에 suggestions 관련 테스트 추가:

```typescript
describe('suggestions', () => {
  it('should set suggestions with loading status', () => {
    const { result } = renderHook(() => useConversationStore());
    act(() => {
      result.current.setSuggestions(100, { status: 'loading', items: [] });
    });
    const state = result.current.getState(100);
    expect(state?.suggestions.status).toBe('loading');
    expect(state?.suggestions.items).toEqual([]);
  });

  it('should set suggestions with ready status and items', () => {
    const { result } = renderHook(() => useConversationStore());
    act(() => {
      result.current.setSuggestions(100, {
        status: 'ready',
        items: ['제안 1', '제안 2', '제안 3'],
      });
    });
    const state = result.current.getState(100);
    expect(state?.suggestions.status).toBe('ready');
    expect(state?.suggestions.items).toEqual(['제안 1', '제안 2', '제안 3']);
  });

  it('should clear suggestions when status becomes working', () => {
    const { result } = renderHook(() => useConversationStore());
    act(() => {
      result.current.setSuggestions(100, {
        status: 'ready',
        items: ['제안 1', '제안 2', '제안 3'],
      });
    });
    act(() => {
      result.current.setStatus(100, 'working');
    });
    const state = result.current.getState(100);
    expect(state?.suggestions).toEqual({ status: 'idle', items: [] });
  });

  it('should clear suggestions on clearSuggestions call', () => {
    const { result } = renderHook(() => useConversationStore());
    act(() => {
      result.current.setSuggestions(100, {
        status: 'ready',
        items: ['제안 1', '제안 2', '제안 3'],
      });
    });
    act(() => {
      result.current.clearSuggestions(100);
    });
    const state = result.current.getState(100);
    expect(state?.suggestions).toEqual({ status: 'idle', items: [] });
  });
});
```

**Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @estelle/client vitest run src/stores/conversationStore.test.ts`
Expected: FAIL (setSuggestions, clearSuggestions 없음)

**Step 3: conversationStore.ts에 setSuggestions, clearSuggestions 메서드 추가**

StoreState 인터페이스에 추가:

```typescript
  setSuggestions: (conversationId: number, suggestions: SuggestionState) => void;
  clearSuggestions: (conversationId: number) => void;
```

Store 구현에 추가:

```typescript
    setSuggestions: (conversationId, suggestions) => {
      const states = new Map(get().states);
      const state = getOrCreateState(states, conversationId);
      states.set(conversationId, { ...state, suggestions });
      set({ states });
    },

    clearSuggestions: (conversationId) => {
      const states = new Map(get().states);
      const state = getOrCreateState(states, conversationId);
      states.set(conversationId, {
        ...state,
        suggestions: { status: 'idle', items: [] },
      });
      set({ states });
    },
```

setStatus 메서드에서 `status === 'working'`일 때 suggestions 초기화 추가:

```typescript
    if (status === 'working') {
      updates.workStartTime = Date.now();
      updates.realtimeUsage = { ... };
      updates.suggestions = { status: 'idle', items: [] };  // 추가
    }
```

import에 SuggestionState 추가:

```typescript
import type { SuggestionState } from '@estelle/core';
```

**Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @estelle/client vitest run src/stores/conversationStore.test.ts`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/client/src/stores/conversationStore.ts packages/client/src/stores/conversationStore.test.ts
git commit -m "feat(client): add suggestions state to conversationStore"
```

---

### Task 9: Client Router — suggestion 이벤트 라우팅

**Files:**
- Modify: `packages/client/src/hooks/useMessageRouter.ts:555-600`

**Step 1: handleClaudeEventForConversation의 switch에 'suggestion' case 추가**

`default:` 앞에 추가:

```typescript
    case 'suggestion': {
      const status = event.status as string;
      const items = (event.items as string[]) ?? [];
      if (status === 'loading') {
        store.setSuggestions(conversationId, { status: 'loading', items: [] });
      } else if (status === 'ready') {
        store.setSuggestions(conversationId, { status: 'ready', items });
      } else if (status === 'error') {
        store.setSuggestions(conversationId, { status: 'idle', items: [] });
      }
      break;
    }
```

**Step 2: 타입 체크 실행**

Run: `pnpm --filter @estelle/client typecheck`
Expected: PASS

**Step 3: 커밋**

```bash
git add packages/client/src/hooks/useMessageRouter.ts
git commit -m "feat(client): route suggestion events in useMessageRouter"
```

---

### Task 10: Client UI — SuggestionChips 컴포넌트

**Files:**
- Create: `packages/client/src/components/chat/SuggestionChips.tsx`

**Step 1: SuggestionChips 컴포넌트 구현**

```tsx
import { Loader2 } from 'lucide-react';
import { useCurrentConversationState } from '../../stores/conversationStore';

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
}

export function SuggestionChips({ onSelect }: SuggestionChipsProps) {
  const state = useCurrentConversationState();
  const suggestions = state?.suggestions;

  if (!suggestions || suggestions.status === 'idle') return null;

  if (suggestions.status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>제안 생성 중...</span>
      </div>
    );
  }

  if (suggestions.status !== 'ready' || suggestions.items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      {suggestions.items.map((item, index) => (
        <button
          key={index}
          onClick={() => onSelect(item)}
          className="text-left text-sm px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors truncate"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: 타입 체크 실행**

Run: `pnpm --filter @estelle/client typecheck`
Expected: PASS

**Step 3: 커밋**

```bash
git add packages/client/src/components/chat/SuggestionChips.tsx
git commit -m "feat(client): add SuggestionChips component"
```

---

### Task 11: Client UI — InputBar에 SuggestionChips 통합 + 자동 제안 토글

**Files:**
- Modify: `packages/client/src/components/chat/InputBar.tsx`

**Step 1: autoSuggest 토글 상태 추가**

voiceMode 상태 바로 아래에 추가 (`InputBar.tsx:62` 근처):

```typescript
  const [autoSuggest, setAutoSuggest] = useState(() => {
    return localStorage.getItem('estelle:autoSuggestEnabled') === 'true';
  });

  const toggleAutoSuggest = useCallback(() => {
    setAutoSuggest((prev) => {
      const next = !prev;
      localStorage.setItem('estelle:autoSuggestEnabled', String(next));
      return next;
    });
    setShowAttachMenu(false);
  }, []);
```

**Step 2: autoSuggest 상태 변경 시 Pylon에 전달**

```typescript
  // autoSuggest 상태를 Pylon에 전달
  useEffect(() => {
    if (conversationId != null) {
      sendAutoSuggestSet(conversationId, autoSuggest);
    }
  }, [autoSuggest, conversationId]);
```

**Step 3: SuggestionChips를 InputBar 렌더에 추가**

텍스트 입력 영역 바로 위 (SlashAutocompletePopup 근처)에 추가:

```tsx
  {/* 자동 입력 제안 */}
  <SuggestionChips onSelect={(text) => setText(text)} />
```

Import 추가:

```typescript
import { SuggestionChips } from './SuggestionChips';
```

**Step 4: +메뉴에 자동 제안 토글 추가**

음성 입력 토글 아래 (다이얼로그 내 `~505줄` 근처)에 추가:

```tsx
  <div className="border-t my-1" />
  <button onClick={toggleAutoSuggest} className="...동일한 스타일...">
    <Sparkles className="h-5 w-5" />
    <span>자동 입력</span>
    <span className={cn(autoSuggest ? 'bg-primary...' : 'bg-muted...')}>
      {autoSuggest ? 'ON' : 'OFF'}
    </span>
  </button>
```

Import 추가:

```typescript
import { Sparkles } from 'lucide-react';
```

**Step 5: handleSend에서 suggestions 클리어 추가**

handleSend 콜백 내, `setText('')` 아래에 추가:

```typescript
  // 전송 시 제안 숨김
  if (conversationId != null) {
    useConversationStore.getState().clearSuggestions(conversationId);
  }
```

**Step 6: relaySender에 sendAutoSuggestSet 함수 추가**

`packages/client/src/services/relaySender.ts`에 추가:

```typescript
export function sendAutoSuggestSet(conversationId: number, enabled: boolean): boolean {
  return sendMessage({
    type: MessageType.AUTO_SUGGEST_SET,
    payload: { conversationId, enabled },
  });
}
```

**Step 7: 타입 체크 실행**

Run: `pnpm --filter @estelle/client typecheck`
Expected: PASS

**Step 8: 커밋**

```bash
git add packages/client/src/components/chat/InputBar.tsx packages/client/src/components/chat/SuggestionChips.tsx packages/client/src/services/relaySender.ts
git commit -m "feat(client): integrate SuggestionChips with InputBar and add auto-suggest toggle"
```

---

### Task 12: 전체 통합 테스트 및 타입 체크

**Files:** (기존 파일들 전체)

**Step 1: 전체 타입 체크**

Run: `pnpm typecheck`
Expected: PASS

**Step 2: Pylon 테스트 전체 실행**

Run: `pnpm --filter @estelle/pylon test`
Expected: PASS

**Step 3: Client 테스트 전체 실행**

Run: `pnpm --filter @estelle/client test`
Expected: PASS

**Step 4: 빌드 확인**

Run: `pnpm build`
Expected: PASS

**Step 5: 커밋 (필요한 경우 수정 사항)**

수정 사항이 있으면 커밋.
