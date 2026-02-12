# PylonRegistry 구현 계획

## 구현 목표
pylonId → PylonConnection 매핑을 관리하는 클래스 신규 생성

## 구현 방향
- `PylonRegistry` 클래스 생성
- Pylon 등록 시 `pylonId, mcpHost, mcpPort, env` 저장
- `pylonId`로 연결 정보 조회
- Beacon에서 사용 (lookup 시 conversationId에서 pylonId 추출 후 조회)

## 인터페이스
```typescript
interface PylonConnection {
  pylonId: number;
  mcpHost: string;
  mcpPort: number;
  // env 제거 - pylonId에서 추출 가능 (envId = pylonId >> 5)
}

class PylonRegistry {
  set(pylonId: number, connection: PylonConnection): void;
  get(pylonId: number): PylonConnection | undefined;
  delete(pylonId: number): boolean;
  has(pylonId: number): boolean;
  getAll(): PylonConnection[];
  clear(): void;
  get size(): number;
}

// 유틸 함수 (필요 시)
function getEnvName(pylonId: number): string {
  const envId = pylonId >> 5;
  return ['release', 'stage', 'dev'][envId];
}
```

## 영향 범위
- 신규 생성: `packages/claude-beacon/src/pylon-registry.ts`
- 신규 생성: `packages/claude-beacon/tests/pylon-registry.test.ts`
