# 메시지 타입 통합 (Core ← Pylon, Client)

## 구현 목표

Pylon과 Client에서 각각 정의하던 메시지 타입을 Core 패키지로 통합하여 타입 일관성 확보.

## 구현 방향

3단계 마이그레이션:
1. **Stage 1**: Core에 통합 타입 정의 (`StoreMessage` 등)
2. **Stage 2**: Pylon의 `message-store.ts`가 Core 타입 사용
3. **Stage 3**: Client의 `claudeStore.ts`가 Core 타입 사용

## 변경 파일

### Stage 1: Core 타입 정의
- `packages/core/src/types/store-message.ts` (신규)
- `packages/core/tests/types/store-message.test.ts` (신규)
- `packages/core/src/types/index.ts` (export 추가)

### Stage 2: Pylon 마이그레이션
- `packages/pylon/src/stores/message-store.ts` (Core 타입 import, 자체 타입 제거)
- `packages/pylon/src/stores/index.ts` (re-export 수정)
- `packages/pylon/src/pylon.ts` (필드명 수정: `duration_ms` → `durationMs`)

### Stage 3: Client 마이그레이션
- `packages/client/src/stores/claudeStore.ts` (Core 타입 import)
- `packages/client/src/components/chat/MessageList.tsx` (Core 타입 사용)

### Hotfix
- `packages/pylon/src/persistence/file-system-persistence.ts`
  - 저장 전 폴더 존재 확인 로직 추가 (런타임 삭제 대응)

## 핵심 타입

```typescript
// packages/core/src/types/store-message.ts

export type StoreMessageType =
  | 'text' | 'tool_start' | 'tool_complete' | 'error'
  | 'result' | 'aborted' | 'file_attachment' | 'user_response';

export interface BaseStoreMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: StoreMessageType;
  timestamp: number;
}

export interface ResultInfo {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export type StoreMessage =
  | UserTextMessage | AssistantTextMessage | ToolStartMessage
  | ToolCompleteMessage | ErrorMessage | ResultMessage
  | AbortedMessage | FileAttachmentMessage | UserResponseMessage;
```

## 테스트

- Core: 61개 테스트 케이스 (타입 가드 포함)
- Pylon: 기존 테스트 유지
- Client: 기존 테스트 유지

## 발견된 문제 및 해결

### 1. pylon.ts → message-store.ts 필드명 불일치
- **증상**: `Cannot read properties of undefined (reading 'durationMs')`
- **원인**: `pylon.ts`가 `duration_ms` (snake_case)로 전달, `ResultInfo`는 `durationMs` (camelCase) 기대
- **해결**: `pylon.ts`에서 camelCase로 변환하여 전달

### 2. Persistence 폴더 삭제 시 저장 실패
- **증상**: `ENOENT: no such file or directory` 에러
- **원인**: `data/messages` 폴더 삭제 후 저장 시도 시 실패
- **해결**: `saveMessageSession()`, `saveWorkspaceStore()`에서 저장 전 폴더 존재 확인 및 생성

## 교훈

1. **통합 테스트 부족**: 단위 테스트는 통과했지만, pylon.ts와 message-store.ts 간 인터페이스 테스트가 없어 런타임 에러 발생
2. **타입 안전성의 한계**: TypeScript 타입만으로는 런타임 데이터 형식 불일치를 잡을 수 없음 (Claude SDK 응답은 `unknown` 타입)

## 후속 작업

- `wip/desk-to-workspace-cleanup-stub.md`: Desk 구조 제거 및 Workspace-Conversation 구조로 정리 (별도 작업)

## 로그

- [250202 17:30] 1-PLAN 시작, 3단계 분할 결정
- [250202 21:02] Stage 1 (Core) 2-TEST 시작
- [250202 21:10] Stage 1 (Core) 5-REFACTOR 완료
- [250202 21:15] Stage 2 (Pylon) 마이그레이션 완료
- [250202 21:20] Stage 3 (Client) 마이그레이션 완료
- [250202 21:25] 런타임 에러 발견 (durationMs undefined)
- [250202 21:30] pylon.ts 필드명 수정으로 해결
- [250202 21:50] Persistence 폴더 자동 생성 로직 추가
- [250202 21:55] 작업 완료
