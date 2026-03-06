# Widget Ownership 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 위젯 소유권 모델을 구현하여 여러 클라이언트가 같은 대화에 접속해도 위젯 이벤트가 중복되지 않도록 한다.

**Architecture:** 핸드셰이크 기반 소유권 할당. Pylon이 위젯 실행 시 lastActiveClientId에게 먼저 핸드셰이크 요청 → visibility 확인 → 소유자 지정. 실패 시 모든 클라이언트에 pending 상태로 "실행 버튼" 표시.

**Tech Stack:** TypeScript, @estelle/core (타입), @estelle/pylon (서버 로직)

**설계 문서:** `docs/plans/2026-03-06-widget-ownership-design.md`

---

## Phase 1: 핵심 인프라

### Task 1.1: 새 메시지 타입 상수 추가

**Files:**
- Modify: `packages/core/src/constants/message-type.ts:194-208`

**Step 1: 메시지 타입 상수 추가**

```typescript
// === Widget === 섹션에 추가 (기존 WIDGET_EVENT 아래에)
/** 위젯 핸드셰이크 요청 (Pylon → Client) */
WIDGET_HANDSHAKE: 'widget_handshake',
/** 위젯 핸드셰이크 응답 (Client → Pylon) */
WIDGET_HANDSHAKE_ACK: 'widget_handshake_ack',
/** 위젯 대기 상태 (Pylon → Client) */
WIDGET_PENDING: 'widget_pending',
/** 위젯 소유권 요청 (Client → Pylon) */
WIDGET_CLAIM: 'widget_claim',
/** 위젯이 다른 클라이언트에서 실행 중 (Pylon → Client) */
WIDGET_CLAIMED: 'widget_claimed',
/** 위젯 완료 (Pylon → All Clients) */
WIDGET_COMPLETE: 'widget_complete',
/** 위젯 에러 (Pylon → All Clients) */
WIDGET_ERROR: 'widget_error',
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @estelle/core build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/core/src/constants/message-type.ts
git commit -m "feat(core): add widget ownership message types"
```

---

### Task 1.2: 위젯 소유권 Payload 타입 정의

**Files:**
- Modify: `packages/core/src/types/widget.ts:289` (파일 끝에 추가)

**Step 1: Payload 인터페이스 추가**

```typescript
// ============================================================================
// Widget Ownership Messages (소유권 관리)
// ============================================================================

/**
 * 위젯 세션 상태
 */
export type WidgetSessionStatus =
  | 'handshaking'  // 핸드셰이크 진행 중
  | 'pending'      // 대기 중 (실행 버튼 상태)
  | 'running'      // 실행 중 (소유자 있음)
  | 'completed'    // 완료
  | 'error';       // 에러

/**
 * Pylon → Client: 핸드셰이크 요청
 */
export interface WidgetHandshakePayload {
  conversationId: number;
  sessionId: string;
  toolUseId: string;
  timeout: number;  // ms
}

/**
 * Client → Pylon: 핸드셰이크 응답
 */
export interface WidgetHandshakeAckPayload {
  sessionId: string;
  visible: boolean;
}

/**
 * Pylon → Client: 위젯 대기 상태 (실행 버튼)
 */
export interface WidgetPendingPayload {
  conversationId: number;
  sessionId: string;
  toolUseId: string;
}

/**
 * Client → Pylon: 위젯 소유권 요청
 */
export interface WidgetClaimPayload {
  sessionId: string;
}

/**
 * Pylon → Client: 위젯이 다른 클라이언트에서 실행 중
 */
export interface WidgetClaimedPayload {
  sessionId: string;
  ownerClientId: number;  // 소유자의 deviceId
}

/**
 * Pylon → Client: 위젯 완료 (전체 브로드캐스트)
 */
export interface WidgetCompletePayload {
  conversationId: number;
  sessionId: string;
  toolUseId: string;
  view: ViewNode;  // 종료 페이지
  result: unknown;
}

/**
 * Pylon → Client: 위젯 에러 (전체 브로드캐스트)
 */
export interface WidgetErrorPayload {
  conversationId: number;
  sessionId: string;
  toolUseId: string;
  error: string;
}

// Type Guards

export function isWidgetHandshakePayload(value: unknown): value is WidgetHandshakePayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'number' &&
    typeof value.sessionId === 'string' &&
    typeof value.toolUseId === 'string' &&
    typeof value.timeout === 'number'
  );
}

export function isWidgetHandshakeAckPayload(value: unknown): value is WidgetHandshakeAckPayload {
  return (
    isObject(value) &&
    typeof value.sessionId === 'string' &&
    typeof value.visible === 'boolean'
  );
}

export function isWidgetPendingPayload(value: unknown): value is WidgetPendingPayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'number' &&
    typeof value.sessionId === 'string' &&
    typeof value.toolUseId === 'string'
  );
}

export function isWidgetClaimPayload(value: unknown): value is WidgetClaimPayload {
  return isObject(value) && typeof value.sessionId === 'string';
}

export function isWidgetClaimedPayload(value: unknown): value is WidgetClaimedPayload {
  return (
    isObject(value) &&
    typeof value.sessionId === 'string' &&
    typeof value.ownerClientId === 'number'
  );
}

export function isWidgetCompletePayload(value: unknown): value is WidgetCompletePayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'number' &&
    typeof value.sessionId === 'string' &&
    typeof value.toolUseId === 'string' &&
    'view' in value &&
    'result' in value
  );
}

export function isWidgetErrorPayload(value: unknown): value is WidgetErrorPayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'number' &&
    typeof value.sessionId === 'string' &&
    typeof value.toolUseId === 'string' &&
    typeof value.error === 'string'
  );
}
```

