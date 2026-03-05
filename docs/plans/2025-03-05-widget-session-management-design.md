# Widget 세션 관리 설계

## 개요

Widget 세션을 질문(AskUserQuestion)의 확장 케이스로 관리하여 엣지 케이스에 대한 안정성을 확보한다.

**핵심 원칙:**
- Pylon이 위젯 세션의 Single Source of Truth
- 대화당 1개의 위젯만 허용
- Client는 렌더링만 담당
- 대화 복귀 시 프로세스 상태 검증

## 현재 문제점

| 케이스 | 현재 상태 | 심각도 |
|--------|-----------|--------|
| 대화 미선택 상태에서 위젯 시작 | 렌더링 실패, MCP 무한 대기 | 🔴 높음 |
| 위젯 실행 중 대화 전환 | 이전 위젯 렌더링 안 됨 | 🟡 중간 |
| 위젯 실행 중 대화 삭제 | 좀비 프로세스, MCP 무한 대기 | 🔴 높음 |
| 같은 대화에서 중복 위젯 | 이전 위젯 덮어씀 | 🟡 중간 |
| 세션 정리 불완전 | 메모리/프로세스 누수 | 🟡 중간 |
| 대화 복귀 시 프로세스 죽음 | 위젯 UI만 남고 응답 불가 | 🔴 높음 |

## 아키텍처

```
                     Pylon (Single Source of Truth)
                     ┌─────────────────────────────────────────────┐
                     │  pendingWidgets: Map<conversationId, PendingWidget>  │
                     │  WidgetManager: Map<widgetSessionId, WidgetSession>  │
                     └─────────────────────────────────────────────┘
                              │                    ▲
              widget_render   │                    │ widget_input/cancel
              widget_close    │                    │ widget_check
                              ▼                    │
                     ┌─────────────────────────────────────────────┐
                     │  Client (conversationStore)                  │
                     │  widgetSession: { toolUseId, sessionId, ... }│
                     │  (렌더링용, Pylon이 master)                   │
                     └─────────────────────────────────────────────┘
```

## 데이터 구조

### Pylon

```typescript
// pylon-mcp-server.ts 또는 별도 모듈
interface PendingWidget {
  conversationId: number;
  toolUseId: string;
  widgetSessionId: string;    // WidgetManager의 sessionId
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

// Key = conversationId (대화당 1개만 허용)
private readonly pendingWidgets: Map<number, PendingWidget> = new Map();
```

### Client

```typescript
// conversationStore.ts (기존 구조 유지)
interface WidgetSession {
  toolUseId: string;
  sessionId: string;
  view: ViewNode;
  inputs: InputNode[];
}
```

### 메시지 타입

```typescript
// core/src/types/widget.ts

// widget_render - conversationId 필수
interface WidgetRenderPayload {
  conversationId: number;   // 필수
  toolUseId: string;
  sessionId: string;
  view: ViewNode;
  inputs: InputNode[];
}

// widget_check - 위젯 상태 확인 요청 (신규)
interface WidgetCheckPayload {
  conversationId: number;
  sessionId: string;
}

// widget_check_result - 위젯 상태 확인 응답 (신규)
interface WidgetCheckResultPayload {
  conversationId: number;
  sessionId: string;
  valid: boolean;           // 프로세스가 살아있는지
}
```

## 케이스별 처리

### Case 1: 대화 미선택 상태에서 위젯 시작

**시나리오:** Claude가 run_widget 호출했는데 Client에서 대화가 선택 안 됨

**처리:**
1. Pylon에서 `pendingWidgets.set(conversationId, {...})` 저장
2. `widget_render` 메시지에 `conversationId` 필수 포함
3. Client: `selectedConversation`과 무관하게 `conversationId`로 저장
4. 사용자가 해당 대화 선택하면 위젯 표시

```
Pylon: run_widget(conversationId=123)
  ├─ pendingWidgets.set(123, {...})
  ├─ WidgetManager.startSession()
  └─ widget_render { conversationId: 123, ... }

Client: widget_render 수신
  └─ conversationStore.setWidgetSession(123, ...)
      (selectedConversation !== 123 이어도 저장)

사용자: 대화 123 선택
  └─ ToolCard 렌더링 → widgetSession 표시
```

