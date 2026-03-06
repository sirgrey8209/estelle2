# Widget Ownership 버그 분석 및 수정 계획

## 현재 상태 (v0306_8)

핸드셰이크 프로토콜 구현 완료. 기본적인 위젯 실행 및 이벤트 처리는 정상 동작.

**해결된 문제:**
- ✅ 핸드셰이크 프로토콜 구현 (prepareSession → handshake → startSessionProcess)
- ✅ Widget Ownership 설정 및 이벤트 검증
- ✅ Pending 상태 UI ("시작" 버튼) 구현
- ✅ 기본 위젯 실행 및 버튼 클릭 이벤트

**남은 문제:**
- ❌ CLI → Client 이벤트 전달 (`api.onEvent`) 동작 안 함

## 현재 증상

서버 시간 위젯 테스트:
- 위젯 실행 자체는 정상
- 버튼 클릭 (Client → CLI) 이벤트는 동작
- 5초마다 서버에서 보내는 시간 업데이트 (CLI → Client) 이벤트가 클라이언트에서 수신되지 않음

```
CLI: sendEvent({ type: 'time_update', time: '23:50:07' })
     → JSON.stringify({ type: 'event', data: ... })
     → stdout으로 출력

Client: api.onEvent((data) => { ... })
     → 호출되지 않음
```

## 이전 증상 (해결됨)

```
[Widget] Event rejected: client 16 is not owner of widget-6-1772797948063
```

- 버튼 클릭 등 이벤트가 Pylon에서 reject됨
- CLI 위젯이 이벤트를 받지 못함
- X 버튼, 닫기 버튼 모두 동작 안 함

## Root Cause 분석

### 1. 핸드셰이크가 트리거되지 않음

**설계:**
```
MCP run_widget 호출
  → Pylon이 widget_handshake를 lastActiveClient에게 전송
  → 클라이언트가 widget_handshake_ack 응답
  → 응답 받으면 owner 설정 후 CLI 프로세스 시작
```

**실제:**
```
MCP run_widget 호출
  → pylon-mcp-server._handleRunWidget()
  → widgetManager.startSession() 바로 호출 (핸드셰이크 없음!)
  → CLI 프로세스 시작
  → ownerClientId = null인 상태로 running
```

### 2. 구현된 것 vs 누락된 것

**구현됨:**
- WidgetManager.startHandshake() 메서드 존재
- WidgetManager.handleHandshakeAck() 메서드 존재
- Pylon.handleWidgetHandshakeAck() 핸들러 존재
- 메시지 타입 상수 (WIDGET_HANDSHAKE, WIDGET_HANDSHAKE_ACK 등)
- Payload 타입 정의

**누락됨:**
- `_handleRunWidget()`에서 핸드셰이크 시작 로직
- Pylon에서 `widget_handshake` 메시지 전송 로직
- 핸드셰이크 완료 후 CLI 시작 로직

### 3. 잘못된 흐름

현재 코드 (`pylon-mcp-server.ts:1691`):
```typescript
// Widget 세션 시작 (핸드셰이크 없이 바로!)
const sessionId = await this._widgetManager.startSession({
  command,
  cwd,
  args,
  conversationId,
  toolUseId,
});
```

## 올바른 구현 방향

### Phase 1: 핸드셰이크 → CLI 시작 순서 재정립

```
1. MCP run_widget 호출
2. Pylon이 위젯 세션 "준비" (CLI 미시작, status: 'handshaking')
3. Pylon이 lastActiveClient에게 widget_handshake 전송
4. 3초 타임아웃 대기:
   - 응답 받음 (visible: true) → owner 설정, CLI 시작
   - 응답 받음 (visible: false) → pending 상태, 다른 클라이언트 claim 대기
   - 타임아웃 → pending 상태, 다른 클라이언트 claim 대기
5. pending 상태에서 widget_claim 받으면 → owner 설정, CLI 시작
```

### Phase 2: WidgetManager 수정

