/**
 * @file mock-websocket-adapter.ts
 * @description 테스트용 Mock WebSocket 어댑터
 *
 * 실제 소켓 연결 없이 메시지 송수신을 시뮬레이션합니다.
 * E2E Mock 테스트에서 Pylon ↔ Relay ↔ Client 플로우를 검증할 때 사용합니다.
 */

import type { WebSocketAdapter } from './websocket-adapter.js';

/**
 * Mock WebSocket 어댑터
 *
 * 테스트에서 실제 WebSocket 연결 없이 메시지 플로우를 시뮬레이션합니다.
 *
 * @example
 * ```typescript
 * // 단일 어댑터 테스트
 * const adapter = new MockWebSocketAdapter();
 * adapter.onMessage = (data) => console.log('Received:', data);
 * adapter.connect();
 * adapter.simulateMessage('{"type": "test"}');
 *
 * // 양방향 연결 시뮬레이션
 * const clientAdapter = new MockWebSocketAdapter();
 * const serverAdapter = new MockWebSocketAdapter();
 * MockWebSocketAdapter.link(clientAdapter, serverAdapter);
 *
 * clientAdapter.connect();
 * serverAdapter.connect();
 *
 * clientAdapter.send('hello'); // serverAdapter.onMessage 호출
 * serverAdapter.send('world'); // clientAdapter.onMessage 호출
 * ```
 */
export class MockWebSocketAdapter implements WebSocketAdapter {
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;
  onMessage: ((data: string) => void) | null = null;
  onError: ((error: Error) => void) | null = null;

  private _isConnected = false;
  private linkedAdapter: MockWebSocketAdapter | null = null;

  /**
   * 현재 연결 상태
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * 연결 시뮬레이션
   *
   * 즉시 연결 성공으로 처리하고 onOpen 콜백을 호출합니다.
   */
  connect(): void {
    this._isConnected = true;
    // 비동기로 onOpen 호출 (실제 WebSocket 동작과 유사하게)
    queueMicrotask(() => {
      this.onOpen?.();
    });
  }

  /**
   * 연결 해제 시뮬레이션
   */
  disconnect(): void {
    this._isConnected = false;
    queueMicrotask(() => {
      this.onClose?.();
    });
  }

  /**
   * 메시지 전송
   *
   * 링크된 어댑터가 있으면 해당 어댑터의 onMessage를 호출합니다.
   *
   * @param data - 전송할 메시지
   */
  send(data: string): void {
    if (!this._isConnected) {
      throw new Error('Not connected');
    }

    // 링크된 어댑터가 있으면 메시지 전달
    if (this.linkedAdapter) {
      queueMicrotask(() => {
        this.linkedAdapter?.onMessage?.(data);
      });
    }
  }

  // ============================================================================
  // 테스트 헬퍼 메서드
  // ============================================================================

  /**
   * 외부에서 메시지 수신 시뮬레이션
   *
   * 서버로부터 메시지가 도착한 것처럼 시뮬레이션합니다.
   *
   * @param data - 수신할 메시지
   */
  simulateMessage(data: string): void {
    queueMicrotask(() => {
      this.onMessage?.(data);
    });
  }

  /**
   * 외부에서 에러 시뮬레이션
   *
   * @param error - 발생시킬 에러
   */
  simulateError(error: Error): void {
    queueMicrotask(() => {
      this.onError?.(error);
    });
  }

  /**
   * 외부에서 연결 종료 시뮬레이션
   */
  simulateClose(): void {
    this._isConnected = false;
    queueMicrotask(() => {
      this.onClose?.();
    });
  }

  /**
   * 두 어댑터를 링크하여 양방향 통신 시뮬레이션
   *
   * 한 쪽에서 send()하면 다른 쪽의 onMessage가 호출됩니다.
   *
   * @param adapter1 - 첫 번째 어댑터 (예: Client)
   * @param adapter2 - 두 번째 어댑터 (예: Server/Relay)
   */
  static link(adapter1: MockWebSocketAdapter, adapter2: MockWebSocketAdapter): void {
    adapter1.linkedAdapter = adapter2;
    adapter2.linkedAdapter = adapter1;
  }

  /**
   * 링크 해제
   */
  unlink(): void {
    if (this.linkedAdapter) {
      this.linkedAdapter.linkedAdapter = null;
      this.linkedAdapter = null;
    }
  }
}
