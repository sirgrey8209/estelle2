/**
 * Network 모듈
 *
 * LocalServer와 RelayClient를 내보냅니다.
 *
 * - LocalServer: Desktop App 연결용 로컬 WebSocket 서버
 * - RelayClient: Relay 서버 연결용 WebSocket 클라이언트
 *
 * @module network
 */

export {
  LocalServer,
  createLocalServer,
  DEFAULT_LOCAL_PORT,
  type LocalServerOptions,
  type LocalServerCallbacks,
} from './local-server.js';

export {
  RelayClient,
  createRelayClient,
  DEFAULT_RECONNECT_INTERVAL,
  type RelayClientOptions,
  type RelayClientCallbacks,
} from './relay-client.js';
