# Mock E2E 테스트 환경 구축 계획

## 목표
Pylon ↔ Relay ↔ Client 전체 메시지 플로우를 **소켓/외부 의존성 없이** 테스트할 수 있도록 추상화

## 현재 상황

| 컴포넌트 | 인터페이스 | Mock 구현체 | 작업 필요 |
|----------|-----------|------------|----------|
| WebSocket (Client) | ✅ `WebSocketAdapter` | ❓ 확인 필요 | 인터페이스 core로 이동 |
| WebSocket (Pylon) | ❌ 없음 | ❌ | **추상화 추가** |
| Claude SDK | ✅ `ClaudeAdapter` | ❓ 확인 필요 | Mock 구현체 작성 |
| 파일 저장 | ✅ `PersistenceAdapter` | ❓ 확인 필요 | InMemory 구현체 확인/작성 |

## 작업 내용

### 1. core에 WebSocketAdapter 인터페이스 추가
- `packages/core/src/network/websocket-adapter.ts`
- Client의 기존 인터페이스와 호환되도록 설계

```typescript
export interface WebSocketAdapter {
  onOpen: (() => void) | null;
  onClose: (() => void) | null;
  onMessage: ((data: string) => void) | null;
  onError: ((error: Error) => void) | null;
  connect(): void;
  disconnect(): void;
  send(data: string): void;
  isConnected: boolean;
}
```

### 2. Pylon RelayClient 수정
- 생성자에서 adapter factory 주입받도록 변경
- 기존 동작은 기본 WsWebSocketAdapter 사용

### 3. Client relayService 수정
- core의 공용 인터페이스 사용하도록 변경

### 4. E2E 테스트 작성
- MockWebSocketAdapter로 Pylon ↔ Client 메시지 플로우 검증
- 실제 소켓 없이 전체 로직 테스트

### 5. Mock ClaudeAdapter 작성
- `ClaudeAdapter` 인터페이스의 Mock 구현체
- 미리 정의된 응답을 반환하거나, 시나리오별 테스트 지원

```typescript
export class MockClaudeAdapter implements ClaudeAdapter {
  private responses: ClaudeMessage[] = [];

  setResponses(responses: ClaudeMessage[]): void { ... }

  async *query(options: ClaudeQueryOptions): AsyncIterable<ClaudeMessage> {
    for (const msg of this.responses) {
      yield msg;
    }
  }
}
```

### 6. InMemory PersistenceAdapter 확인/작성
- `PersistenceAdapter` 인터페이스의 InMemory 구현체
- 파일 I/O 없이 메모리에서 데이터 저장/조회

```typescript
export class InMemoryPersistence implements PersistenceAdapter {
  private workspaceData?: WorkspaceStoreData;
  private sessions = new Map<string, SessionData>();

  // ... 구현
}
```

## 예상 결과
- **테스트 속도**: 소켓/파일 I/O 제거로 대폭 향상
- **안정성**: 네트워크/파일시스템 불안정 요소 제거
- **CI**: 외부 의존성 없이 일관된 테스트

## 우선순위
1. WebSocket 추상화 (Pylon) - 핵심
2. Mock ClaudeAdapter - E2E 시나리오 테스트용
3. InMemory Persistence - 상태 저장 테스트용

---

## 작업 진행

### Phase 1: WebSocket 추상화 ✅

- [x] 1.1 core에 `WebSocketAdapter` 인터페이스 정의
- [x] 1.2 core에 `MockWebSocketAdapter` 구현
- [x] 1.3 Pylon `RelayClient`에 adapter factory 주입 방식 적용
- [x] 1.4 Client `relayService`가 core 인터페이스 사용하도록 변경
- [x] 1.5 기존 테스트 통과 확인 (1,047 tests passing)

### Phase 2: Claude Mock ✅

- [x] 2.1 `ClaudeAdapter` 인터페이스 확인 (이미 존재)
- [x] 2.2 `MockClaudeAdapter` 구현
- [x] 2.3 시나리오별 응답 설정 기능 (simple_text, tool_use, streaming, error, custom)

### Phase 3: Persistence Mock ✅

- [x] 3.1 `InMemoryPersistence` 구현
- [x] 3.2 테스트 작성 (474 tests passing)

### Phase 4: E2E Mock 테스트 ✅

- [x] 4.1 Pylon ↔ Relay ↔ Client 전체 플로우 테스트 작성
  - `packages/pylon/tests/e2e/mock-e2e.test.ts` 생성
  - MockRelayServer: 실제 Relay 서버 동작 시뮬레이션
  - MockClient: 앱 클라이언트 시뮬레이션
- [x] 4.2 주요 시나리오 검증 (12개 테스트)
  - 기본 연결: Pylon/Client 연결 및 인증
  - 메시지 플로우: workspace_list, workspace_create, conversation_select
  - 다중 연결: 2 Pylon + 3 Client 환경, 특정 대상 라우팅
  - Claude 이벤트: 세션 뷰어에게만 전달, 상태 변경 브로드캐스트
  - 연결 해제: 세션 뷰어 해제 처리
  - 영속성: InMemoryPersistence 저장 검증

### 최종 결과

- **전체 테스트**: 1,078개 (core 359 + relay 135 + pylon 486 + client 98)
- **E2E Mock 테스트**: 12개 (실제 소켓 연결 없이 전체 플로우 검증)
- **테스트 속도**: ~700ms (E2E Mock 테스트 기준)

---

*작성일: 2026-02-02*
*완료일: 2026-02-02*
