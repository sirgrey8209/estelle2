# Widget 시스템 리팩토링 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** inputs 제거 + run_widget_inline 추가로 위젯 시스템 단순화

**Architecture:** InputNode 관련 타입/컴포넌트 제거, ScriptViewNode만 유지. run_widget_inline은 CLI 프로세스 없이 Pylon에서 직접 Client로 widget_render 전송.

**Tech Stack:** TypeScript, React, Zustand, WebSocket

---

## Task 1: Core - InputNode 타입 제거

**Files:**
- Modify: `packages/core/src/types/widget.ts`
- Modify: `packages/core/tests/types/widget.test.ts`

**Step 1: Update widget.ts - 타입 제거**

```typescript
// 삭제할 내용 (line 78-128):
// - ButtonsInputNode, TextInputNode, SliderInputNode, ConfirmInputNode
// - InputNode union type
// - Input Types 섹션 전체

// WidgetCliRenderMessage에서 inputs 제거 (line 138-142)
export interface WidgetCliRenderMessage {
  type: 'render';
  view: ViewNode;
  // inputs?: InputNode[];  ← 삭제
}

// WidgetRenderMessage에서 inputs 제거 (line 215-220)
export interface WidgetRenderMessage {
  type: 'widget_render';
  sessionId: string;
  view: ViewNode;
  // inputs: InputNode[];  ← 삭제
}
```

**Step 2: Update test file**

```typescript
// packages/core/tests/types/widget.test.ts
// InputNode 관련 테스트 제거 또는 업데이트
```

**Step 3: Run typecheck**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/core typecheck`
Expected: 타입 에러 발생 (다른 패키지에서 InputNode 참조)

**Step 4: Commit (partial)**

```bash
git add packages/core/src/types/widget.ts
git commit -m "refactor(core): remove InputNode types from widget.ts"
```

---

## Task 2: Core - export 정리

**Files:**
- Modify: `packages/core/src/types/index.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Remove InputNode exports**

```typescript
// packages/core/src/types/index.ts 또는 src/index.ts에서
// InputNode 관련 export 제거
```

**Step 2: Run typecheck**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/core typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/core/
git commit -m "refactor(core): remove InputNode exports"
```

---

## Task 3: Pylon - WidgetManager inputs 제거

**Files:**
- Modify: `packages/pylon/src/managers/widget-manager.ts`

**Step 1: Remove inputs from WidgetRenderEvent**

```typescript
// line 41-45
export interface WidgetRenderEvent {
  sessionId: string;
  view: ViewNode;
  // inputs: InputNode[];  ← 삭제
}
```

**Step 2: Update render event emission**

```typescript
// startSession 내부에서 render 이벤트 emit 부분
this.emit('render', {
  sessionId,
  view: message.view,
  // inputs: message.inputs ?? [],  ← 삭제
});
```

**Step 3: Run typecheck**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon typecheck`
Expected: 타입 에러 (pylon-mcp-server에서 inputs 참조)

**Step 4: Commit (partial)**

```bash
git add packages/pylon/src/managers/widget-manager.ts
git commit -m "refactor(pylon): remove inputs from WidgetManager"
```

---

## Task 4: Pylon - pylon-mcp-server inputs 제거

**Files:**
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts`

**Step 1: Update _onWidgetRender callback type**

```typescript
// 콜백 타입에서 inputs 파라미터 제거
private _onWidgetRender?: (
  conversationId: number,
  toolUseId: string,
  sessionId: string,
  view: ViewNode,
  // inputs: InputNode[],  ← 삭제
) => void;
```

**Step 2: Update onRender callback in _handleRunWidget**

```typescript
// line ~1844
const onRender = (event: WidgetRenderEvent) => {
  if (event.sessionId === sessionId) {
    this._onWidgetRender?.(conversationId, toolUseId, sessionId, event.view);
    // event.inputs 제거
  }
};
```

**Step 3: Update setOnWidgetRender method**

```typescript
setOnWidgetRender(
  callback: (
    conversationId: number,
    toolUseId: string,
    sessionId: string,
    view: ViewNode,
  ) => void
): void {
  this._onWidgetRender = callback;
}
```

**Step 4: Run typecheck**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon typecheck`
Expected: 타입 에러 (pylon.ts에서 콜백 사용)