**Step 2: core index.ts에 export 추가**

Modify: `packages/core/src/types/index.ts` - widget.ts exports 확인 (이미 있으면 스킵)

**Step 3: 빌드 확인**

Run: `pnpm --filter @estelle/core build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add packages/core/src/types/widget.ts packages/core/src/types/index.ts
git commit -m "feat(core): add widget ownership payload types"
```

---

### Task 1.3: WidgetSession 타입 확장

**Files:**
- Modify: `packages/pylon/src/managers/widget-manager.ts:25-32`

**Step 1: WidgetSession 인터페이스 확장**

```typescript
export interface WidgetSession {
  sessionId: string;
  conversationId: number;      // 추가
  toolUseId: string;           // 추가
  process: ChildProcess;
  status: 'handshaking' | 'pending' | 'running' | 'completed' | 'error' | 'cancelled';  // 확장
  ownerClientId: number | null;  // 추가: 소유자 deviceId
  result?: unknown;
  error?: string;
  logger?: WidgetLogger;
}
```

**Step 2: WidgetStartOptions 확장**

```typescript
export interface WidgetStartOptions {
  command: string;
  cwd: string;
  args?: string[];
  conversationId: number;  // 추가
  toolUseId: string;       // 추가
}
```

**Step 3: startSession 메서드 업데이트**

startSession에서 conversationId, toolUseId 저장:

```typescript
const session: WidgetSession = {
  sessionId,
  conversationId: options.conversationId,
  toolUseId: options.toolUseId,
  process: proc,
  status: 'running',
  ownerClientId: null,  // 나중에 설정
  logger,
};
```

**Step 4: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: SUCCESS (또는 호출부 수정 필요 시 에러)

**Step 5: Commit**

```bash
git add packages/pylon/src/managers/widget-manager.ts
git commit -m "feat(pylon): extend WidgetSession with ownership fields"
```

---

### Task 1.4: lastActiveClientId 추적 로직

**Files:**
- Modify: `packages/core/src/types/workspace.ts:64-98`
- Modify: `packages/pylon/src/pylon.ts` (handleMessage에서 업데이트)

**Step 1: Conversation 인터페이스에 lastActiveClientId 추가**

```typescript
export interface Conversation {
  // ... 기존 필드들 ...

  /** 마지막으로 활성화된 클라이언트 deviceId */
  lastActiveClientId?: number;
}
```

**Step 2: Pylon에서 lastActiveClientId 업데이트 로직 추가**

`handleMessage` 시작 부분에 추가:

```typescript
// lastActiveClientId 업데이트 (메시지를 보낸 클라이언트)
if (from?.deviceId !== undefined) {
  // TODO: WorkspaceStore에서 현재 대화의 lastActiveClientId 업데이트
  // this.deps.workspaceStore.updateLastActiveClient(conversationId, from.deviceId);
}
```

