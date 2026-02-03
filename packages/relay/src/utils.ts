/**
 * @file utils.ts
 * @description Relay 서버 유틸리티 함수
 *
 * 로깅, IP 추출, 디바이스 정보 조회 등 유틸리티 함수들입니다.
 * 모든 함수는 순수 함수로 구현되어 테스트가 용이합니다.
 */

import type { DeviceInfo, DeviceConfig } from './types.js';
import { DEVICES, DYNAMIC_DEVICE_ID_START } from './constants.js';

// ============================================================================
// 로깅
// ============================================================================

/**
 * 타임스탬프가 포함된 로그 메시지를 출력합니다.
 *
 * @description
 * ISO 8601 형식의 타임스탬프와 함께 메시지를 콘솔에 출력합니다.
 * 서버 디버깅 및 모니터링에 사용됩니다.
 *
 * @param message - 출력할 로그 메시지
 *
 * @example
 * ```typescript
 * log('Server started');
 * // [2024-01-15T10:30:00.000Z] Server started
 *
 * log(`Client connected: ${clientId}`);
 * // [2024-01-15T10:30:01.000Z] Client connected: client-123
 * ```
 */
export function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// ============================================================================
// HTTP 요청 관련
// ============================================================================

/**
 * HTTP 요청 객체 인터페이스 (클라이언트 IP 추출용)
 *
 * @description
 * WebSocket 연결 시 전달되는 HTTP 요청 객체의 타입입니다.
 * Node.js http.IncomingMessage의 일부 속성만 포함합니다.
 */
export interface HttpRequest {
  /** HTTP 헤더 */
  headers: Record<string, string | string[] | undefined>;

  /** 소켓 정보 */
  socket: {
    /** 원격 IP 주소 */
    remoteAddress?: string;
  };
}

/**
 * HTTP 요청에서 클라이언트 IP 주소를 추출합니다.
 *
 * @description
 * 프록시 환경(예: Cloudflare, Nginx)을 고려하여 IP를 추출합니다.
 * X-Forwarded-For 헤더가 있으면 가장 왼쪽(원본 클라이언트) IP를 사용하고,
 * 없으면 소켓의 remoteAddress를 사용합니다.
 *
 * @param req - HTTP 요청 객체
 * @returns 클라이언트 IP 주소 (추출 실패 시 'unknown')
 *
 * @example
 * ```typescript
 * // 직접 연결
 * const ip1 = getClientIp({ headers: {}, socket: { remoteAddress: '192.168.1.100' } });
 * // '192.168.1.100'
 *
 * // 프록시 경유
 * const ip2 = getClientIp({
 *   headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
 *   socket: { remoteAddress: '127.0.0.1' }
 * });
 * // '203.0.113.195'
 * ```
 */
export function getClientIp(req: HttpRequest): string {
  // X-Forwarded-For 헤더 확인 (프록시 환경)
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string') {
    // 쉼표로 구분된 목록에서 첫 번째(원본 클라이언트) IP 추출
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  // 직접 연결인 경우 소켓 주소 사용
  if (req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  }

  return 'unknown';
}

// ============================================================================
// 디바이스 정보 조회
// ============================================================================

/**
 * deviceId로 디바이스 정보를 조회합니다.
 *
 * @description
 * DEVICES 상수에 등록된 디바이스면 해당 정보를 반환하고,
 * 동적 디바이스(100 이상)면 기본 클라이언트 정보를 반환합니다.
 * 그 외에는 unknown 역할의 기본 정보를 반환합니다.
 *
 * @param deviceId - 조회할 디바이스 ID
 * @param devices - 디바이스 설정 맵 (기본값: DEVICES)
 * @returns 디바이스 정보 (name, icon, role)
 *
 * @example
 * ```typescript
 * // 등록된 디바이스
 * const info1 = getDeviceInfo(1);
 * // { name: 'Device 1', icon: '🏢', role: 'office' }
 *
 * // 동적 클라이언트
 * const info2 = getDeviceInfo(105);
 * // { name: 'Client 105', icon: '📱', role: 'client' }
 *
 * // 미등록 디바이스
 * const info3 = getDeviceInfo(50);
 * // { name: 'Device 50', icon: '💻', role: 'unknown' }
 * ```
 */
export function getDeviceInfo(
  deviceId: number,
  devices: Record<number, DeviceConfig> = DEVICES
): DeviceInfo {
  // 등록된 고정 디바이스 확인
  const registeredDevice = devices[deviceId];
  if (registeredDevice) {
    return {
      name: registeredDevice.name,
      icon: registeredDevice.icon,
      role: registeredDevice.role,
    };
  }

  // 동적 디바이스 (100 이상)
  if (deviceId >= DYNAMIC_DEVICE_ID_START) {
    return {
      name: `Client ${deviceId}`,
      icon: '📱',
      role: 'client',
    };
  }

  // 미등록 디바이스
  return {
    name: `Device ${deviceId}`,
    icon: '💻',
    role: 'unknown',
  };
}

// ============================================================================
// ID 생성
// ============================================================================

/**
 * 고유한 클라이언트 ID를 생성합니다.
 *
 * @description
 * WebSocket 연결을 식별하기 위한 고유 ID를 생성합니다.
 * 타임스탬프와 랜덤 문자열을 조합하여 충돌을 방지합니다.
 *
 * @returns 생성된 클라이언트 ID (예: 'client-1704067200000-a1b2c3d4e')
 *
 * @example
 * ```typescript
 * const clientId = generateClientId();
 * // 'client-1704067200000-a1b2c3d4e'
 * ```
 */
export function generateClientId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `client-${timestamp}-${random}`;
}

// ============================================================================
// deviceId 파싱
// ============================================================================

/**
 * deviceId를 숫자로 정규화합니다.
 *
 * @description
 * 문자열 또는 숫자 형태의 deviceId를 숫자로 변환합니다.
 * 변환에 실패하면 null을 반환합니다.
 *
 * @param deviceId - 변환할 deviceId (숫자 또는 문자열)
 * @returns 숫자로 변환된 deviceId, 또는 null (변환 실패 시)
 *
 * @example
 * ```typescript
 * parseDeviceId(1);      // 1
 * parseDeviceId('1');    // 1
 * parseDeviceId('abc');  // null
 * parseDeviceId(null);   // null
 * ```
 */
export function parseDeviceId(
  deviceId: number | string | null | undefined
): number | null {
  if (deviceId === null || deviceId === undefined) {
    return null;
  }

  if (typeof deviceId === 'number') {
    return deviceId;
  }

  if (typeof deviceId === 'string') {
    const parsed = parseInt(deviceId, 10);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}
