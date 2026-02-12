# Pylon ID 마이그레이션 계획

## 구현 목표

Pylon 패키지에서 기존 `entityId` 체계를 새 24비트 `conversationId` 체계로 마이그레이션한다.

## 구현 방향

### 핵심 변경

1. **WorkspaceStore**
   - `_pylonId: number` (4비트) → `_pylonId: PylonId` (7비트, envId+DT+deviceIndex 포함)
   - `_envId: number` 필드 제거 (pylonId에 포함)
   - `entityId` → `conversationId` 이름 변경
   - `encodeEntityIdWithEnv` → `encodeConversationId` 사용

2. **bin.ts**
   - `encodePylonId(envId, deviceIndex)` 호출하여 `PylonId` 생성
   - WorkspaceStore에 `PylonId` 전달

3. **pylon.ts 및 핸들러**
   - `entityId` → `conversationId` 이름 변경
   - 타입 변경: `EntityId` → `ConversationId`

4. **ClaudeManager**
   - `entityId` → `conversationId`

### 영향받는 파일

**핵심 (WorkspaceStore)**:
- `packages/pylon/src/stores/workspace-store.ts`
- `packages/pylon/tests/stores/workspace-store.test.ts`

**진입점**:
- `packages/pylon/src/bin.ts`

**사용처**:
- `packages/pylon/src/pylon.ts`
- `packages/pylon/src/claude/claude-manager.ts`
- `packages/pylon/src/handlers/*.ts`
- `packages/pylon/src/servers/pylon-mcp-server.ts`
- `packages/pylon/src/stores/message-store.ts`

**테스트**:
- `packages/pylon/tests/stores/workspace-store.test.ts`
- `packages/pylon/tests/pylon.test.ts`
- `packages/pylon/tests/claude/*.test.ts`

## 마이그레이션 단계

### Step 1: WorkspaceStore 변경
- `_pylonId` 타입을 `PylonId`로 변경
- `_envId` 제거 (pylonId에서 추출)
- 인코딩/디코딩 함수 교체

### Step 2: bin.ts 변경
- `encodePylonId(envId, deviceIndex)` 사용
- WorkspaceStore 생성자 시그니처 변경

### Step 3: 사용처 일괄 변경
- `entityId` → `conversationId` 이름 변경 (find & replace)
- `EntityId` → `ConversationId` 타입 변경

### Step 4: 테스트 수정
- 기존 테스트에서 entityId → conversationId
- 새 ID 인코딩 방식 반영

## 호환성

- **데이터 파일**: dev/stage는 초기화 (빅뱅), release는 Phase 6에서 마이그레이션
- **메시지 프로토콜**: entityId 필드명은 당장 유지 (Client와의 호환성), 추후 Phase 4에서 변경

## 예상 작업량

- 파일 수: ~15개
- 테스트 수정: ~50개
