# Beacon 등록 확장 계획

## 구현 목표
Pylon → Beacon 등록 시 pylonId, mcpHost, mcpPort를 전달하고 PylonRegistry에 저장

## 구현 방향
1. **beacon-adapter.ts** (Pylon 측)
   - `pylonAddress: "2:1"` → `pylonId: 65, mcpHost: "127.0.0.1", mcpPort: 9878`
   - pylonId 계산: `(envId << 5) | (0 << 4) | deviceIndex`

2. **beacon.ts** (Beacon 측)
   - register 핸들러에서 `PylonRegistry`에 저장
   - unregister 시 `PylonRegistry`에서 제거
   - lookup 시 `ToolContextMap` → `PylonRegistry` 조회

## 등록 메시지 변경
```typescript
// 변경 전
{ action: "register", pylonAddress: "2:1", env: "dev" }

// 변경 후
{ action: "register", pylonId: 65, mcpHost: "127.0.0.1", mcpPort: 9878, env: "dev" }
```

## lookup 응답 변경
```typescript
// 변경 전
{ success: true, pylonAddress: "2:1", conversationId: 2049, raw: {...} }

// 변경 후
{ success: true, conversationId: 2049, mcpHost: "127.0.0.1", mcpPort: 9878, raw: {...} }
```

## 영향 범위
- 수정 필요: `packages/claude-beacon/src/beacon-adapter.ts`
- 수정 필요: `packages/claude-beacon/src/beacon.ts`
- 수정 필요: `packages/claude-beacon/tests/beacon-adapter.test.ts`
- 수정 필요: `packages/claude-beacon/tests/beacon.test.ts`