### Case 2: 위젯 실행 중 대화 전환

**시나리오:** 대화 A에서 위젯 실행 중, 사용자가 대화 B로 전환

**처리 (병렬 유지):**
- 각 대화마다 독립적인 widgetSession 유지
- 대화 전환해도 정리 안 함
- 다시 대화 A로 돌아오면 위젯 계속 표시

```
대화 A: run_widget 실행 (pendingWidgets[A] 존재)
사용자: 대화 B로 전환
  └─ 대화 A의 위젯 상태 유지 (정리 안 함)

사용자: 대화 A로 복귀
  └─ Case 7 (프로세스 검증) 실행
```

### Case 3: 위젯 실행 중 대화 삭제

**시나리오:** 대화 A에서 위젯 실행 중, 대화 A 삭제됨

**처리 (강제 종료 후 삭제):**
1. 대화 삭제 전 `pendingWidgets.has(conversationId)` 확인
2. 있으면 `cancelWidgetForConversation(conversationId)` 호출
3. `WidgetManager.cancelSession()` → 프로세스 종료
4. `pending.reject(new Error('Conversation deleted'))`
5. `pendingWidgets.delete(conversationId)`
6. 대화 삭제 진행

```
사용자/서버: 대화 A 삭제 요청

Pylon: handleDeleteConversation(A)
  ├─ pending = pendingWidgets.get(A)
  ├─ if (pending):
  │   ├─ WidgetManager.cancelSession(pending.widgetSessionId)
  │   ├─ pending.reject(new Error('Conversation deleted'))
  │   └─ pendingWidgets.delete(A)
  └─ 대화 삭제 진행

Client: conversation_delete 수신
  └─ conversationStore.deleteConversation(A)
```

### Case 4: 같은 대화에서 중복 위젯 시도

**시나리오:** 대화 A에서 위젯 실행 중, 다른 run_widget 호출

**처리 (차단):**

```typescript
async handleRunWidget(conversationId: number, args: RunWidgetArgs): Promise<McpResponse> {
  if (this.pendingWidgets.has(conversationId)) {
    return createErrorResponse(
      'Widget already running in this conversation. Complete or cancel the existing widget first.'
    );
  }
  // 위젯 시작...
}
```

### Case 5: 위젯 완료/취소

**위젯 완료 (complete):**
```
CLI: { type: 'complete', result: {...} }
  ↓
WidgetManager: emit('complete', { sessionId, result })
  ↓
Pylon:
  ├─ pending = findPendingByWidgetSessionId(sessionId)
  ├─ pending.resolve(result)
  ├─ pendingWidgets.delete(conversationId)
  └─ widget_close 메시지 전송
  ↓
Client:
  ├─ conversationStore.clearWidgetSession(conversationId)
  └─ widgetEventListeners.delete(sessionId)
```

**위젯 취소 (X 버튼):**
```
Client: widget_cancel { conversationId, sessionId }
  ↓
Pylon:
  ├─ pending = pendingWidgets.get(conversationId)
  ├─ WidgetManager.cancelSession(pending.widgetSessionId)
  ├─ pending.reject(new Error('Cancelled by user'))
  ├─ pendingWidgets.delete(conversationId)
  └─ widget_close 메시지 전송
  ↓
Client:
  ├─ conversationStore.clearWidgetSession(conversationId)
  └─ widgetEventListeners.delete(sessionId)
```

### Case 6: Pylon 재시작

**시나리오:** 위젯 실행 중 Pylon이 재시작됨

**처리:**
- `pendingWidgets`는 메모리에만 있으므로 소멸
- WidgetManager의 프로세스도 종료됨
- Client의 widgetSession은 남아있지만 Pylon과 연결 끊김

**복구 흐름:**
```
Pylon 재시작 후 Client 재연결
  ↓
Client: 각 대화의 widgetSession 확인
  ├─ widgetSession 있으면 widget_check 전송
  │   { conversationId, sessionId }
  ↓
Pylon: widget_check 수신
  ├─ pendingWidgets.has(conversationId)? → NO
  └─ widget_check_result { valid: false }
  ↓
Client: widget_check_result { valid: false }
  ├─ conversationStore.clearWidgetSession(conversationId)
  └─ widgetEventListeners.delete(sessionId)
```

