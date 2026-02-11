# Beacon 재접속 로직 구현 계획

## 구현 목표
Beacon 서버가 재시작되면 Pylon(ClaudeBeaconAdapter)이 자동으로 재연결하도록 구현

## 구현 방향

### 1. 재연결 옵션 추가
```typescript
interface BeaconAdapterOptions {
  // 기존 옵션...

  /** 자동 재연결 활성화 (기본: false) */
  reconnect?: boolean;

  /** 재연결 간격 (기본: 5000ms) */
  reconnectInterval?: number;

  /** 최대 재시도 횟수 (기본: Infinity) */
  maxReconnectAttempts?: number;

  /** 재연결 성공 콜백 */
  onReconnect?: () => void;

  /** 재연결 실패 콜백 (최대 시도 초과) */
  onReconnectFailed?: (attempts: number) => void;
}
```

### 2. 재연결 로직
- 연결 끊김 감지 시 `reconnectInterval` 후 재연결 시도
- 재연결 성공 시 `register` 메시지 재전송
- 재연결 중 상태: `isReconnecting: boolean`
- 최대 시도 횟수 초과 시 `onReconnectFailed` 호출

### 3. 상태 관리
- `_reconnecting: boolean` - 재연결 시도 중
- `_reconnectAttempts: number` - 현재 재시도 횟수
- `_reconnectTimer: NodeJS.Timeout | null` - 재연결 타이머

## 영향 범위
- 수정: `packages/claude-beacon/src/beacon-adapter.ts`
- 수정: `packages/claude-beacon/tests/beacon-adapter.test.ts`
