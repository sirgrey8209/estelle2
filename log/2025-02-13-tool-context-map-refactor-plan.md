# ToolContextMap 리팩토링 계획

## 구현 목표
ToolContextMap에서 pylonAddress 제거하고, conversationId + raw만 저장하도록 변경

## 구현 방향
- `PylonInfo` → `ToolContext`로 이름 변경
- `pylonAddress` 필드 제거
- `conversationId`와 `raw`만 유지
- pylonId는 conversationId에서 비트 추출로 획득 (`conversationId >> 17`)

## 변경 전
```typescript
interface PylonInfo {
  pylonAddress: string;  // "2:1" - 제거
  conversationId: number;
  raw: ToolUseRaw;
}
```

## 변경 후
```typescript
interface ToolContext {
  conversationId: number;
  raw: ToolUseRaw;  // 구현 시 필요성 검토 후 불필요하면 삭제
}
```

## 검토 사항
- `raw` 필드 (ToolUseRaw) 필요성 확인
  - `id`: 이미 Map 키로 사용 중 (중복)
  - `name`, `input`: MCP 도구 실행 시 이미 알고 있음
  - 구현하면서 실제 사용처 없으면 삭제

## 영향 범위
- 수정 필요: `packages/claude-beacon/src/tool-context-map.ts`
- 수정 필요: `packages/claude-beacon/tests/tool-context-map.test.ts`
- 수정 필요: `packages/claude-beacon/src/beacon.ts` (ToolContextMap 사용부)