```typescript
// 새로운 메서드: 세션 준비 (CLI 미시작)
prepareSession(options: WidgetStartOptions): string {
  const sessionId = `widget-${++this.sessionCounter}-${Date.now()}`;

  const session: WidgetSession = {
    sessionId,
    conversationId: options.conversationId,
    toolUseId: options.toolUseId,
    process: null,  // CLI 아직 시작 안 함
    status: 'handshaking',
    ownerClientId: null,
    command: options.command,
    cwd: options.cwd,
    args: options.args,
  };

  this.sessions.set(sessionId, session);
  return sessionId;
}

// 새로운 메서드: CLI 시작 (owner 설정 후)
startSessionProcess(sessionId: string, ownerClientId: number): boolean {
  const session = this.sessions.get(sessionId);
  if (!session || session.process) return false;

  session.ownerClientId = ownerClientId;
  session.status = 'running';

  // CLI 프로세스 spawn
  const proc = spawn(session.command, session.args ?? [], {
    cwd: session.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  session.process = proc;
  // ... 이벤트 리스너 등록

  return true;
}
```

### Phase 3: Pylon 핸드셰이크 트리거

```typescript
// pylon-mcp-server.ts 또는 pylon.ts
async initiateWidgetHandshake(
  sessionId: string,
  conversationId: number,
  toolUseId: string,
): Promise<void> {
  const lastActiveClientId = this._workspaceStore.getLastActiveClient(conversationId);

  if (lastActiveClientId) {
    // 핸드셰이크 메시지 전송
    this.send({
      type: 'widget_handshake',
      payload: {
        conversationId,
        sessionId,
        toolUseId,
        timeout: 3000,
      },
      to: [lastActiveClientId],
    });

    // 타임아웃 후 pending 처리
    setTimeout(() => {
      const session = this._widgetManager.getSession(sessionId);
      if (session?.status === 'handshaking') {
        session.status = 'pending';
        // widget_pending 브로드캐스트
        this.send({
          type: 'widget_pending',
          payload: { conversationId, sessionId, toolUseId },
          broadcast: 'clients',
        });
      }
    }, 3000);
  } else {
    // lastActiveClient 없으면 바로 pending
    this._widgetManager.setSessionStatus(sessionId, 'pending');
    this.send({
      type: 'widget_pending',
      payload: { conversationId, sessionId, toolUseId },
      broadcast: 'clients',
    });
  }
}
```

### Phase 4: _handleRunWidget 수정

```typescript
private async _handleRunWidget(...): Promise<McpResponse> {
  // 1. 세션 준비 (CLI 미시작)
  const sessionId = this._widgetManager.prepareSession({
    command, cwd, args, conversationId, toolUseId,
  });

  // 2. pendingWidgets에 등록
  this._pendingWidgets.set(conversationId, { ... });

  // 3. 핸드셰이크 시작 (비동기)
  this._initiateWidgetHandshake(sessionId, conversationId, toolUseId);

  // 4. 결과 대기 (CLI 완료 시)
  return new Promise((resolve, reject) => { ... });
}
```

### Phase 5: 핸드셰이크 응답 처리

```typescript
// Pylon.handleWidgetHandshakeAck
private handleWidgetHandshakeAck(payload, from): void {
  const { sessionId, visible } = payload;
  const clientId = from?.deviceId;

  const session = this.deps.widgetManager?.getSession(sessionId);
  if (!session || session.status !== 'handshaking') return;

  if (visible) {
    // owner 설정하고 CLI 시작
    this.deps.widgetManager?.startSessionProcess(sessionId, clientId);
    this.send({
      type: 'widget_claimed',
      payload: { sessionId, ownerClientId: clientId },
      broadcast: 'clients',
    });
  } else {
    // pending 상태로 전환
    session.status = 'pending';
    this.send({
      type: 'widget_pending',
      payload: { sessionId },
      broadcast: 'clients',
    });
  }
}
```

## 수정이 필요한 파일

| 파일 | 수정 내용 |
|------|----------|
| `packages/pylon/src/managers/widget-manager.ts` | `prepareSession()`, `startSessionProcess()` 추가, `startSession()` 분리 |
| `packages/pylon/src/servers/pylon-mcp-server.ts` | `_handleRunWidget()` 수정 - 핸드셰이크 먼저 |
| `packages/pylon/src/pylon.ts` | `initiateWidgetHandshake()` 추가, `handleWidgetHandshakeAck()` 수정 |

