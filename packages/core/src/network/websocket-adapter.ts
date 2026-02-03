/**
 * @file websocket-adapter.ts
 * @description WebSocket 추상화 인터페이스
 *
 * Client와 Pylon 모두에서 사용할 수 있는 공통 WebSocket 어댑터 인터페이스입니다.
 * 테스트 시 MockWebSocketAdapter를 주입하여 실제 소켓 연결 없이 테스트할 수 있습니다.
 */

/**
 * WebSocket 어댑터 인터페이스
 *
 * WebSocket 연결을 추상화하여 테스트 용이성을 확보합니다.
 *
 * @example
 * ```typescript
 * // 실제 구현 (브라우저)
 * class BrowserWebSocketAdapter implements WebSocketAdapter {
 *   private ws: WebSocket | null = null;
 *   // ...
 * }
 *
 * // 실제 구현 (Node.js - ws 라이브러리)
 * class WsWebSocketAdapter implements WebSocketAdapter {
 *   private ws: WebSocket | null = null;
 *   // ...
 * }
 *
 * // Mock 구현 (테스트용)
 * class MockWebSocketAdapter implements WebSocketAdapter {
 *   // ...
 * }
 * ```
 */
export interface WebSocketAdapter {
  /**
   * 연결 성공 시 호출되는 콜백
   */
  onOpen: (() => void) | null;

  /**
   * 연결 종료 시 호출되는 콜백
   */
  onClose: (() => void) | null;

  /**
   * 메시지 수신 시 호출되는 콜백
   * @param data - 수신된 메시지 (문자열)
   */
  onMessage: ((data: string) => void) | null;

  /**
   * 에러 발생 시 호출되는 콜백
   * @param error - 발생한 에러
   */
  onError: ((error: Error) => void) | null;

  /**
   * 서버에 연결
   */
  connect(): void;

  /**
   * 연결 해제
   */
  disconnect(): void;

  /**
   * 메시지 전송
   * @param data - 전송할 메시지 (문자열)
   */
  send(data: string): void;

  /**
   * 현재 연결 상태
   */
  readonly isConnected: boolean;
}

/**
 * WebSocketAdapter 팩토리 타입
 *
 * RelayClient, RelayService 등에서 adapter를 생성할 때 사용합니다.
 */
export type WebSocketAdapterFactory = () => WebSocketAdapter;
