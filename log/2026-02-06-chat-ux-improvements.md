# 2026-02-06 채팅 UX 개선 및 대화 관리 기능

## 작업 요약

채팅 헤더에 대화 관리 메뉴 추가, 파일 뷰어/첨부 카드 개선, 입력 UX 개선을 포함한 클라이언트 전반적 UX 개선.

## 변경 내역

### 1. 대화 이름변경 / 삭제 기능

**프로토콜 추가**
- `packages/core/src/constants/message-type.ts`: `CONVERSATION_DELETE`, `CONVERSATION_RENAME` 상수 추가
- `packages/client/src/services/relaySender.ts`: `deleteConversation()`, `renameConversation()` 함수 추가
- `packages/client/src/services/index.ts`: export 추가

**UI 구현 (ChatHeader 상단 메뉴)**
- `SessionMenuButton`: DropdownMenu에 "이름 변경" / "대화 삭제" 항목 추가, 삭제 확인 Dialog 추가
- `ChatHeader`: 이름변경 시 인라인 input으로 전환 + 확인(✓)/취소(✕) 버튼, Enter/Escape 지원
- 삭제 시 선택 해제 + 메시지 클리어 처리

### 2. workspace_list_result 수신 시 대화 리셋 버그 수정

- **원인**: `useMessageRouter.ts`에서 `workspace_list_result`를 받을 때마다 `selectConversation()`을 Pylon에 재전송 → 히스토리 재로드 → 메시지 리셋
- **수정**: `workspacesByPylon.has(pylonId)`로 첫 연결 vs 단순 갱신 구분. 첫 연결 시에만 `selectConversation` 재전송

### 3. send_file 도구명 매칭 수정

- `pylon.ts`: `toolName?.includes('send_file')` → `toolName === 'mcp__estelle-mcp__send_file'` 정확한 매칭으로 변경
- SDK 로그에서 실제 도구명 확인 후 적용

### 4. FileAttachmentCard 컴팩트화

- 기존 2줄 카드 → 한 줄 컴팩트 (`아이콘 + description/filename + 상태아이콘`)
- ToolCard와 동일한 왼쪽 정렬 (`ml-2 border-l-2`)
- description이 있으면 description 표시, 없으면 filename

### 5. FileViewer 상단바 개선

- 아이콘 크기 `text-lg` → `text-2xl`
- 레이아웃: 파일명 / description · 용량 (용량 `text-[10px]`)
- `DialogHeader`에 `pr-8` 추가로 X 버튼 탭 영역 겹침 해소
- description 파이프라인 연결: MessageList → viewerFile → FileViewer

### 6. 파일 다운로드 연결

- `MessageList`의 `file_attachment` 케이스: `console.log`만 있던 `onDownload`/`onOpen`을 실제 `handleAttachmentPress` (blobService 다운로드 → FileViewer) 에 연결

### 7. 유저 메시지 가로폭 조정

- `MessageBubble`: 유저 메시지에 `w-fit` 추가하여 컨텐츠 크기에 맞춤

### 8. 모바일 Enter 줄바꿈

- `InputBar`: `useResponsive()`로 데스크탑/모바일 분기
  - 데스크탑: Enter=전송, Shift/Ctrl+Enter=줄바꿈
  - 모바일: Enter=줄바꿈, 전송은 Send 버튼

### 9. 클립보드 붙여넣기 지원

- 클립보드 이미지 Ctrl+V → 이미지 첨부 (기존 파일 첨부와 동일 동작)
- 1KB 이상 텍스트 Ctrl+V → txt 파일 첨부로 자동 전환

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `core/src/constants/message-type.ts` | CONVERSATION_DELETE, CONVERSATION_RENAME 추가 |
| `client/src/services/relaySender.ts` | deleteConversation, renameConversation 추가 |
| `client/src/services/index.ts` | export 추가 |
| `client/src/components/common/SessionMenuButton.tsx` | 이름변경/삭제 메뉴 + 삭제 Dialog |
| `client/src/components/chat/ChatHeader.tsx` | 인라인 이름변경 UI + 삭제 핸들러 |
| `client/src/components/chat/FileAttachmentCard.tsx` | 한 줄 컴팩트 디자인 |
| `client/src/components/chat/MessageBubble.tsx` | 유저 메시지 w-fit |
| `client/src/components/chat/MessageList.tsx` | 다운로드 연결, description 전달 |
| `client/src/components/chat/InputBar.tsx` | 모바일 Enter, 클립보드 붙여넣기 |
| `client/src/components/viewers/FileViewer.tsx` | 상단바 개선, description 표시 |
| `client/src/components/sidebar/ConversationItem.tsx` | 드롭다운 메뉴 제거 (원복) |
| `client/src/components/sidebar/WorkspaceSidebar.tsx` | rename/delete 코드 제거 |
| `client/src/hooks/useMessageRouter.ts` | 첫 연결 시에만 selectConversation 재전송 |
| `pylon/src/pylon.ts` | send_file 도구명 정확한 매칭 |
