/**
 * @file device-status.ts
 * @description 디바이스 상태 관리 함수
 *
 * 연결된 디바이스 목록 조회 및 상태 브로드캐스트를 위한 순수 함수들입니다.
 */

import type {
  Client,
  DeviceListItem,
  RelayMessage,
  DeviceConfig,
} from './types.js';
import { isAuthenticatedClient } from './types.js';
import { getDeviceInfo } from './utils.js';
import { broadcastAll } from './router.js';
import { DEVICES } from './constants.js';

// ============================================================================
// 디바이스 목록 조회
// ============================================================================

/**
 * 연결된 인증된 디바이스 목록을 조회합니다.
 *
 * @description
 * 현재 연결된 모든 인증된 클라이언트의 정보를 배열로 반환합니다.
 * 각 항목에는 deviceId, deviceType, name, icon, role, connectedAt이 포함됩니다.
 *
 * @param clients - 클라이언트 맵
 * @param devices - 디바이스 설정 맵 (기본값: DEVICES)
 * @returns 연결된 디바이스 목록
 *
 * @example
 * ```typescript
 * const devices = getDeviceList(clients);
 * // [
 * //   { deviceId: 1, deviceType: 'pylon', name: 'Device 1', icon: '🏢', role: 'office', connectedAt: '...' },
 * //   { deviceId: 100, deviceType: 'app', name: 'Client 100', icon: '📱', role: 'client', connectedAt: '...' }
 * // ]
 * ```
 */
export function getDeviceList(
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig> = DEVICES
): DeviceListItem[] {
  const deviceList: DeviceListItem[] = [];

  for (const client of clients.values()) {
    // 인증된 클라이언트만 포함
    if (!isAuthenticatedClient(client)) {
      continue;
    }

    const info = getDeviceInfo(client.deviceId, devices);

    deviceList.push({
      deviceId: client.deviceId,
      deviceType: client.deviceType,
      name: info.name,
      icon: info.icon,
      role: info.role,
      connectedAt: client.connectedAt.toISOString(),
    });
  }

  return deviceList;
}

/**
 * 특정 deviceType의 디바이스 목록만 조회합니다.
 *
 * @param clients - 클라이언트 맵
 * @param deviceType - 필터링할 deviceType
 * @param devices - 디바이스 설정 맵 (기본값: DEVICES)
 * @returns 해당 타입의 디바이스 목록
 *
 * @example
 * ```typescript
 * const pylons = getDeviceListByType(clients, 'pylon');
 * const apps = getDeviceListByType(clients, 'app');
 * ```
 */
export function getDeviceListByType(
  clients: Map<string, Client>,
  deviceType: 'pylon' | 'app',
  devices: Record<number, DeviceConfig> = DEVICES
): DeviceListItem[] {
  return getDeviceList(clients, devices).filter(
    (d) => d.deviceType === deviceType
  );
}

// ============================================================================
// 디바이스 상태 메시지 생성
// ============================================================================

/**
 * 디바이스 상태 브로드캐스트 메시지를 생성합니다.
 *
 * @description
 * device_status 타입의 메시지를 생성합니다.
 * 이 메시지는 새 클라이언트 연결/해제 시 모든 클라이언트에게 브로드캐스트됩니다.
 *
 * @param clients - 클라이언트 맵
 * @param devices - 디바이스 설정 맵 (기본값: DEVICES)
 * @returns device_status 메시지
 *
 * @example
 * ```typescript
 * const message = createDeviceStatusMessage(clients);
 * broadcast(message);
 * ```
 */
export function createDeviceStatusMessage(
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig> = DEVICES
): RelayMessage<{ devices: DeviceListItem[] }> {
  return {
    type: 'device_status',
    payload: {
      devices: getDeviceList(clients, devices),
    },
  };
}

/**
 * 클라이언트 연결 해제 알림 메시지를 생성합니다.
 *
 * @description
 * client_disconnect 타입의 메시지를 생성합니다.
 * 비-pylon 클라이언트 연결 해제 시 pylon들에게 전송됩니다.
 *
 * @param deviceId - 연결 해제된 디바이스 ID
 * @param deviceType - 연결 해제된 디바이스 타입
 * @returns client_disconnect 메시지
 *
 * @example
 * ```typescript
 * const message = createClientDisconnectMessage(105, 'app');
 * broadcastToType('pylon', message);
 * ```
 */
export function createClientDisconnectMessage(
  deviceId: number,
  deviceType: 'pylon' | 'app'
): RelayMessage<{ deviceId: number; deviceType: 'pylon' | 'app' }> {
  return {
    type: 'client_disconnect',
    payload: {
      deviceId,
      deviceType,
    },
  };
}

// ============================================================================
// 연결 수 통계
// ============================================================================

/**
 * 연결된 클라이언트 수를 반환합니다.
 *
 * @description
 * 인증 여부와 관계없이 모든 연결된 클라이언트 수를 반환합니다.
 *
 * @param clients - 클라이언트 맵
 * @returns 연결된 클라이언트 수
 *
 * @example
 * ```typescript
 * const total = getConnectionCount(clients);
 * log(`Total connections: ${total}`);
 * ```
 */
export function getConnectionCount(clients: Map<string, Client>): number {
  return clients.size;
}

/**
 * 인증된 클라이언트 수를 반환합니다.
 *
 * @param clients - 클라이언트 맵
 * @returns 인증된 클라이언트 수
 *
 * @example
 * ```typescript
 * const authenticated = getAuthenticatedCount(clients);
 * log(`Authenticated: ${authenticated}`);
 * ```
 */
export function getAuthenticatedCount(clients: Map<string, Client>): number {
  let count = 0;
  for (const client of clients.values()) {
    if (isAuthenticatedClient(client)) {
      count++;
    }
  }
  return count;
}

/**
 * deviceType별 연결 수를 반환합니다.
 *
 * @param clients - 클라이언트 맵
 * @returns deviceType별 연결 수
 *
 * @example
 * ```typescript
 * const stats = getConnectionStats(clients);
 * // { pylon: 2, app: 5, unauthenticated: 1 }
 * ```
 */
export function getConnectionStats(
  clients: Map<string, Client>
): { pylon: number; app: number; unauthenticated: number } {
  const stats = { pylon: 0, app: 0, unauthenticated: 0 };

  for (const client of clients.values()) {
    if (!isAuthenticatedClient(client)) {
      stats.unauthenticated++;
    } else if (client.deviceType === 'pylon') {
      stats.pylon++;
    } else {
      stats.app++;
    }
  }

  return stats;
}
