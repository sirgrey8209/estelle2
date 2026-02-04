/**
 * Network 모듈
 *
 * RelayClient를 내보냅니다.
 *
 * - RelayClient: Relay 서버 연결용 WebSocket 클라이언트
 *
 * @module network
 */

export {
  RelayClient,
  createRelayClient,
  DEFAULT_RECONNECT_INTERVAL,
  type RelayClientOptions,
  type RelayClientCallbacks,
} from './relay-client.js';