**Step 3: WorkspaceStore에 updateLastActiveClient 메서드 추가**

(별도 Task로 분리 - Task 1.5)

**Step 4: 빌드 확인**

Run: `pnpm --filter @estelle/core build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add packages/core/src/types/workspace.ts
git commit -m "feat(core): add lastActiveClientId to Conversation"
```

---

### Task 1.5: WorkspaceStore lastActiveClientId 업데이트 메서드

**Files:**
- Modify: `packages/pylon/src/stores/workspace-store.ts`

**Step 1: updateLastActiveClient 메서드 추가**

```typescript
/**
 * 대화의 마지막 활성 클라이언트 업데이트
 */
updateLastActiveClient(conversationId: number, clientId: number): void {
  for (const workspace of this._workspaces) {
    const conversation = workspace.conversations.find(
      (c) => c.conversationId === conversationId
    );
    if (conversation) {
      conversation.lastActiveClientId = clientId;
      this.save();
      return;
    }
  }
}

/**
 * 대화의 마지막 활성 클라이언트 조회
 */
getLastActiveClient(conversationId: number): number | undefined {
  for (const workspace of this._workspaces) {
    const conversation = workspace.conversations.find(
      (c) => c.conversationId === conversationId
    );
    if (conversation) {
      return conversation.lastActiveClientId;
    }
  }
  return undefined;
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/pylon/src/stores/workspace-store.ts
git commit -m "feat(pylon): add lastActiveClientId tracking to WorkspaceStore"
```

---

### Task 1.6: Pylon에서 lastActiveClientId 호출

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: handleMessage에서 updateLastActiveClient 호출**

handleMessage 시작 부분 (type 체크 전)에 추가:

```typescript
private handleMessage(
  type: string,
  payload?: Record<string, unknown>,
  from?: MessageFrom,
): void {
  // lastActiveClientId 업데이트
  if (from?.deviceId !== undefined && this.activeConversationId) {
    this.deps.workspaceStore?.updateLastActiveClient(
      this.activeConversationId,
      from.deviceId
    );
  }

  // ... 기존 코드 ...
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): track lastActiveClientId on message receive"
```

---

## Phase 2: 핸드셰이크 구현

### Task 2.1: WidgetManager 핸드셰이크 시작 메서드

**Files:**
- Modify: `packages/pylon/src/managers/widget-manager.ts`

**Step 1: startHandshake 메서드 추가**

```typescript
/**
 * 핸드셰이크 시작 (소유권 할당 전 단계)
 */
startHandshake(
  sessionId: string,
  targetClientId: number,
  timeout: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const session = this.sessions.get(sessionId);
    if (!session) {
      resolve(false);
      return;
    }

    session.status = 'handshaking';

    const timeoutId = setTimeout(() => {
      if (session.status === 'handshaking') {
        session.status = 'pending';
        resolve(false);
      }
    }, timeout);

    // 핸드셰이크 응답 대기
    const handler = (ack: { sessionId: string; visible: boolean; clientId: number }) => {
      if (ack.sessionId === sessionId && ack.clientId === targetClientId) {
        clearTimeout(timeoutId);
        this.off('handshake_ack', handler);

        if (ack.visible) {
          session.status = 'running';
          session.ownerClientId = targetClientId;
          resolve(true);
        } else {
          session.status = 'pending';
          resolve(false);
        }
      }
    };

    this.on('handshake_ack', handler);
  });
}

/**
 * 핸드셰이크 응답 처리
 */
handleHandshakeAck(sessionId: string, visible: boolean, clientId: number): void {
  this.emit('handshake_ack', { sessionId, visible, clientId });
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/pylon/src/managers/widget-manager.ts
git commit -m "feat(pylon): add handshake methods to WidgetManager"
```

---

### Task 2.2: Pylon 핸드셰이크 메시지 핸들러

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: handleWidgetHandshakeAck 메서드 추가**

```typescript
/**
 * Widget 핸드셰이크 응답 처리
 */
private handleWidgetHandshakeAck(
  payload: Record<string, unknown> | undefined,
  from?: MessageFrom,
): void {
  if (!isWidgetHandshakeAckPayload(payload)) {
    this.log('[Widget] Invalid widget_handshake_ack payload');
    return;
  }

  const { sessionId, visible } = payload;
  const clientId = from?.deviceId;

  if (clientId === undefined) {
    this.log('[Widget] Missing clientId in handshake_ack');
    return;
  }

  this.log(`[Widget] Handshake ack: session=${sessionId}, visible=${visible}, client=${clientId}`);
  this.deps.widgetManager?.handleHandshakeAck(sessionId, visible, clientId);
}
```