**Step 5: Commit (partial)**

```bash
git add packages/pylon/src/servers/pylon-mcp-server.ts
git commit -m "refactor(pylon): remove inputs from widget render callback"
```

---

## Task 5: Pylon - pylon.ts inputs 제거

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: Update widget_render message payload**

```typescript
// mcpServer.setOnWidgetRender 콜백에서 inputs 제거
mcpServer.setOnWidgetRender((conversationId, toolUseId, sessionId, view) => {
  this.broadcastToDevice(/* ... */, {
    type: 'widget_render',
    payload: {
      conversationId,
      toolUseId,
      sessionId,
      view,
      // inputs,  ← 삭제
    },
  });
});
```

**Step 2: Run typecheck**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "refactor(pylon): remove inputs from widget_render message"
```

---

## Task 6: Client - conversationStore inputs 제거

**Files:**
- Modify: `packages/client/src/stores/conversationStore.ts`

**Step 1: Update WidgetSession interface**

```typescript
// WidgetSession에서 inputs 제거
interface WidgetSession {
  toolUseId: string;
  sessionId: string;
  view: ViewNode;
  // inputs: InputNode[];  ← 삭제
}
```

**Step 2: Update setWidgetSession method**

```typescript
setWidgetSession: (
  conversationId: number,
  toolUseId: string,
  sessionId: string,
  view: ViewNode,
  // inputs: InputNode[],  ← 삭제
) => {
  // ...
  states.set(conversationId, {
    ...state,
    widgetSession: {
      toolUseId,
      sessionId,
      view,
      // inputs,  ← 삭제
    },
  });
  // ...
}
```

**Step 3: Run typecheck**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client typecheck`
Expected: 타입 에러 (useMessageRouter에서 참조)

**Step 4: Commit (partial)**

```bash
git add packages/client/src/stores/conversationStore.ts
git commit -m "refactor(client): remove inputs from conversationStore"
```

---

## Task 7: Client - useMessageRouter inputs 제거

**Files:**
- Modify: `packages/client/src/hooks/useMessageRouter.ts`

**Step 1: Update widget_render handler**

```typescript
case 'widget_render': {
  const widgetPayload = payload as {
    conversationId: number;
    toolUseId: string;
    sessionId: string;
    view: ViewNode;
    // inputs?: InputNode[];  ← 삭제
  };
  const { conversationId, toolUseId, sessionId, view } = widgetPayload;

  if (!conversationId || !toolUseId || !sessionId || !view) {
    console.warn('[MessageRouter] widget_render missing required fields');
    break;
  }

  useConversationStore.getState().setWidgetSession(
    conversationId,
    toolUseId,
    sessionId,
    view,
    // inputs 인자 삭제
  );
  break;
}
```

**Step 2: Remove InputNode import**

```typescript
// import에서 InputNode 제거
import type { ViewNode } from '@estelle/core';
// InputNode 삭제
```

**Step 3: Run typecheck**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client typecheck`
Expected: 타입 에러 (WidgetRenderer에서 inputs 사용)

**Step 4: Commit (partial)**

```bash
git add packages/client/src/hooks/useMessageRouter.ts
git commit -m "refactor(client): remove inputs from useMessageRouter"
```

---

## Task 8: Client - WidgetRenderer inputs 제거

**Files:**
- Modify: `packages/client/src/components/widget/WidgetRenderer.tsx`
- Delete: `packages/client/src/components/widget/WidgetInputs.tsx`
- Delete: `packages/client/src/components/widget/WidgetView.tsx`

**Step 1: Simplify WidgetRenderer**

```typescript
// WidgetRendererProps에서 inputs 제거
export interface WidgetRendererProps {
  view: ViewNode;
  // inputs: InputNode[];  ← 삭제
  onInput: (data: Record<string, unknown>) => void;
  onEvent?: (data: unknown) => void;
  className?: string;
}

