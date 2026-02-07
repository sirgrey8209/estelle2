# Conversation Claude State TDD

## 상태
🟢 Phase 3 완료, Phase 4 진행 중

## 테스트 케이스

### Phase 1: Core 타입 ✅
- [x] ConversationClaudeState 타입이 올바른 필드를 가짐
- [x] 초기 상태 생성 함수 동작 (createInitialClaudeState)

### Phase 2: conversationStore ✅ (30 tests passing)
- [x] 대화별 상태 독립 관리
- [x] 대화 전환 시 상태 유지
- [x] setStatus가 해당 대화만 변경
- [x] addMessage가 해당 대화에만 추가
- [x] textBuffer 관리 (append, clear, flush)
- [x] pendingRequests 관리 (add, remove, hasPendingRequests)
- [x] realtimeUsage 관리
- [x] 대화 삭제 및 reset

### Phase 3: 컴포넌트 마이그레이션 ✅ (16 integration tests)
- [x] InputBar가 현재 대화의 status 사용
- [x] MessageList가 현재 대화의 messages 사용
- [x] RequestBar가 현재 대화의 pendingRequests 사용
- [x] WorkingIndicator가 현재 대화의 workStartTime/realtimeUsage 사용
- [x] ChatArea가 conversationStore 사용
- [x] ChatHeader가 conversationStore 사용
- [x] WorkspaceSidebar가 setCurrentConversation 호출
- [x] 대화 전환 시 UI가 올바른 상태 표시

### Phase 4: claudeStore 제거
- [ ] claudeStore import 없음
- [ ] 전체 테스트 통과

### Phase 5: Pylon workspaceId
- [ ] conversation_status에 workspaceId 포함
- [ ] Client에서 상태 업데이트 성공

## 파일
- 플랜: wip/conversation-claude-state-plan.md
- Core 타입: packages/core/src/types/conversation-claude.ts
- 스토어: packages/client/src/stores/conversationStore.ts
- 스토어 테스트: packages/client/src/stores/conversationStore.test.ts
- 통합 테스트: packages/client/src/e2e/conversation-state-integration.test.ts

## 마이그레이션된 컴포넌트
- packages/client/src/components/chat/InputBar.tsx
- packages/client/src/components/chat/MessageList.tsx
- packages/client/src/components/chat/WorkingIndicator.tsx
- packages/client/src/components/chat/ChatArea.tsx
- packages/client/src/components/chat/ChatHeader.tsx
- packages/client/src/components/requests/RequestBar.tsx
- packages/client/src/components/sidebar/WorkspaceSidebar.tsx
- packages/client/src/hooks/useMessageRouter.ts

## 재시도 횟수
- Phase 1: 0/3
- Phase 2: 0/3
- Phase 3: 0/3
- Phase 4: 0/3
- Phase 5: 0/3

## 로그
- [260207 00:45] 1-PLAN 시작, 플랜 문서 작성
- [260207 00:50] Phase 1 완료 - Core 타입 정의
- [260207 00:55] Phase 2 완료 - conversationStore 구현 (30 tests)
- [260207 01:05] Phase 3 완료 - 컴포넌트 마이그레이션 (285 tests passing, 1 known failure)
