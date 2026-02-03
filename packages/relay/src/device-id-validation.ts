/**
 * @file device-id-validation.ts
 * @description deviceId 대역 기반 검증 및 할당 로직
 *
 * ID 대역 규칙:
 * - 1-9: pylon (필수)
 * - 10-99: 예약
 * - 100+: desktop (자동 할당)
 */

import type { DeviceType } from '@estelle/core';
import {
  DESKTOP_ID_MIN,
  isValidPylonId,
  isValidDesktopId,
} from '@estelle/core';

// ============================================================================
// 검증 함수 (Validation Functions)
// ============================================================================

/**
 * deviceId가 deviceType에 맞는 유효한 값인지 검증합니다.
 *
 * @param deviceId - 검증할 deviceId (undefined 가능)
 * @param deviceType - 디바이스 유형
 * @returns 유효하면 true
 *
 * @example
 * ```typescript
 * validateDeviceId(1, 'pylon');       // true
 * validateDeviceId(undefined, 'pylon'); // false
 * validateDeviceId(100, 'desktop');   // true
 * validateDeviceId(undefined, 'desktop'); // true (자동 할당)
 * ```
 */
export function validateDeviceId(
  deviceId: number | undefined,
  deviceType: DeviceType
): boolean {
  if (deviceType === 'pylon') {
    // pylon은 deviceId가 필수이며, 1-9 범위여야 함
    if (deviceId === undefined) {
      return false;
    }
    return isValidPylonId(deviceId);
  }

  if (deviceType === 'desktop') {
    // desktop은 deviceId가 없으면 자동 할당 (허용)
    if (deviceId === undefined) {
      return true;
    }
    // deviceId가 있으면 100 이상이어야 함
    return isValidDesktopId(deviceId);
  }

  return false;
}

// ============================================================================
// 할당 함수 (Assignment Functions)
// ============================================================================

/**
 * deviceType에 따라 deviceId를 할당합니다.
 *
 * @param deviceType - 디바이스 유형
 * @returns 할당된 deviceId
 * @throws pylon 타입인 경우 에러
 *
 * @example
 * ```typescript
 * assignDeviceId('desktop'); // 100 (첫 번째 호출)
 * assignDeviceId('pylon');   // Error: pylon must provide deviceId
 * ```
 */
export function assignDeviceId(deviceType: DeviceType): number {
  if (deviceType === 'pylon') {
    throw new Error('pylon must provide deviceId');
  }

  // 단순 함수 - DeviceIdAssigner 사용 권장
  return DESKTOP_ID_MIN;
}

// ============================================================================
// DeviceIdAssigner 클래스
// ============================================================================

/**
 * Desktop 디바이스를 위한 ID 할당 및 관리 클래스
 *
 * @example
 * ```typescript
 * const assigner = new DeviceIdAssigner();
 * const id1 = assigner.assign('desktop'); // 100
 * const id2 = assigner.assign('desktop'); // 101
 *
 * assigner.release(id1); // 100 해제
 * assigner.release(id2); // 모두 해제 -> 자동 리셋
 *
 * const id3 = assigner.assign('desktop'); // 100 (리셋됨)
 * ```
 */
export class DeviceIdAssigner {
  private nextId: number = DESKTOP_ID_MIN;
  private assignedIds: Set<number> = new Set();

  /**
   * 디바이스에 새 ID를 할당합니다.
   *
   * @param deviceType - 디바이스 유형 (desktop만 가능)
   * @returns 할당된 ID
   * @throws pylon 타입인 경우 에러
   */
  assign(deviceType: DeviceType): number {
    if (deviceType === 'pylon') {
      throw new Error('pylon must provide deviceId');
    }

    const id = this.nextId;
    this.nextId++;
    this.assignedIds.add(id);
    return id;
  }

  /**
   * 할당된 ID를 해제합니다.
   * 모든 ID가 해제되면 자동으로 리셋됩니다.
   *
   * @param deviceId - 해제할 deviceId
   */
  release(deviceId: number): void {
    this.assignedIds.delete(deviceId);

    // 모든 ID가 해제되면 자동 리셋
    if (this.assignedIds.size === 0) {
      this.nextId = DESKTOP_ID_MIN;
    }
  }

  /**
   * nextId를 리셋합니다.
   *
   * @param startId - 시작 ID (기본값: 100)
   * @throws startId가 100 미만인 경우 에러
   */
  reset(startId: number = DESKTOP_ID_MIN): void {
    if (startId < DESKTOP_ID_MIN) {
      throw new Error(`startId must be at least ${DESKTOP_ID_MIN}`);
    }

    this.nextId = startId;
    this.assignedIds.clear();
  }

  /**
   * ID가 현재 할당되어 있는지 확인합니다.
   *
   * @param deviceId - 확인할 deviceId
   * @returns 할당되어 있으면 true
   */
  isAssigned(deviceId: number): boolean {
    return this.assignedIds.has(deviceId);
  }

  /**
   * 다음에 할당될 ID를 반환합니다.
   *
   * @returns 다음 ID
   */
  getNextId(): number {
    return this.nextId;
  }

  /**
   * 현재 할당된 ID 목록을 반환합니다.
   *
   * @returns 할당된 ID 배열 (정렬됨)
   */
  getAssignedIds(): number[] {
    return Array.from(this.assignedIds).sort((a, b) => a - b);
  }
}