// 컴포넌트에서 inputs 관련 로직 제거
// WidgetInputs import 및 사용 제거
// v1 렌더링 로직 제거 (ScriptViewNode만 지원)
```

**Step 2: Delete WidgetInputs.tsx**

```bash
rm packages/client/src/components/widget/WidgetInputs.tsx
```

**Step 3: Delete WidgetView.tsx (있다면)**

```bash
rm packages/client/src/components/widget/WidgetView.tsx
```

**Step 4: Update index.ts**

```typescript
// packages/client/src/components/widget/index.ts
// WidgetInputs, WidgetView export 제거
export { WidgetRenderer, type WidgetRendererProps } from './WidgetRenderer';
export { WidgetScriptRenderer } from './WidgetScriptRenderer';
```

**Step 5: Run typecheck**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/client/src/components/widget/
git commit -m "refactor(client): remove inputs from WidgetRenderer, delete WidgetInputs"
```

---

## Task 9: Client - relaySender inputs 제거

**Files:**
- Modify: `packages/client/src/services/relaySender.ts`

**Step 1: Check and remove InputNode references**

```typescript
// InputNode import 및 사용 제거 (있다면)
```

**Step 2: Run typecheck**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/client/src/services/relaySender.ts
git commit -m "refactor(client): remove InputNode from relaySender"
```

---

## Task 10: 전체 테스트 및 타입체크

**Step 1: Run all typechecks**

Run: `cd /home/estelle/estelle2 && pnpm typecheck`
Expected: PASS

**Step 2: Run all tests**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/core --filter @estelle/pylon --filter @estelle/client test`
Expected: 일부 실패 가능 (inputs 관련 테스트)

**Step 3: Fix failing tests**

테스트에서 inputs 관련 부분 제거/수정

**Step 4: Commit**

```bash
git add -A
git commit -m "test: fix tests after inputs removal"
```

---

## Task 11: Pylon - run_widget_inline 도구 정의

**Files:**
- Create: `packages/pylon/src/mcp/tools/run-widget-inline.ts`

**Step 1: Create tool definition file**

```typescript
/**
 * @file run-widget-inline.ts
 * @description run_widget_inline MCP 도구 구현
 *
 * CLI 프로세스 없이 인라인 위젯을 렌더링합니다.
 */

import { PylonClient } from '../pylon-client.js';

// ============================================================================
// Types
// ============================================================================

interface RunWidgetInlineArgs {
  html: string;
  code?: string;
  height?: number;
}

interface ToolMeta {
  toolUseId: string;
}

interface McpTextContent {
  type: 'text';
  text: string;
}

interface McpResponse {
  content: McpTextContent[];
  isError?: boolean;
}

// ============================================================================
// Tool Definition
// ============================================================================

export function getRunWidgetInlineToolDefinition() {
  return {
    name: 'run_widget_inline',
    description: '인라인 위젯을 렌더링합니다. CLI 프로세스 없이 Client에서 직접 실행됩니다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        html: {
          type: 'string',
          description: 'HTML 템플릿 (CSS 포함 가능)',
        },
        code: {
          type: 'string',
          description: 'JavaScript 코드 (선택)',
        },
        height: {
          type: 'number',
          description: '초기 높이 픽셀 (선택, 기본 auto)',
        },
      },
      required: ['html'],
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function createSuccessResponse(data: Record<string, unknown>): McpResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

function createErrorResponse(message: string): McpResponse {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function createPylonClient(): PylonClient {
  const mcpPort = parseInt(process.env.ESTELLE_MCP_PORT || '9880', 10);
  return new PylonClient({
    host: '127.0.0.1',
    port: mcpPort,
  });
}

// ============================================================================
// Main
// ============================================================================

export async function executeRunWidgetInline(
  args: RunWidgetInlineArgs,
  meta: ToolMeta,
): Promise<McpResponse> {
  if (!args.html) {
    return createErrorResponse('html is required');
  }

  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.runWidgetInline({
      html: args.html,
      code: args.code,
      height: args.height,
      toolUseId: meta.toolUseId,
    });

    if (!result.success) {
      return createErrorResponse(result.error ?? 'Widget session failed');
    }

    return createSuccessResponse({
      success: true,
      result: result.result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Widget session failed: ${message}`);
  }
}
```

**Step 2: Commit**

```bash
git add packages/pylon/src/mcp/tools/run-widget-inline.ts
git commit -m "feat(pylon): add run_widget_inline tool definition"
```

---

## Task 12: Pylon - PylonClient에 runWidgetInline 추가

**Files:**
- Modify: `packages/pylon/src/mcp/pylon-client.ts`

**Step 1: Add runWidgetInline method**

```typescript
interface RunWidgetInlineParams {
  html: string;
  code?: string;
  height?: number;
  toolUseId: string;
}

