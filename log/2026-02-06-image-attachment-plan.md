# 이미지 첨부 개선 구현 계획

## 구현 목표
이미지 업로드 시 썸네일을 생성하여 히스토리/브로드캐스트에 포함하고, Claude 프롬프트를 Read 도구 사용을 유도하는 형태로 개선한다.

## 구현 방향

### 1. 썸네일 생성 유틸리티 (신규)
- `packages/pylon/src/utils/thumbnail.ts` 생성
- `sharp` 라이브러리 사용
- 가로/세로 비율 유지, 큰 쪽 200px 리사이즈
- Base64 JPEG 출력 (용량 효율)
- 이미지가 아닌 파일은 `null` 반환

```typescript
async function generateThumbnail(
  filePath: string,
  mimeType: string
): Promise<string | null>
```

### 2. BlobHandler 수정
- `handleBlobEnd` 결과에 `mimeType` 포함 (현재 없음)
- Pylon에서 썸네일 생성 후 `blob_upload_complete`에 포함

### 3. Pylon handleBlobEndResult 수정
- 썸네일 생성 호출
- `blob_upload_complete` payload에 `thumbnail` 추가
- `pendingFiles`에 `thumbnail`, `mimeType` 저장

### 4. Pylon handleClaudeSend 수정
- 저장되는 attachments에 `thumbnail` 포함
- 브로드캐스트되는 attachments에 `thumbnail` 포함
- Claude 프롬프트 개선:
  ```
  [시스템: 아래 파일들을 Read 도구로 읽을 것]
  - ./uploads/conv-1/image.jpg

  {원본 메시지}
  ```
- 프롬프트 지시문은 히스토리에 저장 안됨 (이미 분리되어 있음)

### 5. 의존성 추가
- `sharp`: 이미지 리사이징 라이브러리

## 영향 범위

### 수정 필요
- `packages/pylon/package.json` - sharp 의존성 추가
- `packages/pylon/src/handlers/blob-handler.ts` - mimeType 반환
- `packages/pylon/src/pylon.ts` - handleBlobEndResult, handleClaudeSend

### 신규 생성
- `packages/pylon/src/utils/thumbnail.ts` - 썸네일 생성 유틸리티
- `packages/pylon/tests/utils/thumbnail.test.ts` - 테스트

## 데이터 흐름

```
[업로드 완료]
     │
     ▼
handleBlobEnd() → {path, mimeType, context}
     │
     ▼
handleBlobEndResult()
     │
     ├─ generateThumbnail(path, mimeType) → base64 or null
     │
     ├─ pendingFiles.set(fileId, {path, filename, mimeType, thumbnail})
     │
     └─ send blob_upload_complete {blobId, path, thumbnail, ...}

[메시지 전송]
     │
     ▼
handleClaudeSend()
     │
     ├─ attachments = pendingFiles에서 {path, filename, thumbnail} 가져오기
     │
     ├─ messageStore.addUserMessage(cid, message, attachments) ← 썸네일 포함
     │
     ├─ broadcast claude_event {userMessage, attachments} ← 썸네일 포함
     │
     └─ claudeManager.sendMessage(cid, promptToSend) ← "[시스템: Read로 읽을 것]" 포함
```
