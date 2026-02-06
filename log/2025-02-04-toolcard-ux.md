# ToolCard UX 개선

## 완료된 작업

### 공통 스타일
- 어두운 배경 (`elevation.level2`)
- 상태별 보더 색상:
  - 왼쪽 보더: 진한 상태 색상
  - 나머지 보더: 연한 상태 색상 (30% opacity)
- 성공: 녹색 (`#22c55e`)
- 실패: 붉은색 (`#ef4444`)
- 진행중: 노란색 (warning)
- Collapsible 애니메이션 적용
- 펼쳐진 영역 클릭 시 닫힘

### Read 툴
- 접힌 상태: `✓ Read  filename.ext`
- 펼친 상태: 전체 경로 + 파일 내용
- system-reminder 태그 자동 제거

### Glob 툴
- 접힌 상태: `✓ Glob  *.tsx`
- 펼친 상태: 검색 경로 + 결과 파일 목록

### TodoWrite 툴
- 접힌 상태: `✓ TodoWrite  N items`
- 펼친 상태: 체크박스 스타일 리스트
  - `checkbox-marked` (초록) - completed
  - `progress-clock` (노란) - in_progress (activeForm 표시)
  - `checkbox-blank-outline` (회색) - pending
- todos가 객체 형태일 때도 지원

### Write 툴
- 접힌 상태: `✓ Write  filename.ext`
- 펼친 상태: 전체 경로 + 파일 내용 미리보기 (500자 제한)

### Edit 툴
- 접힌 상태: `✓ Edit  filename.ext`
- 펼친 상태: 전체 경로 + LCS 기반 줄 단위 diff
  - 같은 줄: 회색 (` ` prefix)
  - 삭제된 줄: 빨간색 (`-` prefix)
  - 추가된 줄: 초록색 (`+` prefix)
  - 최대 20줄 표시

### Bash 툴
- 접힌 상태: `✓ Bash  description` (없으면 command 첫 줄)
- 펼친 상태: command + 결과 (회색 박스)

### Grep 툴
- 접힌 상태: `✓ Grep  pattern`
- 펼친 상태: path + 결과 (회색 박스)

### Task 툴
- 접힌 상태: `✓ Task  description`
- 펼친 상태: `[subagent_type]` + prompt + 결과 (회색 박스)

## 추가 작업

### 유틸리티 함수 추출
- `textUtils.ts` 생성: `removeSystemReminder`, `diffLines` 함수
- `textUtils.test.ts` 테스트 작성 (13개 테스트)

### 데이터 영속성 수정
- `summarizeToolInput`에서 Edit/Write 데이터 보존
  - Edit: file_path, old_string, new_string (truncated)
  - Write: file_path, content (truncated)
- `claudeSessionId` 저장 누락 수정

### 테스트 수정
- `deviceConfigStore.test.ts`: initialState 값에 맞게 테스트 수정
- `cli.test.ts`: DEFAULT_PORT 환경변수로 테스트 포트 분리
  - 포트 충돌 문제 해결 (EADDRINUSE)

## 미완료 작업

### 스크롤 위치 유지 문제
- 별도 문서: `wip/toolcard-scroll-fix.md`

## 관련 파일
- `packages/client/src/components/chat/ToolCard.tsx`
- `packages/client/src/utils/textUtils.ts`
- `packages/client/src/utils/textUtils.test.ts`
- `packages/client/src/utils/toolInputParser.ts`
- `packages/client/src/components/common/Collapsible.tsx`
- `packages/pylon/src/stores/message-store.ts`
- `packages/relay/src/cli.ts`
- `packages/relay/src/constants.ts`