async runWidgetInline(params: RunWidgetInlineParams): Promise<{
  success: boolean;
  result?: unknown;
  error?: string;
}> {
  return this.sendRequest({
    action: 'run_widget_inline',
    toolUseId: params.toolUseId,
    html: params.html,
    code: params.code,
    height: params.height,
  });
}
```

**Step 2: Commit**

```bash
git add packages/pylon/src/mcp/pylon-client.ts
git commit -m "feat(pylon): add runWidgetInline to PylonClient"
```

---

## Task 13: Pylon - MCP 서버에 도구 등록

**Files:**
- Modify: `packages/pylon/src/mcp/server.ts`

**Step 1: Import and register tool**

```typescript
import { getRunWidgetInlineToolDefinition, executeRunWidgetInline } from './tools/run-widget-inline.js';

// tools 배열에 추가
const tools = [
  // ... 기존 도구들
  getRunWidgetInlineToolDefinition(),
];

// handler switch에 추가
case 'run_widget_inline':
  return executeRunWidgetInline(args, meta);
```

**Step 2: Commit**

```bash
git add packages/pylon/src/mcp/server.ts
git commit -m "feat(pylon): register run_widget_inline tool"
```

---

## Task 14: Pylon - _handleRunWidgetInline 구현

**Files:**
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts`
- Test: `packages/pylon/tests/servers/pylon-mcp-server.test.ts`

**Step 1: Write failing test**

```typescript
describe('PylonMcpServer - run_widget_inline', () => {
  it('should render inline widget without CLI process', async () => {
    // 테스트 설정
    const mockOnWidgetRender = vi.fn();
    server.setOnWidgetRender(mockOnWidgetRender);

    // run_widget_inline 요청
    const response = await sendRequest(TEST_PORT, {
      action: 'run_widget_inline',
      toolUseId: 'tool-1',
      html: '<div>Hello</div>',
      code: 'console.log("test")',
    });

    // widget_render 콜백 호출 확인
    expect(mockOnWidgetRender).toHaveBeenCalledWith(
      expect.any(Number),
      'tool-1',
      expect.stringMatching(/^inline-widget-/),
      expect.objectContaining({
        type: 'script',
        html: '<div>Hello</div>',
        code: 'console.log("test")',
      }),
    );
  });

  it('should register to pendingWidgets', async () => {
    const conversationId = 123;

    // 요청 시작 (완료 대기하지 않음)
    const promise = sendRequest(TEST_PORT, {
      action: 'run_widget_inline',
      toolUseId: 'tool-1',
      html: '<div>Hello</div>',
      conversationId,
    });

    // pendingWidgets에 등록 확인
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(server.hasPendingWidget(conversationId)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon test -- --run tests/servers/pylon-mcp-server.test.ts`
Expected: FAIL

**Step 3: Implement _handleRunWidgetInline**

