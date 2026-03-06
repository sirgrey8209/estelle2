# 위젯 소유권 모델 설계

> 작성일: 2026-03-06
> 상태: 설계 단계

## 문제 정의

**현재 상황:**
- 여러 클라이언트가 같은 대화(Conversation)에 동시 접속 가능
- 위젯이 실행되면 모든 클라이언트에게 `widget_render` 브로드캐스트
- 각 클라이언트의 위젯이 독립적으로 이벤트를 전송
- 결과: 서버에 중복 이벤트 발생 (5초마다 보내는 위젯이면 2배로 수신)

**정책:**
- 위젯은 **1인용** (단일 클라이언트만 이벤트 송수신)
- 단, 대화 자체는 여러 클라이언트가 공유 가능

## 설계

### 1. 핵심 개념

#### 1.1 위젯 소유자(Owner)
- 위젯 실행 시, 특정 클라이언트가 "소유자"가 됨
- 소유자만 이벤트 송수신 가능
- 비소유자는 "실행 버튼" 상태로 대기

#### 1.2 Visibility (가시성) 체크
- 핸드셰이크 시 클라이언트가 "이 대화를 보고 있는지" 응답
- **조건:** `document.visibilityState === 'visible'` AND 위젯 메시지가 Intersection Observer로 뷰포트 내에 있음
- 보고 있지 않으면 → 핸드셰이크 실패

### 2. 흐름 설계

#### 2.1 위젯 실행 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Pylon: MCP 도구 호출로 위젯 실행 요청                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. Pylon → 소유자 후보 Client: widget_handshake 요청                     │
│    - 소유자 후보: 마지막으로 대화한 클라이언트 (lastActiveClientId)         │
│    - 타임아웃 포함 (예: 3초)                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. Client: Visibility 체크                                               │
│    - Page Visibility API: 탭이 visible인가?                              │
│    - Intersection Observer: 위젯 메시지가 뷰포트에 보이는가?               │
├─────────────────────────────────────────────────────────────────────────┤
│ 4a. Visible → 핸드셰이크 성공                                             │
│    - Client → Pylon: widget_handshake_ack { visible: true }             │
│    - Pylon → Client: widget_render (위젯 렌더링 + 스피너)                 │
│    - Client가 소유자가 됨                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ 4b. Not Visible 또는 타임아웃 → 핸드셰이크 실패                           │
│    - Pylon → 모든 Client: widget_pending (실행 버튼 표시)                 │
│    - 모든 클라이언트가 "실행 버튼" 상태                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ 5. 실행 버튼 클릭 시                                                      │
│    - Client → Pylon: widget_claim { sessionId }                         │
│    - 첫 번째 요청자가 소유자가 됨 (first-come-first-served)               │
│    - Pylon → 소유자: widget_render                                       │
│    - Pylon → 비소유자: widget_claimed (다른 클라이언트가 실행 중 표시)     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2.2 위젯 종료 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. 위젯 완료 (CLI → Pylon: complete)                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. Pylon: 종료 페이지(result view) 수신                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. Pylon → 모든 Client: widget_complete (전체 브로드캐스트)              │
│    - 종료 페이지 포함                                                     │
│    - 모든 클라이언트가 동일한 결과 화면 표시                               │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. Pylon: 히스토리에 종료 페이지 저장                                     │
│    - 나중에 대화 열어도 종료 결과 확인 가능                                │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2.3 Pylon 재시작 시

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Pylon 재시작 감지                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. 실행 중이던 위젯 세션은 실패로 간주                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. Pylon → 모든 Client: widget_error                                     │
│    - 종료 페이지 없음, 에러 상태로 표시                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. 메시지 타입 정의

#### 3.1 새로운 메시지 타입

```typescript
// Pylon → Client: 핸드셰이크 요청
interface WidgetHandshakePayload {
  conversationId: number;
  sessionId: string;
  toolUseId: string;
  timeout: number;  // ms
}

// Client → Pylon: 핸드셰이크 응답
interface WidgetHandshakeAckPayload {
  sessionId: string;
  visible: boolean;
}

// Pylon → Client: 위젯 대기 상태 (실행 버튼)
interface WidgetPendingPayload {
  conversationId: number;
  sessionId: string;
  toolUseId: string;
}

// Client → Pylon: 위젯 소유권 요청
interface WidgetClaimPayload {
  sessionId: string;
}

// Pylon → Client: 위젯이 다른 클라이언트에서 실행 중
interface WidgetClaimedPayload {
  sessionId: string;
  ownerClientId: number;  // 소유자의 deviceId
}

// Pylon → Client: 위젯 완료 (전체 브로드캐스트)
interface WidgetCompletePayload {
  conversationId: number;
  sessionId: string;
  toolUseId: string;
  view: ViewNode;  // 종료 페이지
  result: unknown;
}
```