**Step 2: handleMessage에 라우팅 추가**

```typescript
// ===== Widget 핸드셰이크 응답 =====
if (type === 'widget_handshake_ack') {
  this.handleWidgetHandshakeAck(payload, from);
  return;
}
```

**Step 3: import 추가**

```typescript
import { isWidgetHandshakeAckPayload } from '@estelle/core';
```

**Step 4: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): add widget handshake ack handler"
```

---

## Phase 3: 소유권 관리

### Task 3.1: Widget Claim 핸들러

**Files:**
- Modify: `packages/pylon/src/pylon.ts`
- Modify: `packages/pylon/src/managers/widget-manager.ts`

**Step 1: WidgetManager에 claimOwnership 메서드 추가**

```typescript
/**
 * 소유권 요청 처리 (first-come-first-served)
 * @returns 성공 여부
 */
claimOwnership(sessionId: string, clientId: number): boolean {
  const session = this.sessions.get(sessionId);
  if (!session) return false;

  // pending 상태일 때만 claim 가능
  if (session.status !== 'pending') return false;

  session.status = 'running';
  session.ownerClientId = clientId;
  return true;
}

/**
 * 소유자 확인
 */
isOwner(sessionId: string, clientId: number): boolean {
  const session = this.sessions.get(sessionId);
  return session?.ownerClientId === clientId;
}
```

**Step 2: Pylon에 handleWidgetClaim 메서드 추가**

```typescript
/**
 * Widget 소유권 요청 처리
 */
private handleWidgetClaim(
  payload: Record<string, unknown> | undefined,
  from?: MessageFrom,
): void {
  if (!isWidgetClaimPayload(payload)) {
    this.log('[Widget] Invalid widget_claim payload');
    return;
  }

  const { sessionId } = payload;
  const clientId = from?.deviceId;

  if (clientId === undefined) {
    this.log('[Widget] Missing clientId in widget_claim');
    return;
  }

  const success = this.deps.widgetManager?.claimOwnership(sessionId, clientId);

  if (success) {
    this.log(`[Widget] Ownership claimed: session=${sessionId}, owner=${clientId}`);

    // 소유자에게 widget_render 전송
    const session = this.deps.widgetManager?.getSession(sessionId);
    if (session) {
      // TODO: 현재 view를 소유자에게 전송
    }

    // 다른 클라이언트에게 widget_claimed 전송
    this.send({
      type: 'widget_claimed',
      payload: { sessionId, ownerClientId: clientId },
      // 소유자 제외 브로드캐스트 (to 필드 없이)
    });
  } else {
    this.log(`[Widget] Ownership claim failed: session=${sessionId}, client=${clientId}`);
  }
}
```

**Step 3: handleMessage에 라우팅 추가**

```typescript
// ===== Widget 소유권 요청 =====
if (type === 'widget_claim') {
  this.handleWidgetClaim(payload, from);
  return;
}
```

**Step 4: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add packages/pylon/src/pylon.ts packages/pylon/src/managers/widget-manager.ts
git commit -m "feat(pylon): add widget claim handler"
```

---

### Task 3.2: 소유자 전용 이벤트 필터링

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: handleWidgetEvent에 소유자 검증 추가**

기존 handleWidgetEvent 수정:

```typescript
private handleWidgetEvent(payload?: Record<string, unknown>, from?: MessageFrom): void {
  const sessionId = payload?.sessionId as string | undefined;
  const data = payload?.data as Record<string, unknown> | undefined;
  const clientId = from?.deviceId;

  if (!sessionId || data === undefined) {
    this.log('[Widget] Missing sessionId or data in widget_event');
    return;
  }

  // 소유자 검증 (inline 위젯 제외)
  if (!sessionId.startsWith('inline-') && clientId !== undefined) {
    const isOwner = this.deps.widgetManager?.isOwner(sessionId, clientId);
    if (!isOwner) {
      this.log(`[Widget] Event rejected: client ${clientId} is not owner of ${sessionId}`);
      return;
    }
  }

  // ... 기존 로직 ...
}
```