```typescript
// request handler switch에 추가
case 'run_widget_inline':
  return this._handleRunWidgetInline(
    conversationId as ConversationId,
    request.toolUseId ?? '',
    request.html,
    request.code,
    request.height,
  );

// 메서드 구현
private async _handleRunWidgetInline(
  conversationId: ConversationId,
  toolUseId: string,
  html?: string,
  code?: string,
  height?: number,
): Promise<McpResponse> {
  // 중복 위젯 체크
  if (this._pendingWidgets.has(conversationId)) {
    return {
      success: false,
      error: 'Widget already running in this conversation.',
    };
  }

  // html 필수
  if (!html) {
    return {
      success: false,
      error: 'html is required for run_widget_inline',
    };
  }

  // 대화 존재 확인
  const conversation = this._workspaceStore.getConversation(conversationId);
  if (!conversation) {
    return {
      success: false,
      error: 'Conversation not found',
    };
  }

  // sessionId 생성 (inline- prefix로 CLI 위젯과 구분)
  const sessionId = `inline-widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ScriptViewNode 구성
  const view: ViewNode = {
    type: 'script',
    html,
    code,
    height,
  };

  // Promise로 완료 대기
  return new Promise((resolve) => {
    // pendingWidgets에 등록
    this._pendingWidgets.set(conversationId, {
      conversationId,
      toolUseId,
      widgetSessionId: sessionId,
      resolve: (result) => {
        this._pendingWidgets.delete(conversationId);
        resolve({ success: true, result });
      },
      reject: (error) => {
        this._pendingWidgets.delete(conversationId);
        resolve({ success: false, error: error.message });
      },
    });

    // Client에 widget_render 전송
    this._onWidgetRender?.(conversationId, toolUseId, sessionId, view);
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon test -- --run tests/servers/pylon-mcp-server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/pylon/src/servers/pylon-mcp-server.ts packages/pylon/tests/servers/pylon-mcp-server.test.ts
git commit -m "feat(pylon): implement _handleRunWidgetInline"
```

---

## Task 15: Pylon - widget_check에서 inline 위젯 처리

**Files:**
- Modify: `packages/pylon/src/pylon.ts`
- Test: `packages/pylon/tests/pylon.test.ts`

**Step 1: Write failing test**

```typescript
describe('widget_check for inline widget', () => {
  it('should return valid=true for inline widget (no process check)', async () => {
    // inline widget 시작
    await pylon.handleRunWidgetInline(conversationId, 'tool-1', '<div>test</div>');

    // widget_check
    await pylon.handleMessage({
      type: 'widget_check',
      payload: { conversationId, sessionId: 'inline-widget-...' },
    });

    // valid=true 응답 확인 (프로세스 체크 없이)
    expect(relayClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'widget_check_result',
        payload: expect.objectContaining({ valid: true }),
      })
    );
  });
});
```

**Step 2: Update handleWidgetCheck**

```typescript
private handleWidgetCheck(payload: Record<string, unknown> | undefined, from?: FromInfo): void {
  if (!isWidgetCheckPayload(payload)) return;

  const { conversationId, sessionId } = payload;
  const pending = this.deps.mcpServer?.getPendingWidget(conversationId);

  if (!pending || pending.widgetSessionId !== sessionId) {
    this.sendWidgetCheckResult(conversationId, sessionId, false, from?.deviceId);
    return;
  }

  // inline widget인 경우 (프로세스 없음 → 항상 valid)
  if (pending.widgetSessionId.startsWith('inline-')) {
    this.sendWidgetCheckResult(conversationId, sessionId, true, from?.deviceId);
    return;
  }

  // CLI widget인 경우 → WidgetManager로 프로세스 상태 확인
  const session = this.deps.widgetManager?.getSession(pending.widgetSessionId);
  if (!session || session.status !== 'running') {
    this.deps.mcpServer?.cancelWidgetForConversation(conversationId);
    this.sendWidgetCheckResult(conversationId, sessionId, false, from?.deviceId);
    return;
  }

  this.sendWidgetCheckResult(conversationId, sessionId, true, from?.deviceId);
}
```

**Step 3: Run test**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon test -- --run tests/pylon.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/pylon/src/pylon.ts packages/pylon/tests/pylon.test.ts
git commit -m "feat(pylon): handle inline widget in widget_check"
```

---

## Task 16: 통합 테스트 및 빌드

**Step 1: Run all tests**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/core --filter @estelle/pylon --filter @estelle/client test`
Expected: PASS

**Step 2: Run typecheck**

Run: `cd /home/estelle/estelle2 && pnpm typecheck`
Expected: PASS

**Step 3: Build**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: PASS

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete widget refactor (inputs removal + run_widget_inline)"
```

---

## Task 17: 배포

**Step 1: Use estelle-patch skill**

Run: `/patch`

---

## 요약

| Task | 설명 | 파일 |
|------|------|------|
| 1-2 | Core InputNode 타입 제거 | core/types/widget.ts |
| 3-5 | Pylon inputs 제거 | pylon/managers, servers, pylon.ts |
| 6-9 | Client inputs 제거 | stores, hooks, components |
| 10 | 테스트 수정 | all tests |
| 11-13 | run_widget_inline 도구 정의 | pylon/mcp/tools |
| 14 | _handleRunWidgetInline 구현 | pylon/servers |
| 15 | widget_check inline 처리 | pylon/pylon.ts |
| 16-17 | 통합 테스트 및 배포 | all |
