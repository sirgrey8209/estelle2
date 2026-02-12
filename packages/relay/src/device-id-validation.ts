/**
 * @file device-id-validation.ts
 * @description deviceIndex 기반 검증 및 할당 로직
 *
 * 24비트 ID 시스템의 deviceIndex 범위:
 * - Pylon: 1~15 (deviceIndex 필수)
 * - Client: 0~15 (자동 할당, 빈 번호 재활용)
 *
 * @remarks
 * 새 체계에서 Relay는 환경 내 로컬 deviceIndex만 관리합니다.
 * 전역 유니크 DeviceId(7비트)는 Pylon에서 인코딩합니다.
 */

import type { DeviceType } from '@estelle/core';
import {
  CLIENT_INDEX_MIN,
  CLIENT_INDEX_MAX,
  isValidPylonIndex,
  isValidClientIndex,
} from '@estelle/core';

// ============================================================================
// 검증 함수 (Validation Functions)
// ============================================================================

/**
 * deviceIndex가 deviceType에 맞는 유효한 값인지 검증합니다.
 *
 * @param deviceIndex - 검증할 deviceIndex (undefined 가능)
 * @param deviceType - 디바이스 유형
 * @returns 유효하면 true
 *
 * @example
 * ```typescript
 * validateDeviceId(1, 'pylon');       // true (1~15)
 * validateDeviceId(undefined, 'pylon'); // false (필수)
 * validateDeviceId(0, 'desktop');     // true (0~15)
 * validateDeviceId(undefined, 'desktop'); // true (자동 할당)
 * ```
 */
export function validateDeviceId(
  deviceIndex: number | undefined,
  deviceType: DeviceType
): boolean {
  if (deviceType === 'pylon') {
    // pylon은 deviceIndex가 필수이며, 1-15 범위여야 함
    if (deviceIndex === undefined) {
      return false;
    }
    return isValidPylonIndex(deviceIndex);
  }

  if (deviceType === 'desktop') {
    // desktop은 deviceIndex가 없으면 자동 할당 (허용)
    if (deviceIndex === undefined) {
      return true;
    }
    // deviceIndex가 있으면 0-15 범위여야 함
    return isValidClientIndex(deviceIndex);
  }

  return false;
}

// ============================================================================
// 할당 함수 (Assignment Functions)
// ============================================================================

/**
 * deviceType에 따라 deviceIndex를 할당합니다.
 *
 * @param deviceType - 디바이스 유형
 * @returns 할당된 deviceIndex
 * @throws pylon 타입인 경우 에러
 *
 * @example
 * ```typescript
 * assignDeviceId('desktop'); // 0 (첫 번째 호출)
 * assignDeviceId('pylon');   // Error: pylon must provide deviceId
 * ```
 */
export function assignDeviceId(deviceType: DeviceType): number {
  if (deviceType === 'pylon') {
    throw new Error('pylon must provide deviceId');
  }

  // 단순 함수 - ClientIndexAllocator 사용 권장
  return CLIENT_INDEX_MIN;
}

// ============================================================================
// ClientIndexAllocator 클래스 (구 DeviceIdAssigner)
// ============================================================================

/**
 * Client 디바이스를 위한 deviceIndex 할당 및 관리 클래스
 *
 * 빈 번호 재활용 방식 (Workspace 할당과 동일):
 * - 0~15 범위에서 사용 가능한 가장 작은 번호 할당
 * - 연결 해제 시 해당 번호 재사용 가능
 *
 * @example
 * ```typescript
 * const allocator = new ClientIndexAllocator();
 * const idx1 = allocator.assign('desktop'); // 0
 * const idx2 = allocator.assign('desktop'); // 1
 *
 * allocator.release(idx1); // 0 해제
 *
 * const idx3 = allocator.assign('desktop'); // 0 (재사용)
 * ```
 */
export class ClientIndexAllocator {
  private assignedIndices: Set<number> = new Set();

  /**
   * 디바이스에 새 deviceIndex를 할당합니다.
   * 빈 번호 중 가장 작은 값을 할당합니다.
   *
   * @param deviceType - 디바이스 유형 (desktop만 가능)
   * @returns 할당된 deviceIndex (0~15)
   * @throws pylon 타입인 경우 에러
   * @throws 사용 가능한 deviceIndex가 없는 경우 에러
   */
  assign(deviceType: DeviceType): number {
    if (deviceType === 'pylon') {
      throw new Error('pylon must provide deviceId');
    }

    // 빈 번호 검색 (0부터 시작)
    for (let i = CLIENT_INDEX_MIN; i <= CLIENT_INDEX_MAX; i++) {
      if (!this.assignedIndices.has(i)) {
        this.assignedIndices.add(i);
        return i;
      }
    }

    throw new Error('No available client deviceIndex (max: 16 clients)');
  }

  /**
   * 할당된 deviceIndex를 해제합니다.
   *
   * @param deviceIndex - 해제할 deviceIndex
   */
  release(deviceIndex: number): void {
    this.assignedIndices.delete(deviceIndex);
  }

  /**
   * deviceIndex를 강제로 리셋합니다.
   * 모든 할당을 해제합니다.
   *
   * @param _startId - 무시됨 (하위 호환용)
   */
  reset(_startId?: number): void {
    this.assignedIndices.clear();
  }

  /**
   * deviceIndex가 현재 할당되어 있는지 확인합니다.
   *
   * @param deviceIndex - 확인할 deviceIndex
   * @returns 할당되어 있으면 true
   */
  isAssigned(deviceIndex: number): boolean {
    return this.assignedIndices.has(deviceIndex);
  }

  /**
   * 다음에 할당될 deviceIndex를 반환합니다.
   * (빈 번호 중 가장 작은 값)
   *
   * @returns 다음 deviceIndex
   */
  getNextId(): number {
    for (let i = CLIENT_INDEX_MIN; i <= CLIENT_INDEX_MAX; i++) {
      if (!this.assignedIndices.has(i)) {
        return i;
      }
    }
    return -1; // 모두 사용 중
  }

  /**
   * 현재 할당된 deviceIndex 목록을 반환합니다.
   *
   * @returns 할당된 deviceIndex 배열 (정렬됨)
   */
  getAssignedIds(): number[] {
    return Array.from(this.assignedIndices).sort((a, b) => a - b);
  }
}

// ============================================================================
// 레거시 별칭 (하위 호환용)
// ============================================================================

/**
 * @deprecated ClientIndexAllocator 사용
 */
export const DeviceIdAssigner = ClientIndexAllocator;
