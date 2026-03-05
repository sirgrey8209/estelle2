# Widget 세션 관리 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 위젯 세션을 질문처럼 Pylon에서 관리하여 엣지 케이스에 대한 안정성 확보

**Architecture:** Pylon이 `pendingWidgets` Map으로 위젯 세션의 Single Source of Truth 역할. Client는 렌더링만 담당. 대화당 1개 위젯 강제, 대화 복귀 시 프로세스 검증.

**Tech Stack:** TypeScript, Zustand, WebSocket 메시지

---

## Task 1: Core - 메시지 타입 정의

**Files:**
- Modify: `packages/core/src/constants/message-type.ts`
- Modify: `packages/core/src/types/widget.ts`
- Test: `packages/core/tests/types/widget.test.ts` (신규)

**Step 1: Write the failing test**

```typescript
// packages/core/tests/types/widget.test.ts
import { describe, it, expect } from 'vitest';
import { MessageType } from '../../src/constants/message-type';
import {
  isWidgetCheckPayload,
  isWidgetCheckResultPayload,
} from '../../src/types/widget';

describe('Widget Message Types', () => {
  it('should have widget_check message type', () => {
    expect(MessageType.WIDGET_CHECK).toBe('widget_check');
  });

  it('should have widget_check_result message type', () => {
    expect(MessageType.WIDGET_CHECK_RESULT).toBe('widget_check_result');
  });

  it('should validate WidgetCheckPayload', () => {
    const valid = { conversationId: 123, sessionId: 'widget-1-123' };
    const invalid = { conversationId: 123 };

    expect(isWidgetCheckPayload(valid)).toBe(true);
    expect(isWidgetCheckPayload(invalid)).toBe(false);
  });

  it('should validate WidgetCheckResultPayload', () => {
    const valid = { conversationId: 123, sessionId: 'widget-1-123', valid: true };
    const invalid = { conversationId: 123, sessionId: 'widget-1-123' };

    expect(isWidgetCheckResultPayload(valid)).toBe(true);
    expect(isWidgetCheckResultPayload(invalid)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/core test -- --run tests/types/widget.test.ts`
Expected: FAIL - MessageType.WIDGET_CHECK undefined, functions not found

**Step 3: Add message types to message-type.ts**

```typescript
// packages/core/src/constants/message-type.ts
// === Widget === 섹션 추가 (Utility 위에)

  // === Widget ===
  /** 위젯 세션 유효성 확인 요청 */
  WIDGET_CHECK: 'widget_check',
  /** 위젯 세션 유효성 확인 응답 */
  WIDGET_CHECK_RESULT: 'widget_check_result',
  /** 위젯 렌더 */
  WIDGET_RENDER: 'widget_render',
  /** 위젯 닫기 */
  WIDGET_CLOSE: 'widget_close',
  /** 위젯 입력 */
  WIDGET_INPUT: 'widget_input',
  /** 위젯 취소 */
  WIDGET_CANCEL: 'widget_cancel',
  /** 위젯 이벤트 */
  WIDGET_EVENT: 'widget_event',
```

**Step 4: Add payload types and guards to widget.ts**

```typescript
// packages/core/src/types/widget.ts 끝에 추가

// ============================================================================
// Widget Check Messages (세션 유효성 확인)
// ============================================================================

/**
 * 위젯 세션 유효성 확인 요청 페이로드
 */
export interface WidgetCheckPayload {
  conversationId: number;
  sessionId: string;
}

/**
 * 위젯 세션 유효성 확인 응답 페이로드
 */
export interface WidgetCheckResultPayload {
  conversationId: number;
  sessionId: string;
  valid: boolean;
}

export function isWidgetCheckPayload(value: unknown): value is WidgetCheckPayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'number' &&
    typeof value.sessionId === 'string'
  );
}

export function isWidgetCheckResultPayload(value: unknown): value is WidgetCheckResultPayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'number' &&
    typeof value.sessionId === 'string' &&
    typeof value.valid === 'boolean'
  );
}
```

