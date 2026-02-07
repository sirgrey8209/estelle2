# 이미지/파일 전송 수정 플랜

## 현재 상태 분석

### 구현되어 있는 부분

| 레이어 | 상태 | 파일 |
|--------|------|------|
| **Pylon - BlobHandler** | ✅ 완료 | `handlers/blob-handler.ts` |
| **Pylon - 메시지 라우팅** | ✅ 완료 | `pylon.ts` (blob_start/chunk/end 처리) |
| **Client - BlobService** | ✅ 완료 | `services/blobService.ts` |
| **Client - UploadStore** | ✅ 완료 | `stores/uploadStore.ts`, `imageUploadStore.ts` |
| **Client - UI 컴포넌트** | ✅ 완료 | `InputBar.tsx`, `ImageUploadButton.tsx` |

### 끊어진 연결 (문제점)

```
[InputBar] → attachedImage 선택
     ↓
[ChatArea.handleSend] → sendClaudeMessage(attachments: string[])
     ↓
[relaySender] → CLAUDE_SEND 메시지 전송 (attachments = URI 문자열)
     ↓
❌ 끊김: Blob 전송 로직이 호출되지 않음
```

**문제 1: Blob 전송이 시작되지 않음**
- `InputBar`에서 이미지를 첨부하면 `attachedImage`에 로컬 URI만 저장
- `handleSend`에서 `sendClaudeMessage()`에 URI를 그대로 전달
- `blobService.uploadImageBytes()`가 호출되지 않음

**문제 2: blobService와 WebSocket 미연결**
- `blobService.setSender()`가 호출되는 곳이 없음
- blob 메시지 수신 시 `blobService.handleMessage()`가 호출되지 않음

**문제 3: 업로드 완료 후 메시지 전송 로직 없음**
- 업로드가 완료되어야 실제 파일 경로를 Claude에 전달 가능
- 현재는 로컬 URI를 그대로 전달하므로 Pylon에서 인식 불가

**문제 4: 일반 파일 첨부 UI 없음**
- 현재 `accept="image/*"`로 이미지만 선택 가능
- 일반 파일(.txt, .pdf, .md 등) 첨부 메뉴 필요

---

## E2E 시나리오

### 시나리오 1: 이미지 업로드 후 메시지 전송

```
1. [사용자] + 버튼 클릭 → 이미지 선택
2. [Client] 이미지 미리보기 표시 (attachedImage 저장)
3. [사용자] 메시지 입력 후 전송 클릭
4. [Client] blobService.uploadImageBytes() 호출
5. [Client → Pylon] blob_start 전송
6. [Client → Pylon] blob_chunk × N 전송
7. [Client → Pylon] blob_end 전송
8. [Pylon] 파일 저장 → blob_upload_complete 응답
9. [Client] 업로드 완료 확인 → CLAUDE_SEND 전송 (서버 경로 포함)
10. [Pylon] Claude에 이미지 경로와 함께 메시지 전달
```

### 시나리오 2: 이미지 다운로드 (Claude 응답에 이미지 포함)

```
1. [Pylon] Claude가 이미지 생성/참조
2. [Pylon → Client] CLAUDE_MESSAGE에 attachment 정보 포함
3. [Client] ImageViewer에서 이미지 표시 시도
4. [Client] 캐시에 없으면 blobService.requestFile() 호출
5. [Client → Pylon] blob_request 전송
6. [Pylon → Client] blob_start/chunk/end 전송
7. [Client] blobService에서 수신 → 캐시 저장
8. [Client] ImageViewer에서 표시
```

### 시나리오 3: 업로드 중 UI 피드백

```
1. [Client] 업로드 시작 → UploadingBubble 표시
2. [Client] 청크 전송 중 → 진행률 업데이트
3. [Client] 업로드 완료/실패 → 상태 반영
```

---

## 수정 필요 항목

### Phase 1: WebSocket-BlobService 연결

**파일: `packages/client/src/App.tsx` 또는 WebSocket 초기화 위치**

1. WebSocket 연결 시 `blobService.setSender()` 호출
2. 메시지 수신 시 blob 타입이면 `blobService.handleMessage()` 호출

```typescript
// WebSocket 연결 후
blobService.setSender({
  send: (data) => ws.send(JSON.stringify(data))
});

// 메시지 수신 시
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // blob 관련 메시지는 blobService로 전달
  if (data.type?.startsWith('blob_')) {
    blobService.handleMessage(data);
  }

  // 기존 메시지 처리...
};
```

