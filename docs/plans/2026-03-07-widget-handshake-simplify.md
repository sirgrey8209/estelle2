# Widget Handshake 단순화

## 목표

3가지 메시지(widget_handshake, widget_pending, widget_claimed)를 1가지(widget_ready)로 통합

## 현재 구조

```
1. widget_handshake → lastActiveClient에게만
2. (타임아웃/거부) → widget_pending → 전체 broadcast
3. widget_claimed → 전체 broadcast
```

## 새로운 구조

### 메시지

| 메시지 | 방향 | 대상 | 설명 |
|--------|------|------|------|
| `widget_ready` | Pylon → Client | broadcast | 위젯 준비됨, preferredClientId 포함 |
| `widget_claim` | Client → Pylon | - | 위젯 실행/종료 요청 |
| `widget_render` | Pylon → Client | owner만 | 위젯 UI 렌더링 |
| `widget_event` | Pylon → Client | owner만 | CLI → Client 이벤트 |
| `widget_close` | Pylon → Client | owner만 | 위젯 종료 |

### 흐름

```
1. MCP run_widget 호출
2. Pylon: prepareSession (CLI 미시작, status: 'ready')
3. Pylon → 전체: widget_ready { sessionId, preferredClientId, conversationId, toolUseId }
4. 각 클라이언트:
   - 내가 preferredClientId → 자동으로 widget_claim 전송
   - 아니면 → pending UI 표시, "시작" 버튼
5. Pylon: 첫 widget_claim 수신
   - owner 설정, CLI 시작
   - widget_render → owner에게만
```

### widget_claim의 의미

**"나한테 실행해줘"가 아니라 "저거 꺼줘 / 내가 할게"**

```
widget_claim 수신
  ↓
이미 owner가 있는가?
  ├─ Yes → 위젯 종료 (CLI kill, widget_close to owner)
  │        MCP 도구 결과: { cancelled: true, reason: 'claimed_by_other' }
  │        대화는 계속됨
  └─ No → owner 설정, CLI 시작, widget_render → owner
```

### 다른 클라이언트에서 실행하고 싶을 때

```
1. widget_ready { preferredClientId: A } → 전체 broadcast
2. Client A: 자동 widget_claim → owner 됨, 위젯 실행
3. Client B: pending UI 표시

--- Client B가 "시작" 버튼 누름 ---

4. Client B → widget_claim
5. Pylon: Client A 위젯 종료, MCP 도구 cancelled 반환
6. 대화 계속 (Claude 응답 진행 중이면 계속)
7. Client B가 대화하면서 lastActiveClient가 됨
8. 다음 위젯 → Client B가 preferredClient
```

## 장점

- 메시지 타입 3개 → 1개 (widget_ready)
- 타임아웃 로직 제거
- 모든 클라이언트가 처음부터 상태 인지
- claim = 종료 요청으로 단순화

## 수정 대상

### Pylon
- [x] `pylon.ts`: initiateWidgetHandshake → broadcastWidgetReady
- [x] `pylon.ts`: handleWidgetHandshakeAck 제거
- [x] `pylon.ts`: handleWidgetClaim 수정 (첫 claim → owner, 이후 claim → 종료)
- [x] `pylon-mcp-server.ts`: _handleRunWidget 수정
- [x] `widget-manager.ts`: status 'ready' 추가, claimOwnership 로직 수정
- [x] `bin.ts`: broadcastWidgetReady 연결

### Client
- [x] `useMessageRouter.ts`: widget_handshake, widget_pending, widget_claimed → widget_ready
- [x] `conversationStore.ts`: setWidgetClaimed 제거
- [x] `relaySender.ts`: sendWidgetHandshakeAck 제거, sendWidgetClaim 유지
- [x] UI 타입 수정: 'claimed' 상태 제거

### Core
- [x] `message-type.ts`: WIDGET_HANDSHAKE, WIDGET_PENDING, WIDGET_CLAIMED 제거, WIDGET_READY 추가
- [x] `conversation-claude.ts`: WidgetSession status에서 'claimed' 제거
