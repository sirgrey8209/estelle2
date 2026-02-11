# message-cleanup 구현 계획

## 구현 목표
워크스페이스/대화 삭제 시 메시지 파일을 함께 정리하고, ID 재사용으로 인한 기존 대화 노출 문제를 해결

## 구현 방향

| 상황 | 처리 |
|------|------|
| 워크스페이스 삭제 | 내부 모든 대화의 메시지 파일 삭제 |
| 대화 삭제 | 해당 대화의 메시지 파일 삭제 |
| 대화 생성 | 해당 entityId의 메시지 파일이 있으면 클리어 |
| 워크스페이스 생성 | 초기 대화 없이 빈 conversations 배열로 생성 |

## 영향 범위
- 수정 필요:
  - `packages/pylon/src/stores/workspace-store.ts` - `createWorkspace` 수정 (초기 대화 제거)
  - `packages/pylon/src/pylon.ts` - 삭제/생성 핸들러에서 메시지 파일 정리 로직 추가
  - `packages/pylon/tests/stores/workspace-store.test.ts` - 테스트 수정
- 신규 생성: 없음 (기존 `deleteMessageSession` 메서드 활용)
