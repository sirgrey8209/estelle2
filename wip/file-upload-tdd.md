# 파일 업로드 연동 TDD

## 상태
✅ 완료

## 테스트 케이스

### 1. blobService.test.ts (신규)

| # | 유형 | 테스트 이름 | 상태 |
|---|------|-------------|------|
| 1 | 정상 | should set sender when setSender called | PASS |
| 2 | 정상 | should return null from uploadImageBytes when no sender configured | PASS |
| 3 | 정상 | should return blobId from uploadImageBytes when sender is configured | PASS |
| 4 | 정상 | should create transfer when blob_start received | PASS |
| 5 | 엣지 | should skip blob_start if already cached | PASS |
| 6 | 정상 | should store chunk data when blob_chunk received | PASS |
| 7 | 정상 | should call progress listeners when chunk received | PASS |
| 8 | 정상 | should complete download and combine chunks when blob_end received | PASS |
| 9 | 정상 | should complete upload and call listeners when blob_upload_complete received | PASS |
| 10 | 정상 | should store thumbnail in cache when provided | PASS |
| 11 | 정상 | should send blob_start message with correct format | PASS |
| 12 | 정상 | should send blob_chunk messages for data | PASS |
| 13 | 정상 | should send blob_end message after all chunks | PASS |
| 14 | 정상 | should include context in blob_start payload | PASS |
| 15 | 정상 | should send blob_request message | PASS |
| 16 | 엣지 | should return cached data immediately if available | PASS |
| 17 | 정상 | should unsubscribe progress listener | PASS |
| 18 | 정상 | should unsubscribe upload complete listener | PASS |
| 19 | 정상 | should unsubscribe error listener | PASS |
| 20 | 정상 | should cancel transfer | PASS |
| 21 | 정상 | should remove transfer | PASS |
| 22 | 정상 | should dispose all resources | PASS |

### 2. imageUploadStore.test.ts (신규)

| # | 유형 | 테스트 이름 | 상태 |
|---|------|-------------|------|
| 1 | 정상 | should have null attachedImage | PASS |
| 2 | 정상 | should have empty uploads | PASS |
| 3 | 정상 | should set attached image | PASS |
| 4 | 정상 | should clear attached image when null | PASS |
| 5 | 정상 | should also add to attachedImages array | PASS |
| 6 | 정상 | should store file object in attached image | PASS |
| 7 | 정상 | should store mimeType in attached image | PASS |
| 8 | 정상 | should store both file and mimeType together | PASS |
| 9 | 정상 | should work without file and mimeType (backward compatibility) | PASS |
| 10 | 정상 | should add image to array | PASS |
| 11 | 정상 | should add image with file object | PASS |
| 12 | 정상 | should remove image by id | PASS |
| 13 | 정상 | should update attachedImage when removed | PASS |
| 14 | 정상 | should clear all attached images | PASS |
| 15 | 정상 | should start upload | PASS |
| 16 | 정상 | should update progress | PASS |
| 17 | 정상 | should complete upload | PASS |
| 18 | 정상 | should fail upload | PASS |
| 19 | 정상 | should queue and dequeue message | PASS |
| 20 | 엣지 | should return null when no queued message | PASS |
| 21 | 정상 | should consume and clear recent file ids | PASS |
| 22 | 정상 | should reset all state | PASS |

### 3. file-upload-flow.test.ts (신규 - E2E)

| # | 유형 | 테스트 이름 | 상태 |
|---|------|-------------|------|
| 1 | 정상 | should call blobService.setSender when websocket connected | PASS |
| 2 | 정상 | should route blob messages to blobService.handleMessage | PASS |
| 3 | 정상 | should handle blob_upload_complete message | PASS |
| 4 | 정상 | should call blobService.uploadImageBytes when attachments present | PASS |
| 5 | 정상 | should wait for upload complete before sending message | PASS |
| 6 | 정상 | should use pylon path in sendClaudeMessage after upload | PASS |
| 7 | 정상 | should queue message while uploading | PASS |
| 8 | 정상 | should send queued message after upload complete | PASS |
| 9 | 정상 | should have file selection option in attach menu | PASS |
| 10 | 정상 | should accept all file types when file option selected | PASS |
| 11 | E2E | should complete full upload flow | PASS |
| 12 | 에러 | should handle upload error gracefully | PASS |
| 13 | 정상 | should handle multiple attachments | PASS |

## 파일
- 플랜: wip/image-transfer-fix.md
- 테스트:
  - `packages/client/src/services/blobService.test.ts` (신규)
  - `packages/client/src/stores/imageUploadStore.test.ts` (신규)
  - `packages/client/src/e2e/file-upload-flow.test.ts` (신규)
- 구현:
  - `packages/client/src/App.tsx` (수정)
  - `packages/client/src/stores/imageUploadStore.ts` (수정)
  - `packages/client/src/components/chat/InputBar.tsx` (수정)
  - `packages/client/src/components/chat/ChatArea.tsx` (수정)
  - `packages/client/src/services/blobService.ts` (버그 수정)

## 구현 필요 사항 요약

### Phase 1: WebSocket-BlobService 연결
- [x] `App.tsx`: `ws.onopen`에서 `blobService.setSender()` 호출
- [x] `App.tsx`: `handleMessage`에서 `blob_*` 타입 메시지를 `blobService.handleMessage()`로 전달

### Phase 2-3: AttachedImage 타입 확장
- [x] `imageUploadStore.ts`: `AttachedImage` 인터페이스에 `file?: File`, `mimeType?: string` 추가
- [x] `InputBar.tsx`: `handleFileSelect`에서 File 객체와 mimeType 저장

### Phase 4: ChatArea 업로드 플로우
- [x] `ChatArea.tsx`: `handleSend`에서 첨부파일 있으면 `blobService.uploadImageBytes()` 호출
- [x] `ChatArea.tsx`: 업로드 완료 대기 후 `sendClaudeMessage()` 호출

### Phase 5: 일반 파일 첨부 UI
- [x] `InputBar.tsx`: 첨부 메뉴에 "파일 선택" 옵션 추가

### Bug fix
- [x] `blobService.ts`: `calculateChecksum`에서 crypto.subtle.digest 호출 시 ArrayBuffer 생성 방식 수정

## 재시도 횟수
- 2-TEST -> 3-VERIFY: 0/3
- 4-IMPL: 1/3 (crypto 버그 수정 후 통과)

## 로그
- [260206 17:30] 1-PLAN 시작
- [260206 18:00] 2-TEST 시작
- [260206 18:30] 2-TEST 완료 - 테스트 파일 3개 작성
  - blobService.test.ts: 22개 테스트 (crypto 문제로 일부 실패)
  - imageUploadStore.test.ts: 22개 테스트 (타입 오류로 FAILING)
  - file-upload-flow.test.ts: 13개 테스트 (구현 필요로 FAILING)
- [260206 08:25] 4-IMPL 완료 (57개 테스트 통과)
  - Phase 1: App.tsx에서 blobService 연결 (setSender, handleMessage)
  - Phase 2-3: imageUploadStore에 file, mimeType 타입 추가
  - Phase 2-3: InputBar에서 File, mimeType 저장
  - Phase 4: ChatArea에서 업로드 플로우 구현
  - Phase 5: InputBar에 파일 선택 옵션 추가
  - Bug fix: blobService crypto.subtle.digest 수정