**Step 5: Run test to verify it passes**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/core test -- --run tests/types/widget.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/constants/message-type.ts packages/core/src/types/widget.ts packages/core/tests/types/widget.test.ts
git commit -m "feat(core): add widget_check message types and guards"
```

---

## Task 2: Pylon - PendingWidget 인터페이스 및 Map

**Files:**
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts`
- Test: `packages/pylon/tests/servers/pylon-mcp-server.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/pylon/tests/servers/pylon-mcp-server.test.ts에 추가
describe('PylonMcpServer - Widget Session Management', () => {
  it('should track pending widgets by conversationId', async () => {
    // pendingWidgets가 존재하는지 확인
    const server = new PylonMcpServer({
      // ... 필요한 의존성
    });

    expect(server.hasPendingWidget(123)).toBe(false);
  });

  it('should reject duplicate widget in same conversation', async () => {
    const server = createTestServer();

    // 첫 번째 위젯 시작
    await server.handleRunWidget(123, { command: 'test', cwd: '/tmp' });

    // 두 번째 위젯 시도 - 에러 반환
    const result = await server.handleRunWidget(123, { command: 'test2', cwd: '/tmp' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Widget already running');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon test -- --run tests/servers/pylon-mcp-server.test.ts`
Expected: FAIL - hasPendingWidget not defined

**Step 3: Add PendingWidget interface and Map**

```typescript
// packages/pylon/src/servers/pylon-mcp-server.ts

// 클래스 상단에 인터페이스 추가
interface PendingWidget {
  conversationId: number;
  toolUseId: string;
  widgetSessionId: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

// 클래스 내부에 Map 추가
private readonly pendingWidgets: Map<number, PendingWidget> = new Map();

// public 메서드 추가
hasPendingWidget(conversationId: number): boolean {
  return this.pendingWidgets.has(conversationId);
}

getPendingWidget(conversationId: number): PendingWidget | undefined {
  return this.pendingWidgets.get(conversationId);
}

// widgetSessionId로 찾기
findPendingWidgetBySessionId(widgetSessionId: string): PendingWidget | undefined {
  for (const pending of this.pendingWidgets.values()) {
    if (pending.widgetSessionId === widgetSessionId) {
      return pending;
    }
  }
  return undefined;
}
```

**Step 4: Modify _handleRunWidget to check duplicate**

```typescript
// _handleRunWidget 메서드 시작 부분에 추가
private async _handleRunWidget(
  conversationId: number,
  toolUseId: string,
  args: RunWidgetArgs,
): Promise<McpResponse> {
  // 중복 위젯 체크
  if (this.pendingWidgets.has(conversationId)) {
    return createErrorResponse(
      'Widget already running in this conversation. Complete or cancel the existing widget first.'
    );
  }

  // ... 기존 로직
}
```

**Step 5: Run test to verify it passes**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon test -- --run tests/servers/pylon-mcp-server.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/pylon/src/servers/pylon-mcp-server.ts packages/pylon/tests/servers/pylon-mcp-server.test.ts
git commit -m "feat(pylon): add pendingWidgets map and duplicate check"
```

---

## Task 3: Pylon - 위젯 시작 시 pendingWidgets에 등록

**Files:**
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts`
- Test: `packages/pylon/tests/servers/pylon-mcp-server.test.ts`

**Step 1: Write the failing test**