**Step 2: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): filter widget events by ownership"
```

---

## Phase 4: 종료 및 히스토리

### Task 4.1: Widget Complete 브로드캐스트

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: sendWidgetComplete 메서드 추가**

```typescript
/**
 * 위젯 완료 브로드캐스트
 */
private sendWidgetComplete(
  conversationId: number,
  sessionId: string,
  toolUseId: string,
  view: ViewNode,
  result: unknown,
): void {
  this.send({
    type: 'widget_complete',
    payload: {
      conversationId,
      sessionId,
      toolUseId,
      view,
      result,
    },
  });
}
```

**Step 2: WidgetManager complete 이벤트에서 호출**

기존 widget_render 브로드캐스트 로직을 widget_complete로 변경.

**Step 3: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): broadcast widget_complete to all clients"
```

---

### Task 4.2: 소유자 연결 해제 시 위젯 종료

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: 클라이언트 연결 해제 시 위젯 정리 로직**

```typescript
/**
 * 클라이언트 연결 해제 처리
 */
private handleClientDisconnect(clientId: number): void {
  // 해당 클라이언트가 소유한 위젯 세션 찾기
  const sessions = this.deps.widgetManager?.getSessionsByOwner(clientId);

  for (const session of sessions ?? []) {
    // 위젯 강제 종료
    this.deps.widgetManager?.cancelSession(session.sessionId);

    // 에러 브로드캐스트
    this.send({
      type: 'widget_error',
      payload: {
        conversationId: session.conversationId,
        sessionId: session.sessionId,
        toolUseId: session.toolUseId,
        error: 'Widget owner disconnected',
      },
    });
  }
}
```

**Step 2: WidgetManager에 getSessionsByOwner 메서드 추가**

```typescript
/**
 * 특정 클라이언트가 소유한 세션 목록 조회
 */
getSessionsByOwner(clientId: number): WidgetSession[] {
  const result: WidgetSession[] = [];
  for (const session of this.sessions.values()) {
    if (session.ownerClientId === clientId && session.status === 'running') {
      result.push(session);
    }
  }
  return result;
}
```

**Step 3: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add packages/pylon/src/pylon.ts packages/pylon/src/managers/widget-manager.ts
git commit -m "feat(pylon): handle widget cleanup on owner disconnect"
```

---

## Phase 5: 통합 테스트

### Task 5.1: Widget Ownership 유닛 테스트

**Files:**
- Create: `packages/pylon/tests/managers/widget-manager-ownership.test.ts`

**Step 1: 테스트 파일 작성**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { WidgetManager } from '../../src/managers/widget-manager.js';

describe('WidgetManager Ownership', () => {
  let manager: WidgetManager;

  beforeEach(() => {
    manager = new WidgetManager();
  });

  describe('claimOwnership', () => {
    it('should claim ownership when session is pending', () => {
      // TODO: Mock session creation
    });

    it('should reject claim when session is already running', () => {
      // TODO
    });

    it('should reject claim for non-existent session', () => {
      const result = manager.claimOwnership('non-existent', 1);
      expect(result).toBe(false);
    });
  });

  describe('isOwner', () => {
    it('should return true for owner', () => {
      // TODO
    });

    it('should return false for non-owner', () => {
      // TODO
    });
  });
});
```

**Step 2: 테스트 실행**

Run: `pnpm --filter @estelle/pylon test tests/managers/widget-manager-ownership.test.ts`
Expected: Tests should pass (or fail expectedly for TODO items)

**Step 3: Commit**

```bash
git add packages/pylon/tests/managers/widget-manager-ownership.test.ts
git commit -m "test(pylon): add widget ownership unit tests"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1.1-1.6 | 핵심 인프라: 메시지 타입, Payload 타입, lastActiveClientId |
| 2 | 2.1-2.2 | 핸드셰이크 구현 |
| 3 | 3.1-3.2 | 소유권 관리: claim, 이벤트 필터링 |
| 4 | 4.1-4.2 | 종료 및 에러 처리 |
| 5 | 5.1 | 통합 테스트 |

**총 Task 수:** 11개
**예상 시간:** 각 Task 5-10분, 전체 1-2시간
