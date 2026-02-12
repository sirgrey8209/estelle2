/**
 * @file deviceId.ts
 * @description deviceId (deviceIndex) 관련 상수 및 유틸리티 함수
 *
 * 24비트 ID 시스템에서의 deviceIndex 범위:
 * - Pylon deviceIndex: 1~15 (0 불가)
 * - Client deviceIndex: 0~15
 *
 * @remarks
 * 새로운 ID 체계에서는 환경 내 로컬 유니크한 "deviceIndex"만 사용합니다.
 * 전역 유니크 DeviceId(7비트)는 id-system.ts에서 인코딩합니다.
 *
 * 레거시 대역 (deprecated):
 * - 1-9: pylon → 1-15: pylon
 * - 10-99: (예약) → 제거
 * - 100+: desktop → 0-15: client
 */

import type { DeviceType } from '../types/device.js';

// ============================================================================
// 새로운 상수 (24비트 ID 체계)
// ============================================================================

/** Pylon deviceIndex 최소값 (0 불가) */
export const PYLON_INDEX_MIN = 1;

/** Pylon deviceIndex 최대값 (4비트) */
export const PYLON_INDEX_MAX = 15;

/** Client deviceIndex 최소값 */
export const CLIENT_INDEX_MIN = 0;

/** Client deviceIndex 최대값 (4비트) */
export const CLIENT_INDEX_MAX = 15;

// ============================================================================
// 레거시 상수 (deprecated - 하위 호환용)
// ============================================================================

/** @deprecated PYLON_INDEX_MIN 사용 */
export const PYLON_ID_MIN = PYLON_INDEX_MIN;

/** @deprecated PYLON_INDEX_MAX 사용 (기존값 9 → 15) */
export const PYLON_ID_MAX = PYLON_INDEX_MAX;

/** @deprecated 예약 영역 제거됨 */
export const RESERVED_ID_MIN = 10;

/** @deprecated 예약 영역 제거됨 */
export const RESERVED_ID_MAX = 99;

/** @deprecated CLIENT_INDEX_MIN 사용 (기존값 100 → 0) */
export const DESKTOP_ID_MIN = CLIENT_INDEX_MIN;

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
 * 유효한 Pylon deviceIndex인지 검증합니다.
 *
 * @param index - 검증할 deviceIndex
 * @returns Pylon deviceIndex 범위(1-15) 내의 정수이면 true
 *
 * @example
 * ```typescript
 * isValidPylonIndex(1);   // true
 * isValidPylonIndex(15);  // true
 * isValidPylonIndex(0);   // false (Pylon은 0 불가)
 * isValidPylonIndex(16);  // false
 * isValidPylonIndex(1.5); // false
 * ```
 */
export function isValidPylonIndex(index: number): boolean {
  if (!isInteger(index)) {
    return false;
  }
  return index >= PYLON_INDEX_MIN && index <= PYLON_INDEX_MAX;
}

/**
 * 유효한 Client deviceIndex인지 검증합니다.
 *
 * @param index - 검증할 deviceIndex
 * @returns Client deviceIndex 범위(0-15) 내의 정수이면 true
 *
 * @example
 * ```typescript
 * isValidClientIndex(0);   // true
 * isValidClientIndex(15);  // true
 * isValidClientIndex(-1);  // false
 * isValidClientIndex(16);  // false
 * isValidClientIndex(0.5); // false
 * ```
 */
export function isValidClientIndex(index: number): boolean {
  if (!isInteger(index)) {
    return false;
  }
  return index >= CLIENT_INDEX_MIN && index <= CLIENT_INDEX_MAX;
}

// ============================================================================
// 레거시 함수 (deprecated - 하위 호환용)
// ============================================================================

/**
 * @deprecated isValidPylonIndex 사용
 * 기존: 1-9 범위 → 새로운: 1-15 범위
 */
export function isValidPylonId(id: number): boolean {
  return isValidPylonIndex(id);
}

/**
 * @deprecated isValidClientIndex 사용
 * 기존: 100+ 범위 → 새로운: 0-15 범위
 */
export function isValidDesktopId(id: number): boolean {
  return isValidClientIndex(id);
}

/**
 * @deprecated 예약 영역 제거됨 - 항상 false 반환
 */
export function isReservedId(id: number): boolean {
  // 새 체계에서는 예약 영역 없음
  return false;
}

/**
 * @deprecated 새로운 ID 체계에서는 deviceType 구분이 다름
 * deviceIndex만으로는 Pylon/Client 구분 불가 (0은 Client만 가능)
 */
export function getDeviceTypeFromId(id: number): DeviceType | null {
  if (!isInteger(id)) {
    return null;
  }

  // 0은 Client만 가능
  if (id === 0) {
    return 'desktop';
  }

  // 1-15는 둘 다 가능하므로 pylon 우선 (레거시 호환)
  if (isValidPylonIndex(id)) {
    return 'pylon';
  }

  // 16+은 유효하지 않음
  return null;
}
