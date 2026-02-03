/**
 * @file auth.ts
 * @description Relay 서버 인증 함수
 *
 * IP 기반 디바이스 인증을 처리합니다.
 * 모든 함수는 순수 함수로 구현되어 외부 상태에 의존하지 않습니다.
 */

import type { DeviceConfig, RelayDeviceType } from './types.js';
import { DEVICES, DYNAMIC_DEVICE_ID_START } from './constants.js';

// ============================================================================
// 인증 결과 타입
// ============================================================================

/**
 * 인증 결과
 *
 * @description
 * authenticateDevice 함수의 반환 타입입니다.
 * 성공/실패 여부와 실패 시 오류 메시지를 포함합니다.
 *
 * @property success - 인증 성공 여부
 * @property error - 실패 시 오류 메시지
 */
export interface AuthResult {
  /** 인증 성공 여부 */
  success: boolean;

  /** 실패 시 오류 메시지 */
  error?: string;
}

// ============================================================================
// 인증 함수
// ============================================================================

/**
 * 디바이스 인증을 수행합니다.
 *
 * @description
 * deviceId와 클라이언트 IP를 기반으로 인증을 수행합니다.
 *
 * 인증 규칙:
 * 1. 등록된 디바이스 (DEVICES에 존재): allowedIps 검사
 *    - '*'이면 모든 IP 허용
 *    - 특정 IP 목록이면 해당 IP만 허용
 * 2. 동적 디바이스 (100 이상): 무조건 허용
 * 3. 그 외: 거부
 *
 * @param deviceId - 인증할 디바이스 ID
 * @param deviceType - 디바이스 타입 (pylon 또는 app)
 * @param ip - 클라이언트 IP 주소
 * @param devices - 디바이스 설정 맵 (기본값: DEVICES)
 * @returns 인증 결과 { success, error? }
 *
 * @example
 * ```typescript
 * // 등록된 디바이스 인증 성공
 * const result1 = authenticateDevice(1, 'pylon', '192.168.1.100');
 * // { success: true }
 *
 * // IP 불일치로 인증 실패
 * const result2 = authenticateDevice(1, 'pylon', '10.0.0.1', {
 *   1: { name: 'D1', icon: '🏢', role: 'office', allowedIps: ['192.168.1.100'] }
 * });
 * // { success: false, error: 'IP not allowed: 10.0.0.1' }
 *
 * // 동적 디바이스 인증 성공
 * const result3 = authenticateDevice(105, 'app', '10.0.0.1');
 * // { success: true }
 *
 * // 미등록 디바이스 인증 실패
 * const result4 = authenticateDevice(50, 'pylon', '192.168.1.100');
 * // { success: false, error: 'Unknown device: 50' }
 * ```
 */
export function authenticateDevice(
  deviceId: number,
  deviceType: RelayDeviceType,
  ip: string,
  devices: Record<number, DeviceConfig> = DEVICES
): AuthResult {
  // 등록된 디바이스 확인
  const device = devices[deviceId];

  if (device) {
    const allowed = device.allowedIps;

    // '*'는 모든 IP 허용
    if (allowed.includes('*') || allowed.includes(ip)) {
      return { success: true };
    }

    return { success: false, error: `IP not allowed: ${ip}` };
  }

  // 동적 디바이스 ID 허용 (100 이상)
  if (deviceId >= DYNAMIC_DEVICE_ID_START) {
    return { success: true };
  }

  // 미등록 디바이스 거부
  return { success: false, error: `Unknown device: ${deviceId}` };
}

// ============================================================================
// IP 검증 헬퍼
// ============================================================================

/**
 * 특정 디바이스에 대해 IP가 허용되는지 확인합니다.
 *
 * @description
 * 등록된 디바이스의 allowedIps 목록에 대해 IP를 검사합니다.
 * 디바이스가 등록되지 않았으면 false를 반환합니다.
 *
 * @param deviceId - 검사할 디바이스 ID
 * @param ip - 검사할 IP 주소
 * @param devices - 디바이스 설정 맵 (기본값: DEVICES)
 * @returns IP 허용 여부
 *
 * @example
 * ```typescript
 * isIpAllowed(1, '192.168.1.100');  // true ('*' 허용)
 * isIpAllowed(99, '192.168.1.100'); // false (미등록)
 * ```
 */
export function isIpAllowed(
  deviceId: number,
  ip: string,
  devices: Record<number, DeviceConfig> = DEVICES
): boolean {
  const device = devices[deviceId];

  if (!device) {
    return false;
  }

  return device.allowedIps.includes('*') || device.allowedIps.includes(ip);
}

/**
 * deviceId가 동적 범위에 속하는지 확인합니다.
 *
 * @description
 * DYNAMIC_DEVICE_ID_START(100) 이상의 ID는 동적 클라이언트용입니다.
 *
 * @param deviceId - 검사할 디바이스 ID
 * @returns 동적 디바이스 여부
 *
 * @example
 * ```typescript
 * isDynamicDeviceId(1);   // false (고정 디바이스)
 * isDynamicDeviceId(99);  // false (고정 영역)
 * isDynamicDeviceId(100); // true (동적 시작)
 * isDynamicDeviceId(105); // true (동적 클라이언트)
 * ```
 */
export function isDynamicDeviceId(deviceId: number): boolean {
  return deviceId >= DYNAMIC_DEVICE_ID_START;
}

/**
 * deviceId가 등록된 고정 디바이스인지 확인합니다.
 *
 * @description
 * DEVICES 상수에 등록된 디바이스인지 확인합니다.
 *
 * @param deviceId - 검사할 디바이스 ID
 * @param devices - 디바이스 설정 맵 (기본값: DEVICES)
 * @returns 등록된 디바이스 여부
 *
 * @example
 * ```typescript
 * isRegisteredDevice(1);   // true
 * isRegisteredDevice(2);   // true
 * isRegisteredDevice(99);  // false
 * isRegisteredDevice(100); // false
 * ```
 */
export function isRegisteredDevice(
  deviceId: number,
  devices: Record<number, DeviceConfig> = DEVICES
): boolean {
  return deviceId in devices;
}
