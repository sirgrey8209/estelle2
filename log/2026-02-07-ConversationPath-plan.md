# ConversationPath 구현 계획

## 구현 목표
pylonId, workspaceId, conversationId 3개의 ID를 바이트 패킹으로 단일 숫자로 인코딩하여, 대화 대상을 명시적으로 지정할 수 있는 ConversationPath 시스템 구현

## 구현 방향

### 비트 레이아웃 (21비트)
```
[pylonId: 4비트][workspaceId: 7비트][conversationId: 10비트]
     1~10            1~100              1~1000
```

### 구현 내용
1. **브랜드 타입**: `ConversationPath` (일반 number와 구분)
2. **인코딩**: `encodeConversationPath(pylonId, workspaceId, conversationId) → ConversationPath`
3. **디코딩**: `decodeConversationPath(path) → { pylonId, workspaceId, conversationId }`
4. **범위 검증**: 각 ID가 유효 범위 내인지 검사, 벗어나면 에러
5. **디버깅용**: `conversationPathToString(path) → "1:5:42"` 형식

### 상수 정의
```typescript
const PYLON_ID_BITS = 4;      // 0~15 (사용: 1~10)
const WORKSPACE_ID_BITS = 7;  // 0~127 (사용: 1~100)
const CONVERSATION_ID_BITS = 10; // 0~1023 (사용: 1~1000)

const MAX_PYLON_ID = 10;
const MAX_WORKSPACE_ID = 100;
const MAX_CONVERSATION_ID = 1000;
```

## 영향 범위
- 신규 생성: `packages/core/src/utils/conversation-path.ts`
- 수정 필요: `packages/core/src/utils/index.ts` (export 추가)
- 테스트: `packages/core/tests/utils/conversation-path.test.ts`
