# Auto Suggest — 유저 대화 입력 제안

## 개요

자동 입력 모드가 켜져 있을 때, Claude 응답이 끝나면 현재 세션을 fork해서 유저가 다음에 할 법한 대화 3가지를 제안하는 기능.

## 요구사항

| 항목 | 결정 |
|------|------|
| 동작 | 제안 칩 선택 → InputBar에 텍스트 채움 → 편집 후 전송 |
| 트리거 | Claude 응답 완료 시 자동 (모드 ON일 때) |
| 토글 | +버튼 메뉴에 on/off (마이크 모드처럼) |
| 생성 방식 | 현재 세션 fork → 제안 프롬프트 → 결과 받고 fork 폐기 |
| 개수 | 3개 |
| 레이아웃 | InputBar 위에 세로 나열 |
| 모델 | 메인 대화와 동일 |
| 로딩 | 스피너 표시 |

## 아키텍처

### 전체 흐름

```
[Claude 응답 완료]
  ↓ status → 'idle' 이벤트
[Pylon] SuggestionManager.generateSuggestions()
  ├─ forkSession: true + resume: currentSessionId
  ├─ 제안 프롬프트 전송
  ├─ 응답 파싱 → 3개 제안 텍스트 추출
  └─ fork 세션 폐기
  ↓ SUGGESTION_EVENT 메시지
[Relay] → [Client]
  ↓
[ConversationStore] suggestions 상태 업데이트
  ↓
[SuggestionChips] InputBar 위에 세로 렌더링
  ↓ 유저 탭
[InputBar] 텍스트 채움 → 유저 편집 → 전송
```

### 핵심 컴포넌트

| 위치 | 컴포넌트 | 역할 |
|------|----------|------|
| Pylon | `SuggestionManager` | fork 세션 생성, 제안 프롬프트 전송, 응답 파싱, 세션 폐기 |
| Core | `SUGGESTION_EVENT` 메시지 타입 | 제안 데이터 전달용 메시지 |
| Client Store | `conversationStore` 확장 | suggestions 배열 + loading 상태 |
| Client UI | `SuggestionChips` 컴포넌트 | InputBar 위 세로 칩 렌더링 |
| Client UI | `InputBar` +메뉴 확장 | 자동 입력 모드 토글 추가 |

## 데이터 흐름 상세

### Pylon — SuggestionManager

AgentManager의 sendMessage finally 블록에서 status === 'idle'일 때 트리거.

```
AgentManager.sendMessage() finally
  ↓ status === 'idle' && autoSuggestEnabled
SuggestionManager.generate(sessionId)
  ├─ 1. emitEvent(sessionId, { type: 'suggestion', status: 'loading' })
  ├─ 2. SDK query({
  │       prompt: 제안 프롬프트,
  │       resume: agentSessionId,
  │       forkSession: true
  │     })
  ├─ 3. 응답에서 제안 3개 파싱
  └─ 4. emitEvent(sessionId, { type: 'suggestion', status: 'ready', items: [...] })
```

### 메시지 타입 추가 (Core)

```typescript
// CLAUDE_EVENT의 서브타입으로 추가
type: 'suggestion'
payload: {
  status: 'loading' | 'ready' | 'error'
  items?: string[]  // 제안 텍스트 3개
}
```

### Client — Store 확장

```typescript
// ConversationClaudeState에 추가
suggestions: {
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: string[]
}
```

### Client — UI 흐름

```
useMessageRouter: CLAUDE_EVENT 'suggestion'
  ↓
conversationStore.setSuggestions(conversationId, payload)
  ↓
SuggestionChips 컴포넌트 리렌더
  ├─ loading → 스피너 표시
  ├─ ready → 칩 3개 세로 나열
  └─ error → 숨김
  ↓ 유저 탭
InputBar.setText(selectedText)
  ↓
suggestions → 'idle'로 초기화 (칩 숨김)
```

### 자동 입력 모드 토글

```
+버튼 메뉴 → "자동 입력" 토글
  ├─ localStorage: 'estelle:autoSuggestEnabled'
  └─ Pylon에 설정 전달
```

## 프롬프트 설계

```
You are generating suggested user inputs for a conversation.
Based on the conversation so far, suggest exactly 3 short messages
that the user would most likely want to say next.

Rules:
- Each suggestion must be concise (under 80 characters)
- Suggestions should cover different possible directions
- Write in the same language the user has been using
- Do not explain or add commentary
- Output ONLY a JSON array of 3 strings

Example output:
["첫 번째 제안", "두 번째 제안", "세 번째 제안"]
```

## 에러 핸들링

| 상황 | 처리 |
|------|------|
| fork 세션 생성 실패 | 조용히 실패 — 칩 안 보임, 로그만 남김 |
| 제안 프롬프트 응답 타임아웃 | 10초 후 스피너 숨기고 포기 |
| JSON 파싱 실패 | 재시도 1회, 그래도 실패하면 조용히 숨김 |
| 유저가 직접 입력 시작 | 칩 유지 |
| 유저가 칩을 선택 | InputBar에 텍스트 채움 + 칩 숨김 |
| 유저가 메시지를 전송 | 칩 숨김 |
| Claude가 다시 working 상태 | 칩 숨김 + 진행 중이던 제안 생성 취소 |

기본 원칙: 제안 기능은 보조적이므로, 실패해도 메인 대화에 영향을 주지 않고 조용히 처리.

## 테스팅

### Pylon 테스트

| 대상 | 테스트 내용 |
|------|-------------|
| `SuggestionManager.generate()` | fork 세션 생성 → 프롬프트 전송 → 응답 파싱 → 이벤트 emit |
| 프롬프트 응답 파싱 | 정상 JSON, 깨진 JSON, 빈 응답 등 케이스별 처리 |
| 타임아웃 | 10초 초과 시 에러 이벤트 emit |
| 트리거 조건 | autoSuggest 켜져 있을 때만 동작, 꺼져 있으면 무시 |

### Client 테스트

| 대상 | 테스트 내용 |
|------|-------------|
| `conversationStore` suggestions | setSuggestions로 상태 변경, 메시지 전송 시 초기화 |
| `SuggestionChips` | loading → 스피너, ready → 칩 3개 렌더, 탭 시 onSelect 호출 |
| `InputBar` 연동 | 칩 선택 시 텍스트 채워짐, +메뉴 토글 동작 |

### 모킹 전략

- SDK의 `query()` — mock하여 fork 세션 응답을 제어
- `emitEvent` — spy로 올바른 이벤트가 emit되는지 검증
- localStorage — 토글 상태 persist 테스트
