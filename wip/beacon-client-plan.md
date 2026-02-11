# BeaconClient 구현 계획

## 구현 목표
MCP 서버에서 BeaconServer로 toolUseId lookup 요청을 보내는 TCP 클라이언트

## 구현 방향

### 인터페이스
```typescript
interface LookupResult {
  success: true;
  pylonAddress: string;
  entityId: number;
  raw: ToolUseRaw;
} | {
  success: false;
  error: string;
}

class BeaconClient {
  static getInstance(): BeaconClient;
  static resetInstance(): void;  // 테스트용

  constructor(options?: { port?: number; timeout?: number });

  get port(): number;
  get timeout(): number;

  lookup(toolUseId: string): Promise<LookupResult>;
}
```

### 통신 프로토콜
BeaconServer와 동일한 JSON 프로토콜 사용:
- 요청: `{ "action": "lookup", "toolUseId": "toolu_xxx" }`
- 응답: `{ "success": true, "pylonAddress": "...", "entityId": 123, "raw": {...} }`

### 설계 원칙
- 싱글턴 패턴 (MCP 도구들이 공유)
- 연결 풀링 없음 (요청마다 새 연결 → 단순성)
- 타임아웃 기본 5초
- 포트: `__BEACON_PORT__` (esbuild define) 또는 환경변수 또는 기본값 9875

## 영향 범위
- 신규 생성: `packages/pylon/src/mcp/beacon-client.ts`
- 테스트: `packages/pylon/tests/mcp/beacon-client.test.ts`