### Phase 2: 업로드 플로우 수정

**파일: `packages/client/src/components/chat/ChatArea.tsx`**

현재:
```typescript
const handleSend = (text, attachments) => {
  sendClaudeMessage(workspaceId, conversationId, text, attachments?.map(a => a.uri));
};
```

수정:
```typescript
const handleSend = async (text, attachments) => {
  if (attachments?.length) {
    // 1. 이미지 업로드 먼저
    for (const attachment of attachments) {
      const file = attachment.file; // File 객체 필요
      const bytes = new Uint8Array(await file.arrayBuffer());

      await blobService.uploadImageBytes({
        bytes,
        filename: attachment.fileName,
        targetDeviceId: pylonDeviceId,
        workspaceId,
        conversationId,
      });
    }

    // 2. 업로드 완료 대기 후 메시지 전송
    // (blobService.onUploadComplete 콜백에서 처리)
  } else {
    sendClaudeMessage(workspaceId, conversationId, text);
  }
};
```

### Phase 3: AttachedImage에 File 객체 포함

**파일: `packages/client/src/stores/imageUploadStore.ts`**

```typescript
export interface AttachedImage {
  id: string;
  uri: string;
  fileName: string;
  file?: File;  // ← 추가 필요
}
```

**파일: `packages/client/src/components/chat/InputBar.tsx`**

```typescript
const handleFileSelect = (e) => {
  const file = e.target.files?.[0];
  if (file) {
    setAttachedImage({
      id: `img_${Date.now()}`,
      uri: URL.createObjectURL(file),
      fileName: file.name,
      file,  // ← File 객체 저장
    });
  }
};
```

### Phase 4: 업로드 완료 → 메시지 전송 연동

**파일: `packages/client/src/hooks/useBlobUpload.ts` (신규)**

```typescript
export function useBlobUpload() {
  useEffect(() => {
    const unsubscribe = blobService.onUploadComplete((event) => {
      const { conversationId, pylonPath } = event;

      // 대기 중인 메시지가 있으면 전송
      const queuedMessage = useImageUploadStore.getState().dequeueMessage();
      if (queuedMessage !== null) {
        sendClaudeMessage(workspaceId, conversationId, queuedMessage, [pylonPath]);
      }
    });

    return unsubscribe;
  }, []);
}
```

### Phase 5: 일반 파일 첨부 UI 추가

**파일: `packages/client/src/components/chat/InputBar.tsx`**

현재:
```tsx
<input accept="image/*" ... />
```

수정:
```tsx
{/* 이미지 선택 */}
<input ref={imageInputRef} accept="image/*" ... />

{/* 일반 파일 선택 */}
<input ref={fileInputRef} accept="*/*" ... />
```

첨부 메뉴에 "파일 선택" 옵션 추가:
```tsx
<button onClick={() => fileInputRef.current?.click()}>
  <FileIcon />
  <span>파일 선택</span>
</button>
```

### Phase 6: 다운로드 플로우 연결

**파일: `packages/client/src/components/viewers/ImageViewer.tsx`**

이미지 로드 시 캐시 확인 → 없으면 `blobService.requestFile()` 호출

---

## 테스트 케이스

### Unit Tests

1. `blobService.uploadImageBytes()` - 청크 분할 및 전송
2. `blobService.handleMessage()` - blob_start/chunk/end 처리
3. `imageUploadStore` - 상태 관리

### E2E Tests

1. **이미지 업로드 성공**: 선택 → 전송 → 완료 확인
2. **업로드 중 UI**: 진행률 표시, 완료/실패 상태
3. **대용량 이미지**: 여러 청크 전송
4. **이미지 다운로드**: 메시지 내 이미지 표시

---

## 우선순위

| 순서 | 작업 | 영향도 |
|------|------|--------|
| 1 | Phase 1: WebSocket-BlobService 연결 | 핵심 |
| 2 | Phase 3: AttachedImage에 File 포함 | 필수 |
| 3 | Phase 2: 업로드 플로우 수정 | 핵심 |
| 4 | Phase 4: 업로드 완료 연동 | 핵심 |
| 5 | Phase 5: 일반 파일 첨부 UI | 필수 |
| 6 | Phase 6: 다운로드 플로우 | 부가 |

---

## 예상 작업량

- Phase 1-4: ~2-3시간
- Phase 5: ~1시간
- 테스트: ~1시간

총: 4-5시간