## 임시 우회 방안 (권장하지 않음)

첫 이벤트를 보낸 클라이언트를 자동으로 owner로 설정하는 방식은:
- 여러 클라이언트 환경에서 race condition 발생 가능
- 설계 의도와 맞지 않음
- 나중에 제대로 구현할 때 혼란 야기

## 구현 완료 내역

### 서버 측 (Pylon)

1. **WidgetManager 리팩토링** (`widget-manager.ts`)
   - `startSession()` → `prepareSession()` + `startSessionProcess()` 분리
   - `prepareSession()`: 세션 생성, status: 'handshaking', CLI 미시작
   - `startSessionProcess()`: owner 설정 후 CLI spawn
   - `handleHandshakeAck()`: 핸드셰이크 응답 이벤트 emit
   - `claimOwnership()`: pending 상태에서 소유권 요청 처리

2. **핸드셰이크 트리거** (`pylon.ts`)
   - `initiateWidgetHandshake()`: lastActiveClient에게 widget_handshake 전송, 3초 타임아웃
   - `broadcastWidgetPending()`: 핸드셰이크 실패 시 pending 브로드캐스트
   - `handleWidgetHandshakeAck()`: 응답 처리 → widgetManager.handleHandshakeAck() 호출
   - `handleWidgetClaim()`: pending 상태에서 claim 요청 처리

3. **_handleRunWidget 수정** (`pylon-mcp-server.ts`)
   - prepareSession → initiateWidgetHandshake → (성공 시) startSessionProcess
   - 핸드셰이크 실패/타임아웃 시 pending 상태로 전환

### 클라이언트 측

1. **메시지 핸들러** (`useMessageRouter.ts`)
   - `widget_handshake`: visible 여부 판단 후 ack 전송
   - `widget_pending`: conversationStore에 pending 상태 저장
   - `widget_claimed`: conversationStore에 claimed 상태 저장

2. **Relay 전송** (`relaySender.ts`)
   - `sendWidgetHandshakeAck()`: 핸드셰이크 응답
   - `sendWidgetClaim()`: 소유권 요청

3. **상태 관리** (`conversationStore.ts`)
   - `setWidgetPending()`: pending 상태 저장
   - `setWidgetClaimed()`: claimed 상태 저장
   - WidgetSession에 `status` 필드 추가

4. **UI** (`ToolCard.tsx`, `MessageBubble.tsx`, `MessageList.tsx`)
   - pending 상태일 때 "시작" 버튼 표시
   - `onWidgetClaim` prop 체인

5. **Widget API** (`WidgetScriptRenderer.tsx`)
   - `api.onEvent()` 추가 (api.onMessage의 alias)

---

## 남은 문제: CLI → Client 이벤트 전달

### 데이터 흐름 분석

```
1. CLI (test-cli/index.ts)
   sendEvent({ type: 'time_update', time: '...' })
   → console.log(JSON.stringify({ type: 'event', data: ... }))

2. WidgetManager (widget-manager.ts)
   process.stdout.on('data') → parseOutput() → emit('event', ...)

3. Pylon (pylon-mcp-server.ts)
   widgetManager.on('event') → this._onWidgetEvent?.(...)

4. Client로 전송 (어딘가?)
   ??? → ws.send({ type: 'widget_event', payload: ... })

5. Client (useMessageRouter.ts)
   case 'widget_event': → ???

6. WidgetScriptRenderer
   api.onEvent callback 호출
```

### 추적 필요 지점

1. WidgetManager가 `event` 이벤트를 emit하는지?
2. Pylon이 이 이벤트를 받아서 클라이언트에 전송하는지?
3. 클라이언트가 `widget_event` 메시지를 받는지?
4. WidgetScriptRenderer로 이벤트가 전달되는지?

### 다음 단계

1. CLI → WidgetManager 이벤트 emit 확인
2. WidgetManager → Pylon 이벤트 핸들러 연결 확인
3. Pylon → Client 메시지 전송 로직 확인
4. Client → WidgetScriptRenderer 이벤트 전달 확인
