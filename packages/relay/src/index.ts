/**
 * @estelle/relay
 *
 * Estelle Relay 서버 - 순수 라우터
 *
 * @description
 * Relay는 클라이언트 간 메시지를 중계하는 역할만 담당합니다.
 * 메시지 내용은 해석하지 않고, 인증과 라우팅만 처리합니다.
 *
 * 설계 원칙:
 * - 순수 함수 중심: 대부분의 로직이 순수 함수로 구현되어 테스트 용이
 * - 상태 분리: 상태는 서버 어댑터에서만 관리
 * - 액션 기반: 순수 함수는 수행할 액션을 반환하고, 어댑터가 실행
 *
 * @example
 * ```typescript
 * // 서버 시작
 * import { WebSocketServer } from 'ws';
 * import { createRelayServer } from '@estelle/relay';
 *
 * const wss = new WebSocketServer({ port: 8080 });
 * const relay = createRelayServer(wss);
 * relay.start();
 * ```
 *
 * @example
 * ```typescript
 * // 순수 함수 사용 (테스트용)
 * import { authenticateDevice, routeMessage, handleMessage } from '@estelle/relay';
 *
 * // 인증 테스트
 * const authResult = authenticateDevice(1, 'pylon', '192.168.1.100');
 * expect(authResult.success).toBe(true);
 *
 * // 라우팅 테스트
 * const routeResult = routeByTo(1, clients);
 * expect(routeResult.success).toBe(true);
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// 타입
// ============================================================================
export type {
  // 디바이스 설정
  DeviceRole,
  DeviceConfig,
  DeviceInfo,

  // 클라이언트
  RelayDeviceType,
  Client,
  AuthenticatedClient,

  // 메시지
  RouteTarget,
  BroadcastOption,
  RelayMessage,
  AuthResultPayload,
  DeviceListItem,

  // 상태
  RelayState,

  // 액션
  SendAction,
  BroadcastAction,
  UpdateClientAction,
  IncrementNextClientIdAction,
  ResetNextClientIdAction,
  RelayAction,
} from './types.js';

// core에서 AuthPayload를 re-export
export type { AuthPayload } from '@estelle/core';

export { isAuthenticatedClient } from './types.js';

// ============================================================================
// 상수
// ============================================================================
export { DEVICES, DYNAMIC_DEVICE_ID_START, DEFAULT_PORT } from './constants.js';

// ============================================================================
// 유틸리티
// ============================================================================
export type { HttpRequest } from './utils.js';
export {
  log,
  getClientIp,
  getDeviceInfo,
  generateClientId,
  parseDeviceId,
} from './utils.js';

// ============================================================================
// 인증
// ============================================================================
export type { AuthResult } from './auth.js';
export {
  authenticateDevice,
  isIpAllowed,
  isDynamicDeviceId,
  isRegisteredDevice,
} from './auth.js';

// ============================================================================
// 라우팅
// ============================================================================
export type { RouteResult } from './router.js';
export {
  routeToClient,
  routeToDevice,
  routeByTo,
  broadcastAll,
  broadcastToType,
  broadcastExceptType,
  routeByBroadcast,
  routeByDefault,
  routeMessage,
  hasConnectedDeviceType,
  hasAppClients,
} from './router.js';

// ============================================================================
// 디바이스 상태
// ============================================================================
export {
  getDeviceList,
  getDeviceListByType,
  createDeviceStatusMessage,
  createClientDisconnectMessage,
  getConnectionCount,
  getAuthenticatedCount,
  getConnectionStats,
} from './device-status.js';

// ============================================================================
// 메시지 핸들러
// ============================================================================
export type { HandleResult } from './message-handler.js';
export {
  handleAuth,
  handleGetDevices,
  handlePing,
  handleRouting,
  handleMessage,
  handleDisconnect,
  handleConnection,
} from './message-handler.js';

// ============================================================================
// 정적 파일 서빙
// ============================================================================
export type { StaticServerOptions } from './static.js';
export { serveStatic, send404, createStaticHandler } from './static.js';

// ============================================================================
// 서버
// ============================================================================
export type {
  RelayServerState,
  RelayServerOptions,
  RelayServer,
} from './server.js';
export { createRelayServer, main } from './server.js';
