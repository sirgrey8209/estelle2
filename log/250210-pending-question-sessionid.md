# PendingQuestion sessionId 버그 수정

## 구현 목표

여러 대화에서 동시에 AskUserQuestion이 발생할 때, 응답이 올바른 대화로 라우팅되도록 `PendingQuestion`에 `sessionId`를 추가한다.

## 구현 방향

### 문제 분석

1. **`PendingQuestion` 인터페이스에 `sessionId` 없음**
2. **`handlePermission`에서 `sessionId` 저장 안 함**
3. **`respondQuestion`에서 `sessionId` 검증 없이 fallback** - 첫 번째 pending question을 사용하여 다른 대화의 질문에 응답이 전달됨

### 해결

1. `PendingQuestion` 인터페이스에 `sessionId: number` 필드 추가
2. `handlePermission`에서 AskUserQuestion 처리 시 sessionId 저장
3. `respondQuestion`에서 sessionId 기반 fallback 로직으로 변경
4. `stop`에서 해당 sessionId의 질문만 정리
5. `getPendingQuestionSessionIds` 메서드 추가

## 테스트 케이스

### 다중 대화 질문 응답 라우팅
1. [통과] should_route_answer_to_correct_session_when_multiple_sessions_have_pending_questions
2. [통과] should_fallback_to_same_session_question_when_toolUseId_not_found
3. [통과] should_not_resolve_other_session_question_when_toolUseId_not_found

### stop 시 sessionId별 질문 정리
4. [통과] should_only_clear_questions_for_stopped_session_when_stop_called
5. [통과] should_keep_other_session_questions_pending_after_stop

### PendingQuestion 인터페이스 확장
6. [통과] should_store_sessionId_in_pending_question

## 파일
- 테스트: packages/pylon/tests/claude/claude-manager.test.ts (PendingQuestion with sessionId 섹션)
- 구현: packages/pylon/src/claude/claude-manager.ts

## 진행 로그
- [250210 14:30] 1-PLAN 시작 - 문제 분석 완료, 구현 방향 수립
- [250210 16:38] 2-TEST 시작 - 6개 테스트 케이스 작성, 4개 실패 확인
- [250210 16:41] 3-VERIFY 통과 (테스트 실패 확인) - FIRST 원칙 충족
- [250210 16:45] 4-IMPL 완료 - 40/40 테스트 통과
- [250210 16:47] 5-REFACTOR 완료 - 코드 품질 검토, 리팩토링 불필요 판단