### Case 7: 대화 복귀 시 프로세스 검증

**시나리오:** 대화 A 위젯 실행 중 대화 B로 전환, 시간이 지난 후 대화 A로 복귀.
이 사이에 프로세스가 죽었을 수 있음.

**처리:**
```
사용자: 대화 A 선택 (widgetSession 있음)
  ↓
Client: widget_check { conversationId: A, sessionId }
  ↓
Pylon:
  ├─ pending = pendingWidgets.get(A)
  ├─ if (!pending || pending.widgetSessionId !== sessionId):
  │   └─ widget_check_result { valid: false }
  ├─ session = WidgetManager.getSession(pending.widgetSessionId)
  ├─ if (!session || session.status !== 'running'):
  │   ├─ pendingWidgets.delete(A)
  │   └─ widget_check_result { valid: false }
  └─ widget_check_result { valid: true }
  ↓
Client:
  ├─ if (!valid):
  │   ├─ conversationStore.clearWidgetSession(A)
  │   └─ widgetEventListeners.delete(sessionId)
  └─ else: 위젯 정상 표시
```

## 메시지 흐름 정리

### 새 메시지 타입

| 메시지 | 방향 | 용도 |
|--------|------|------|
| `widget_check` | Client → Pylon | 위젯 세션 유효성 확인 요청 |
| `widget_check_result` | Pylon → Client | 위젯 세션 유효성 응답 |

### 기존 메시지 변경

| 메시지 | 변경 내용 |
|--------|-----------|
| `widget_render` | `conversationId` 필수 |
| `widget_cancel` | `conversationId` 추가 (sessionId만으로도 찾을 수 있지만 명시적으로) |

## 수정 필요 파일

### Pylon

| 파일 | 변경 내용 |
|------|-----------|
| `pylon/src/servers/pylon-mcp-server.ts` | `pendingWidgets` Map 추가, 중복 체크, 정리 로직 |
| `pylon/src/pylon.ts` | `widget_check` 핸들러, 대화 삭제 시 위젯 정리 훅 |
| `pylon/src/managers/widget-manager.ts` | `getSession()` public 메서드 추가 (이미 있으면 확인) |

### Client

| 파일 | 변경 내용 |
|------|-----------|
| `client/src/hooks/useMessageRouter.ts` | `widget_render`에서 `conversationId` 필수 사용, `widget_check_result` 핸들러 |
| `client/src/stores/conversationStore.ts` | 이벤트 리스너 정리 로직 (`clearWidgetSession` 시 자동 정리) |
| `client/src/components/chat/ChatArea.tsx` 또는 관련 | 대화 선택 시 `widget_check` 전송 |

### Core

| 파일 | 변경 내용 |
|------|-----------|
| `core/src/types/widget.ts` | `WidgetRenderPayload`에 `conversationId` 필수, 새 메시지 타입 추가 |
| `core/src/constants/message-type.ts` | `widget_check`, `widget_check_result` 추가 |

## 구현 순서

1. **Core:** 메시지 타입 정의 추가
2. **Pylon:** `pendingWidgets` 관리 로직 구현
3. **Pylon:** `widget_check` 핸들러 구현
4. **Pylon:** 대화 삭제 시 위젯 정리 훅
5. **Client:** `widget_render` 핸들러 수정 (conversationId 필수)
6. **Client:** `widget_check` 전송 로직 (대화 선택 시)
7. **Client:** `widget_check_result` 핸들러
8. **Client:** `clearWidgetSession` 시 이벤트 리스너 정리
9. **테스트:** 각 케이스별 테스트 작성

## 테스트 케이스

1. 대화 미선택 상태에서 run_widget → 대화 선택 시 위젯 표시
2. 위젯 실행 중 대화 전환 → 복귀 시 위젯 유지
3. 위젯 실행 중 대화 삭제 → MCP 에러 반환, 프로세스 종료
4. 같은 대화에서 중복 run_widget → 에러 반환
5. 위젯 완료 → 정리 완료
6. 위젯 취소 (X 버튼) → 정리 완료
7. Pylon 재시작 → Client에서 위젯 정리
8. 대화 복귀 시 프로세스 죽음 → 위젯 정리
