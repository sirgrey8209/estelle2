/**
 * @file deviceId.ts
 * @description deviceId 관련 상수 및 유틸리티 함수
 *
 * ID 대역 규칙:
 * - 1-9: pylon
 * - 10-99: (예약)
 * - 100+: desktop (자동 할당)
 */

import type { DeviceType } from '../types/device.js';

// ============================================================================
// 상수 (Constants)
// ============================================================================

/** Pylon ID 최소값 */
export const PYLON_ID_MIN = 1;

/** Pylon ID 최대값 */
export const PYLON_ID_MAX = 9;

/** 예약 ID 최소값 */
export const RESERVED_ID_MIN = 10;

/** 예약 ID 최대값 */
export const RESERVED_ID_MAX = 99;

/** Desktop ID 최소값 */
export const DESKTOP_ID_MIN = 100;

// ============================================================================
// 유틸리티 함수 (Utility Functions)
// ============================================================================

/**
 * 정수인지 확인하는 헬퍼 함수
 */
function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

/**
 * 유효한 Pylon ID인지 검증합니다.
 *
 * @param id - 검증할 ID
 * @returns Pylon ID 범위(1-9) 내의 정수이면 true
 *
 * @example
 * ```typescript
 * isValidPylonId(1);   // true
 * isValidPylonId(9);   // true
 * isValidPylonId(10);  // false
 * isValidPylonId(1.5); // false
 * ```
 */
export function isValidPylonId(id: number): boolean {
  if (!isInteger(id)) {
    return false;
  }
  return id >= PYLON_ID_MIN && id <= PYLON_ID_MAX;
}

/**
 * 유효한 Desktop ID인지 검증합니다.
 *
 * @param id - 검증할 ID
 * @returns Desktop ID 범위(100+) 내의 정수이면 true
 *
 * @example
 * ```typescript
 * isValidDesktopId(100);   // true
 * isValidDesktopId(1000);  // true
 * isValidDesktopId(99);    // false
 * isValidDesktopId(100.5); // false
 * ```
 */
export function isValidDesktopId(id: number): boolean {
  if (!isInteger(id)) {
    return false;
  }
  return id >= DESKTOP_ID_MIN;
}

/**
 * 예약된 ID인지 검증합니다.
 *
 * @param id - 검증할 ID
 * @returns 예약 ID 범위(10-99) 내의 정수이면 true
 *
 * @example
 * ```typescript
 * isReservedId(10);  // true
 * isReservedId(99);  // true
 * isReservedId(9);   // false
 * isReservedId(100); // false
 * ```
 */
export function isReservedId(id: number): boolean {
  if (!isInteger(id)) {
    return false;
  }
  return id >= RESERVED_ID_MIN && id <= RESERVED_ID_MAX;
}

/**
 * ID로부터 디바이스 타입을 추론합니다.
 *
 * @param id - 추론할 ID
 * @returns 'pylon' | 'desktop' | null (예약 또는 유효하지 않은 ID)
 *
 * @example
 * ```typescript
 * getDeviceTypeFromId(1);    // 'pylon'
 * getDeviceTypeFromId(100);  // 'desktop'
 * getDeviceTypeFromId(50);   // null (예약 ID)
 * getDeviceTypeFromId(0);    // null (유효하지 않음)
 * getDeviceTypeFromId(-1);   // null (유효하지 않음)
 * ```
 */
export function getDeviceTypeFromId(id: number): DeviceType | null {
  if (!isInteger(id)) {
    return null;
  }

  if (isValidPylonId(id)) {
    return 'pylon';
  }

  if (isValidDesktopId(id)) {
    return 'desktop';
  }

  // 예약된 ID이거나 유효하지 않은 ID (0 또는 음수)
  return null;
}
