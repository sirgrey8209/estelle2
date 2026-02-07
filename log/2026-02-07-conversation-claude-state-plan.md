# Conversation Claude State 리팩토링 계획

## 구현 목표

`claudeStore`의 전역 상태를 대화(Conversation)별로 격리하여, 대화 전환 시 상태가 올바르게 유지되도록 한다.

## 현재 문제

```
claudeStore (전역)
├─ status: 'working'        ← 어떤 대화의 상태인지 모름
├─ messages: [...]          ← 현재 대화만
├─ textBuffer
├─ pendingRequests
└─ _messageCache            ← 캐시는 있지만 status는 없음
```

### 발생하는 버그
1. 대화 전환 시 Stop 버튼이 다른 대화에서 표시
2. 앱 재시작 시 응답 중인 대화에서 Stop 버튼 안 뜸
3. 워크스페이스 갔다오면 히스토리 날아감
4. StatusDot이 working으로 안 바뀜 (workspaceId 누락 - 별도 수정)

## 구현 방향

### 1. Core에 타입 정의

```typescript
// @estelle/core/types/conversation-claude.ts
export interface ConversationClaudeState {
  status: ClaudeStatus;  // 'idle' | 'working' | 'permission'
  messages: StoreMessage[];
  textBuffer: string;
  pendingRequests: PendingRequest[];
  workStartTime: number | null;
  realtimeUsage: RealtimeUsage | null;
}
```

### 2. Client에 conversationStore 생성

```typescript
// stores/conversationStore.ts
interface ConversationStoreState {
  // 대화별 Claude 상태
  states: Map<string, ConversationClaudeState>;

  // 현재 선택된 대화 ID
  currentConversationId: string | null;

  // Actions
  getState(conversationId: string): ConversationClaudeState;
  setStatus(conversationId: string, status: ClaudeStatus): void;
  addMessage(conversationId: string, message: StoreMessage): void;
  // ...
}
```

### 3. 컴포넌트 마이그레이션

```typescript
// 현재
const { status } = useClaudeStore();

// 변경 후
const { currentState } = useConversationStore();
const status = currentState?.status ?? 'idle';
```

### 4. claudeStore 제거

마이그레이션 완료 후 `claudeStore.ts` 삭제

### 5. Pylon 수정

`conversation_status` 메시지에 `workspaceId` 추가

## 영향 범위

### 수정 필요
- `packages/core/src/types/` - 새 타입 추가
- `packages/client/src/stores/` - conversationStore 생성
- `packages/client/src/components/chat/` - ChatArea, InputBar, MessageList
- `packages/client/src/components/requests/` - RequestBar
- `packages/client/src/hooks/useMessageRouter.ts` - 라우팅 로직
- `packages/pylon/src/pylon.ts` - conversation_status에 workspaceId 추가

### 신규 생성
- `packages/core/src/types/conversation-claude.ts`
- `packages/client/src/stores/conversationStore.ts`
- `packages/client/src/stores/conversationStore.test.ts`

### 삭제 예정
- `packages/client/src/stores/claudeStore.ts` (Phase 4 완료 후)
- `packages/client/src/stores/claudeStore.test.ts`

## Phase 분할

| Phase | 작업 | 완료 조건 |
|-------|------|----------|
| 1 | Core 타입 정의 | 타입 컴파일 성공 |
| 2 | conversationStore 생성 | 테스트 통과 |
| 3 | 컴포넌트 마이그레이션 | 기존 테스트 + 새 테스트 통과 |
| 4 | claudeStore 제거 | 전체 테스트 통과 |
| 5 | Pylon workspaceId 추가 | E2E 테스트 통과 |