#### 3.2 기존 메시지 타입 변경

```typescript
// widget_render는 소유자에게만 전송
interface WidgetRenderPayload {
  conversationId: number;
  sessionId: string;
  toolUseId: string;
  view: ViewNode;
  assets?: Record<string, string>;
}

// widget_event는 소유자만 전송 가능
// (기존과 동일하지만, 비소유자가 보내면 무시)
```

### 4. 상태 관리

#### 4.1 Pylon 측 (WidgetManager 확장)

```typescript
interface WidgetSession {
  sessionId: string;
  conversationId: number;
  toolUseId: string;
  status: 'handshaking' | 'pending' | 'running' | 'completed' | 'error';
  ownerClientId: number | null;  // 소유자 클라이언트 deviceId
  process: ChildProcess;
  result?: unknown;
  error?: string;
}
```

#### 4.2 Pylon 측 (lastActiveClientId 추적)

```typescript
// Conversation별로 마지막 활성 클라이언트 추적
interface ConversationState {
  lastActiveClientId: number | null;
  // ... 기존 필드
}
```

- **업데이트 시점:**
  - 클라이언트가 메시지 전송 시 (`from.deviceId`)
  - 클라이언트가 대화에 포커스 시 (새 메시지 타입 필요?)

#### 4.3 Client 측 (WidgetState)

```typescript
interface WidgetState {
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  isOwner: boolean;
  view?: ViewNode;
  result?: unknown;
  error?: string;
}
```

### 5. 구현 범위

#### Phase 1: 핵심 인프라
- [ ] `core`: 새 메시지 타입 정의 (`WidgetHandshake*`, `WidgetPending`, `WidgetClaim*`, `WidgetComplete`)
- [ ] `pylon`: `lastActiveClientId` 추적 로직
- [ ] `pylon`: `WidgetManager` 소유권 관리 확장

#### Phase 2: 핸드셰이크 구현
- [ ] `pylon`: `widget_handshake` 전송 및 타임아웃 처리
- [ ] `client`: `widget_handshake` 수신 및 visibility 체크
- [ ] `client`: Intersection Observer 기반 뷰포트 체크
- [ ] `client`: `widget_handshake_ack` 응답

#### Phase 3: 소유권 관리
- [ ] `pylon`: `widget_pending` 브로드캐스트
- [ ] `pylon`: `widget_claim` 처리 (first-come-first-served)
- [ ] `pylon`: 소유자 전용 `widget_render` 전송
- [ ] `pylon`: 비소유자에게 `widget_claimed` 전송
- [ ] `client`: 실행 버튼 UI 구현
- [ ] `client`: 소유자/비소유자 상태별 렌더링

#### Phase 4: 종료 및 히스토리
- [ ] `pylon`: `widget_complete` 전체 브로드캐스트
- [ ] `pylon`: 종료 페이지 히스토리 저장
- [ ] `client`: 종료 페이지 렌더링

#### Phase 5: 에러 핸들링
- [ ] `pylon`: Pylon 재시작 시 위젯 실패 처리
- [ ] `client`: 에러 상태 렌더링

### 6. 고려사항

#### 6.1 소유자 클라이언트 연결 해제 시
- 실행 중인 위젯이 있으면?
- **결정: 옵션 A** - 위젯 강제 종료, 에러 상태로 브로드캐스트
- 이유: 구현 단순화, 상태 명확성

#### 6.2 Inline 위젯 (run_widget_inline)
- CLI 프로세스 없이 HTML/JS만 렌더링
- 현재 구조와 동일하게 브로드캐스트? 또는 소유권 적용?
- **제안:** 소유권 동일하게 적용 (이벤트 전송이 있을 수 있으므로)

#### 6.3 lastActiveClientId 결정 로직
- 마지막으로 메시지를 보낸 클라이언트?
- 마지막으로 대화에 포커스한 클라이언트?
- **제안:** 메시지 전송 기준 (단순하고 명확)

---

## 다음 단계

1. 위 설계 검토 및 피드백
2. Phase 1부터 순차 구현
3. 각 Phase 완료 후 테스트