```typescript
// 테스트 추가
it('should register widget to pendingWidgets on start', async () => {
  const server = createTestServer();

  // 위젯 시작 (비동기로 실행, 완료 대기 안 함)
  const widgetPromise = server.handleRunWidget(123, { command: 'test', cwd: '/tmp' });

  // pendingWidgets에 등록되었는지 확인
  expect(server.hasPendingWidget(123)).toBe(true);

  const pending = server.getPendingWidget(123);
  expect(pending?.conversationId).toBe(123);
  expect(pending?.widgetSessionId).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL - pendingWidgets에 등록 안 됨

**Step 3: Update _handleRunWidget to register pending**

```typescript
// _handleRunWidget 수정
private async _handleRunWidget(
  conversationId: number,
  toolUseId: string,
  args: RunWidgetArgs,
): Promise<McpResponse> {
  // 중복 체크 (기존)
  if (this.pendingWidgets.has(conversationId)) {
    return createErrorResponse(
      'Widget already running in this conversation. Complete or cancel the existing widget first.'
    );
  }

  if (!this._widgetManager) {
    return createErrorResponse('Widget manager not available');
  }

  try {
    // 위젯 세션 시작
    const widgetSessionId = await this._widgetManager.startSession({
      command: args.command,
      cwd: args.cwd,
      args: args.args,
    });

    // Promise 생성 및 pendingWidgets에 등록
    return new Promise((resolve, reject) => {
      this.pendingWidgets.set(conversationId, {
        conversationId,
        toolUseId,
        widgetSessionId,
        resolve: (result) => {
          this.pendingWidgets.delete(conversationId);
          resolve(createSuccessResponse({ result }));
        },
        reject: (error) => {
          this.pendingWidgets.delete(conversationId);
          resolve(createErrorResponse(error.message));
        },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Widget session failed: ${message}`);
  }
}
```

**Step 4: Run test to verify it passes**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/pylon/src/servers/pylon-mcp-server.ts packages/pylon/tests/servers/pylon-mcp-server.test.ts
git commit -m "feat(pylon): register widget to pendingWidgets on start"
```

---

## Task 4: Pylon - 위젯 완료/에러 시 pendingWidgets 정리

**Files:**
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts`
- Test: `packages/pylon/tests/servers/pylon-mcp-server.test.ts`

**Step 1: Write the failing test**

```typescript
it('should remove widget from pendingWidgets on complete', async () => {
  const server = createTestServer();
  const mockWidgetManager = createMockWidgetManager();

  // 위젯 시작
  const widgetPromise = server.handleRunWidget(123, { command: 'test', cwd: '/tmp' });

  expect(server.hasPendingWidget(123)).toBe(true);

  // 완료 이벤트 발생
  mockWidgetManager.emit('complete', { sessionId: 'widget-1', result: { ok: true } });

  await widgetPromise;

  expect(server.hasPendingWidget(123)).toBe(false);
});

it('should remove widget from pendingWidgets on error', async () => {
  const server = createTestServer();
  const mockWidgetManager = createMockWidgetManager();

  const widgetPromise = server.handleRunWidget(123, { command: 'test', cwd: '/tmp' });

  // 에러 이벤트 발생
  mockWidgetManager.emit('error', { sessionId: 'widget-1', error: 'Test error' });

  const result = await widgetPromise;

  expect(server.hasPendingWidget(123)).toBe(false);
  expect(result.isError).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL - 이벤트 핸들러 연결 안 됨

**Step 3: Add event handlers for complete/error**

```typescript
// PylonMcpServer 생성자 또는 초기화에서 이벤트 핸들러 등록
private _setupWidgetEventHandlers(): void {
  if (!this._widgetManager) return;

  this._widgetManager.on('complete', (event: { sessionId: string; result: unknown }) => {
    const pending = this.findPendingWidgetBySessionId(event.sessionId);
    if (pending) {
      pending.resolve(event.result);
      // onWidgetClose 콜백 호출
      this._onWidgetClose?.(pending.conversationId, pending.toolUseId, event.sessionId);
    }
  });

  this._widgetManager.on('error', (event: { sessionId: string; error: string }) => {
    const pending = this.findPendingWidgetBySessionId(event.sessionId);
    if (pending) {
      pending.reject(new Error(event.error));
      this._onWidgetClose?.(pending.conversationId, pending.toolUseId, event.sessionId);
    }
  });
}
```

**Step 4: Run test to verify it passes**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/pylon/src/servers/pylon-mcp-server.ts packages/pylon/tests/servers/pylon-mcp-server.test.ts
git commit -m "feat(pylon): cleanup pendingWidgets on complete/error"
```

---

## Task 5: Pylon - 위젯 취소 메서드

**Files:**
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts`
- Test: `packages/pylon/tests/servers/pylon-mcp-server.test.ts`

**Step 1: Write the failing test**

```typescript
it('should cancel widget for conversation', async () => {
  const server = createTestServer();
  const mockWidgetManager = createMockWidgetManager();

  // 위젯 시작
  const widgetPromise = server.handleRunWidget(123, { command: 'test', cwd: '/tmp' });

  expect(server.hasPendingWidget(123)).toBe(true);

  // 취소
  const cancelled = server.cancelWidgetForConversation(123);

  expect(cancelled).toBe(true);
  expect(server.hasPendingWidget(123)).toBe(false);
  expect(mockWidgetManager.cancelSession).toHaveBeenCalled();

  // Promise는 에러로 완료
  const result = await widgetPromise;
  expect(result.isError).toBe(true);
});

it('should return false when no widget to cancel', () => {
  const server = createTestServer();

  const cancelled = server.cancelWidgetForConversation(123);

  expect(cancelled).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL - cancelWidgetForConversation not defined

**Step 3: Add cancelWidgetForConversation method**

```typescript
/**
 * 대화의 위젯 세션 취소
 */
cancelWidgetForConversation(conversationId: number): boolean {
  const pending = this.pendingWidgets.get(conversationId);
  if (!pending) {
    return false;
  }

  // WidgetManager에서 프로세스 종료
  this._widgetManager?.cancelSession(pending.widgetSessionId);

  // reject 호출
  pending.reject(new Error('Widget cancelled'));

  // pendingWidgets에서 제거
  this.pendingWidgets.delete(conversationId);

  // widget_close 전송
  this._onWidgetClose?.(conversationId, pending.toolUseId, pending.widgetSessionId);

  return true;
}
```

**Step 4: Run test to verify it passes**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/pylon/src/servers/pylon-mcp-server.ts packages/pylon/tests/servers/pylon-mcp-server.test.ts
git commit -m "feat(pylon): add cancelWidgetForConversation method"
```

---

## Task 6: Pylon - widget_check 핸들러

**Files:**
- Modify: `packages/pylon/src/pylon.ts`
- Test: `packages/pylon/tests/pylon.test.ts`

**Step 1: Write the failing test**

```typescript
describe('Pylon - widget_check handler', () => {
  it('should return valid=true when widget is running', async () => {
    const { pylon, relayClient } = createTestPylon();
    const mcpServer = pylon.getMcpServer();

    // 위젯 시작
    await mcpServer.handleRunWidget(123, { command: 'test', cwd: '/tmp' });

    // widget_check 메시지 처리
    await pylon.handleMessage({
      type: 'widget_check',
      payload: { conversationId: 123, sessionId: 'widget-1' },
    });

    // widget_check_result 전송 확인
    expect(relayClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'widget_check_result',
        payload: { conversationId: 123, sessionId: 'widget-1', valid: true },
      })
    );
  });

  it('should return valid=false when no widget', async () => {
    const { pylon, relayClient } = createTestPylon();

    await pylon.handleMessage({
      type: 'widget_check',
      payload: { conversationId: 123, sessionId: 'widget-1' },
    });

    expect(relayClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'widget_check_result',
        payload: { conversationId: 123, sessionId: 'widget-1', valid: false },
      })
    );
  });

  it('should return valid=false when widget process is dead', async () => {
    const { pylon, relayClient, widgetManager } = createTestPylon();
    const mcpServer = pylon.getMcpServer();

    // 위젯 시작
    await mcpServer.handleRunWidget(123, { command: 'test', cwd: '/tmp' });

    // 프로세스가 죽은 상태로 설정
    widgetManager.getSession.mockReturnValue({ status: 'error' });

    await pylon.handleMessage({
      type: 'widget_check',
      payload: { conversationId: 123, sessionId: 'widget-1' },
    });

    expect(relayClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'widget_check_result',
        payload: { conversationId: 123, sessionId: 'widget-1', valid: false },
      })
    );

    // pendingWidgets에서도 제거되었는지 확인
    expect(mcpServer.hasPendingWidget(123)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL - widget_check 핸들러 없음

**Step 3: Add widget_check handler to handleMessage**

```typescript
// packages/pylon/src/pylon.ts - handleMessage 메서드에 추가

case 'widget_check': {
  const payload = message.payload as WidgetCheckPayload;
  this._handleWidgetCheck(payload, message.source);
  break;
}

// private 메서드 추가
private _handleWidgetCheck(payload: WidgetCheckPayload, source?: number): void {
  const { conversationId, sessionId } = payload;

  const pending = this._mcpServer?.getPendingWidget(conversationId);

  // pending이 없거나 sessionId가 다르면 invalid
  if (!pending || pending.widgetSessionId !== sessionId) {
    this._sendWidgetCheckResult(conversationId, sessionId, false, source);
    return;
  }

  // WidgetManager에서 프로세스 상태 확인
  const session = this._widgetManager?.getSession(pending.widgetSessionId);

  if (!session || session.status !== 'running') {
    // 죽은 프로세스 - 정리
    this._mcpServer?.cancelWidgetForConversation(conversationId);
    this._sendWidgetCheckResult(conversationId, sessionId, false, source);
    return;
  }

  // 정상
  this._sendWidgetCheckResult(conversationId, sessionId, true, source);
}

private _sendWidgetCheckResult(
  conversationId: number,
  sessionId: string,
  valid: boolean,
  target?: number,
): void {
  this._deps.relayClient.send({
    type: 'widget_check_result',
    payload: { conversationId, sessionId, valid },
    target,
  });
}
```

**Step 4: Run test to verify it passes**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/pylon/src/pylon.ts packages/pylon/tests/pylon.test.ts
git commit -m "feat(pylon): add widget_check handler"
```

---

## Task 7: Pylon - 대화 삭제 시 위젯 정리

**Files:**
- Modify: `packages/pylon/src/pylon.ts`
- Test: `packages/pylon/tests/pylon.test.ts`

**Step 1: Write the failing test**

```typescript
describe('Pylon - conversation delete with widget', () => {
  it('should cancel widget when conversation is deleted', async () => {
    const { pylon, mcpServer, widgetManager } = createTestPylon();

    // 위젯 시작
    await mcpServer.handleRunWidget(123, { command: 'test', cwd: '/tmp' });
    expect(mcpServer.hasPendingWidget(123)).toBe(true);

    // 대화 삭제
    await pylon.handleMessage({
      type: 'conversation_delete',
      payload: { conversationId: 123 },
    });

    // 위젯 취소 확인
    expect(mcpServer.hasPendingWidget(123)).toBe(false);
    expect(widgetManager.cancelSession).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL - 대화 삭제 시 위젯 정리 안 됨

**Step 3: Add widget cleanup to conversation delete handler**

```typescript
// packages/pylon/src/pylon.ts - conversation_delete 핸들러 수정

case 'conversation_delete': {
  const payload = message.payload as ConversationDeletePayload;
  const conversationId = payload.conversationId;

  // 위젯 정리 (있으면)
  this._mcpServer?.cancelWidgetForConversation(conversationId);

  // 기존 대화 삭제 로직...
  break;
}
```

**Step 4: Run test to verify it passes**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/pylon/src/pylon.ts packages/pylon/tests/pylon.test.ts
git commit -m "feat(pylon): cancel widget on conversation delete"
```

---

## Task 8: Client - widget_render에서 conversationId 필수 사용

**Files:**
- Modify: `packages/client/src/hooks/useMessageRouter.ts`
- Test: `packages/client/tests/hooks/useMessageRouter.test.ts`

**Step 1: Write the failing test**

```typescript
describe('useMessageRouter - widget_render', () => {
  it('should use conversationId from payload, not selectedConversation', () => {
    const { result } = renderHook(() => useMessageRouter());

    // selectedConversation = 999
    useWorkspaceStore.setState({ selectedConversation: { conversationId: 999 } });

    // widget_render with conversationId = 123
    act(() => {
      result.current.handleMessage({
        type: 'widget_render',
        payload: {
          conversationId: 123,
          toolUseId: 'tool-1',
          sessionId: 'widget-1',
          view: { type: 'text', content: 'test' },
          inputs: [],
        },
      });
    });

    // conversationId 123에 저장되어야 함
    const state = useConversationStore.getState().states.get(123);
    expect(state?.widgetSession?.toolUseId).toBe('tool-1');

    // conversationId 999에는 저장 안 됨
    const wrongState = useConversationStore.getState().states.get(999);
    expect(wrongState?.widgetSession).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL - 현재는 selectedConversation fallback 사용

**Step 3: Update widget_render handler**

```typescript
// packages/client/src/hooks/useMessageRouter.ts - widget_render 핸들러 수정

case 'widget_render': {
  const widgetPayload = payload as {
    conversationId: number;  // 필수
    toolUseId: string;
    sessionId: string;
    view: ViewNode;
    inputs?: InputNode[];
  };

  const { conversationId, toolUseId, sessionId, view, inputs } = widgetPayload;

  // conversationId가 없으면 무시 (필수 필드)
  if (!conversationId || !toolUseId || !sessionId || !view) {
    console.warn('[MessageRouter] widget_render missing required fields');
    return;
  }

  useConversationStore.getState().setWidgetSession(
    conversationId,
    toolUseId,
    sessionId,
    view,
    inputs ?? []
  );
  break;
}
```

**Step 4: Run test to verify it passes**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/hooks/useMessageRouter.ts packages/client/tests/hooks/useMessageRouter.test.ts
git commit -m "feat(client): use conversationId from widget_render payload"
```

---

## Task 9: Client - widget_check_result 핸들러

**Files:**
- Modify: `packages/client/src/hooks/useMessageRouter.ts`
- Modify: `packages/client/src/stores/conversationStore.ts`
- Test: `packages/client/tests/hooks/useMessageRouter.test.ts`

**Step 1: Write the failing test**

```typescript
describe('useMessageRouter - widget_check_result', () => {
  it('should clear widget session when valid=false', () => {
    const { result } = renderHook(() => useMessageRouter());

    // 위젯 세션 설정
    useConversationStore.getState().setWidgetSession(
      123, 'tool-1', 'widget-1', { type: 'text', content: 'test' }, []
    );

    // widget_check_result valid=false
    act(() => {
      result.current.handleMessage({
        type: 'widget_check_result',
        payload: { conversationId: 123, sessionId: 'widget-1', valid: false },
      });
    });

    // 위젯 세션 정리됨
    const state = useConversationStore.getState().states.get(123);
    expect(state?.widgetSession).toBeNull();
  });

  it('should keep widget session when valid=true', () => {
    const { result } = renderHook(() => useMessageRouter());

    useConversationStore.getState().setWidgetSession(
      123, 'tool-1', 'widget-1', { type: 'text', content: 'test' }, []
    );

    act(() => {
      result.current.handleMessage({
        type: 'widget_check_result',
        payload: { conversationId: 123, sessionId: 'widget-1', valid: true },
      });
    });

    const state = useConversationStore.getState().states.get(123);
    expect(state?.widgetSession?.sessionId).toBe('widget-1');
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL - widget_check_result 핸들러 없음

**Step 3: Add widget_check_result handler**

```typescript
// packages/client/src/hooks/useMessageRouter.ts

case 'widget_check_result': {
  const { conversationId, sessionId, valid } = payload as {
    conversationId: number;
    sessionId: string;
    valid: boolean;
  };

  if (!valid) {
    const convStore = useConversationStore.getState();
    convStore.clearWidgetSession(conversationId);
    // 이벤트 리스너 정리
    convStore.removeWidgetEventListener(sessionId);
  }
  break;
}
```

**Step 4: Add removeWidgetEventListener to conversationStore**

```typescript
// packages/client/src/stores/conversationStore.ts

removeWidgetEventListener: (sessionId: string) => {
  widgetEventListeners.delete(sessionId);
},
```

**Step 5: Run test to verify it passes**

Expected: PASS

**Step 6: Commit**

```bash
git add packages/client/src/hooks/useMessageRouter.ts packages/client/src/stores/conversationStore.ts packages/client/tests/hooks/useMessageRouter.test.ts
git commit -m "feat(client): add widget_check_result handler"
```

---

## Task 10: Client - 대화 선택 시 widget_check 전송

**Files:**
- Modify: `packages/client/src/hooks/useMessageRouter.ts` 또는 관련 컴포넌트
- Modify: `packages/client/src/services/relaySender.ts`
- Test: `packages/client/tests/hooks/useMessageRouter.test.ts`

**Step 1: Write the failing test**

```typescript
describe('Conversation selection - widget_check', () => {
  it('should send widget_check when selecting conversation with widgetSession', () => {
    const sendSpy = vi.spyOn(relaySender, 'send');

    // 대화 123에 위젯 세션 있음
    useConversationStore.getState().setWidgetSession(
      123, 'tool-1', 'widget-1', { type: 'text', content: 'test' }, []
    );

    // 대화 123 선택
    selectConversation(123);

    expect(sendSpy).toHaveBeenCalledWith({
      type: 'widget_check',
      payload: { conversationId: 123, sessionId: 'widget-1' },
    });
  });

  it('should not send widget_check when no widgetSession', () => {
    const sendSpy = vi.spyOn(relaySender, 'send');

    // 대화 123에 위젯 세션 없음
    selectConversation(123);

    expect(sendSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'widget_check' })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL - widget_check 전송 로직 없음

**Step 3: Add widget_check on conversation select**

```typescript
// 대화 선택 로직에 추가 (useMessageRouter 또는 관련 훅)

const checkWidgetOnSelect = (conversationId: number) => {
  const state = useConversationStore.getState().states.get(conversationId);
  const widgetSession = state?.widgetSession;

  if (widgetSession) {
    relaySender.send({
      type: 'widget_check',
      payload: {
        conversationId,
        sessionId: widgetSession.sessionId,
      },
    });
  }
};

// selectedConversation 변경 감지 시 호출
```

**Step 4: Run test to verify it passes**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/hooks/useMessageRouter.ts packages/client/src/services/relaySender.ts packages/client/tests
git commit -m "feat(client): send widget_check on conversation select"
```

---

## Task 11: Client - clearWidgetSession 시 이벤트 리스너 정리

**Files:**
- Modify: `packages/client/src/stores/conversationStore.ts`
- Test: `packages/client/tests/stores/conversationStore.test.ts`

**Step 1: Write the failing test**

```typescript
describe('conversationStore - clearWidgetSession', () => {
  it('should also clear event listeners', () => {
    const convStore = useConversationStore.getState();

    // 위젯 세션 설정
    convStore.setWidgetSession(123, 'tool-1', 'widget-1', { type: 'text', content: 'test' }, []);

    // 이벤트 리스너 등록
    const listener = vi.fn();
    convStore.subscribeWidgetEvent('widget-1', listener);

    // 이벤트 발생 - 리스너 호출됨
    convStore.emitWidgetEvent('widget-1', { test: true });
    expect(listener).toHaveBeenCalled();

    listener.mockClear();

    // clearWidgetSession
    convStore.clearWidgetSession(123);

    // 이벤트 발생 - 리스너 호출 안 됨 (정리됨)
    convStore.emitWidgetEvent('widget-1', { test: true });
    expect(listener).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Expected: FAIL - clearWidgetSession이 이벤트 리스너 정리 안 함

**Step 3: Update clearWidgetSession**

```typescript
// packages/client/src/stores/conversationStore.ts

clearWidgetSession: (conversationId) => {
  const states = new Map(get().states);
  const state = getOrCreateState(states, conversationId);

  // 이벤트 리스너 정리
  const sessionId = state.widgetSession?.sessionId;
  if (sessionId) {
    widgetEventListeners.delete(sessionId);
  }

  states.set(conversationId, {
    ...state,
    widgetSession: null,
  });
  set({ states });
},
```

**Step 4: Run test to verify it passes**

Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/stores/conversationStore.ts packages/client/tests/stores/conversationStore.test.ts
git commit -m "feat(client): cleanup event listeners in clearWidgetSession"
```

---

## Task 12: 통합 테스트 및 타입 체크

**Step 1: Run all tests**

```bash
cd /home/estelle/estelle2
pnpm test
```

Expected: All tests pass

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No type errors

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address integration issues"
```

---

## Task 13: 빌드 및 배포

**Step 1: Build**

```bash
pnpm build
```

Expected: Build success

**Step 2: Deploy with estelle-patch skill**

Use `/patch` skill to deploy to all machines.

---

## 요약

| Task | 설명 | 파일 |
|------|------|------|
| 1 | Core 메시지 타입 정의 | core/constants, core/types |
| 2 | Pylon pendingWidgets Map | pylon/servers |
| 3 | 위젯 시작 시 등록 | pylon/servers |
| 4 | 완료/에러 시 정리 | pylon/servers |
| 5 | 위젯 취소 메서드 | pylon/servers |
| 6 | widget_check 핸들러 | pylon/pylon.ts |
| 7 | 대화 삭제 시 정리 | pylon/pylon.ts |
| 8 | widget_render conversationId 필수 | client/hooks |
| 9 | widget_check_result 핸들러 | client/hooks, client/stores |
| 10 | 대화 선택 시 widget_check | client/hooks |
| 11 | clearWidgetSession 리스너 정리 | client/stores |
| 12 | 통합 테스트 | all |
| 13 | 빌드 및 배포 | - |
