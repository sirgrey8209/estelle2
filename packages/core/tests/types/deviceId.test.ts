/**
 * @file deviceId.test.ts
 * @description deviceIndex 관련 타입 및 유틸리티 테스트
 *
 * 24비트 ID 시스템의 deviceIndex 범위:
 * - Pylon: 1~15 (deviceIndex 필수)
 * - Client: 0~15 (자동 할당)
 *
 * 레거시 함수들은 하위 호환성을 위해 유지되지만,
 * 새 체계에 맞게 동작이 변경되었습니다.
 */

import { describe, it, expect } from 'vitest';
import {
  // 새로운 함수
  isValidPylonIndex,
  isValidClientIndex,
  // 새로운 상수
  PYLON_INDEX_MIN,
  PYLON_INDEX_MAX,
  CLIENT_INDEX_MIN,
  CLIENT_INDEX_MAX,
  // 레거시 함수 (deprecated)
  isValidPylonId,
  isValidDesktopId,
  isReservedId,
  getDeviceTypeFromId,
  // 레거시 상수 (deprecated)
  PYLON_ID_MIN,
  PYLON_ID_MAX,
  DESKTOP_ID_MIN,
  RESERVED_ID_MIN,
  RESERVED_ID_MAX,
} from '../../src/utils/deviceId.js';

// ============================================================================
// 새로운 상수 테스트
// ============================================================================

describe('새로운 deviceIndex 상수', () => {
  it('Pylon deviceIndex 범위 상수가 정의되어 있어야 한다', () => {
    // Arrange & Act & Assert
    expect(PYLON_INDEX_MIN).toBe(1);
    expect(PYLON_INDEX_MAX).toBe(15);
  });

  it('Client deviceIndex 범위 상수가 정의되어 있어야 한다', () => {
    // Arrange & Act & Assert
    expect(CLIENT_INDEX_MIN).toBe(0);
    expect(CLIENT_INDEX_MAX).toBe(15);
  });
});

// ============================================================================
// isValidPylonIndex 테스트
// ============================================================================

describe('isValidPylonIndex', () => {
  it('should return true for valid pylon deviceIndex (1-15)', () => {
    // Arrange & Act & Assert
    expect(isValidPylonIndex(1)).toBe(true);
    expect(isValidPylonIndex(5)).toBe(true);
    expect(isValidPylonIndex(15)).toBe(true);
  });

  it('should return false for deviceIndex 0 (Pylon은 0 불가)', () => {
    // Arrange & Act & Assert
    expect(isValidPylonIndex(0)).toBe(false);
  });

  it('should return false for deviceIndex outside range (>15)', () => {
    // Arrange & Act & Assert
    expect(isValidPylonIndex(16)).toBe(false);
    expect(isValidPylonIndex(100)).toBe(false);
  });

  it('should return false for negative numbers', () => {
    // Arrange & Act & Assert
    expect(isValidPylonIndex(-1)).toBe(false);
    expect(isValidPylonIndex(-100)).toBe(false);
  });

  it('should return false for non-integer numbers', () => {
    // Arrange & Act & Assert
    expect(isValidPylonIndex(1.5)).toBe(false);
    expect(isValidPylonIndex(5.9)).toBe(false);
  });
});

// ============================================================================
// isValidClientIndex 테스트
// ============================================================================

describe('isValidClientIndex', () => {
  it('should return true for valid client deviceIndex (0-15)', () => {
    // Arrange & Act & Assert
    expect(isValidClientIndex(0)).toBe(true);
    expect(isValidClientIndex(5)).toBe(true);
    expect(isValidClientIndex(15)).toBe(true);
  });

  it('should return false for deviceIndex outside range (>15)', () => {
    // Arrange & Act & Assert
    expect(isValidClientIndex(16)).toBe(false);
    expect(isValidClientIndex(100)).toBe(false);
  });

  it('should return false for negative numbers', () => {
    // Arrange & Act & Assert
    expect(isValidClientIndex(-1)).toBe(false);
    expect(isValidClientIndex(-100)).toBe(false);
  });

  it('should return false for non-integer numbers', () => {
    // Arrange & Act & Assert
    expect(isValidClientIndex(0.5)).toBe(false);
    expect(isValidClientIndex(10.9)).toBe(false);
  });
});

// ============================================================================
// 레거시 상수 테스트 (deprecated - 하위 호환용)
// ============================================================================

describe('레거시 deviceId 상수 (deprecated)', () => {
  it('PYLON_ID_MIN/MAX가 새로운 값으로 매핑되어 있어야 한다', () => {
    // Arrange & Act & Assert
    // 레거시 PYLON_ID_MAX = 9 → 새로운 값 15
    expect(PYLON_ID_MIN).toBe(PYLON_INDEX_MIN); // 1
    expect(PYLON_ID_MAX).toBe(PYLON_INDEX_MAX); // 15 (기존 9에서 변경)
  });

  it('DESKTOP_ID_MIN이 새로운 값으로 매핑되어 있어야 한다', () => {
    // Arrange & Act & Assert
    // 레거시 DESKTOP_ID_MIN = 100 → 새로운 값 0
    expect(DESKTOP_ID_MIN).toBe(CLIENT_INDEX_MIN); // 0 (기존 100에서 변경)
  });

  it('예약 ID 상수가 유지되어야 한다 (deprecated)', () => {
    // Arrange & Act & Assert
    expect(RESERVED_ID_MIN).toBe(10);
    expect(RESERVED_ID_MAX).toBe(99);
  });
});

// ============================================================================
// 레거시 함수 테스트 (deprecated - 하위 호환용)
// ============================================================================

describe('isValidPylonId (deprecated)', () => {
  it('should work same as isValidPylonIndex', () => {
    // Arrange & Act & Assert
    expect(isValidPylonId(1)).toBe(true);
    expect(isValidPylonId(15)).toBe(true);
    expect(isValidPylonId(0)).toBe(false);
    expect(isValidPylonId(16)).toBe(false);
  });
});

describe('isValidDesktopId (deprecated)', () => {
  it('should work same as isValidClientIndex (0-15 범위)', () => {
    // 기존: 100+ 범위 → 새로운: 0-15 범위
    // Arrange & Act & Assert
    expect(isValidDesktopId(0)).toBe(true);
    expect(isValidDesktopId(15)).toBe(true);
    expect(isValidDesktopId(16)).toBe(false);
    expect(isValidDesktopId(100)).toBe(false); // 더 이상 유효하지 않음
  });
});

describe('isReservedId (deprecated)', () => {
  it('should always return false (예약 영역 제거됨)', () => {
    // 새 체계에서는 예약 영역 없음
    // Arrange & Act & Assert
    expect(isReservedId(10)).toBe(false);
    expect(isReservedId(50)).toBe(false);
    expect(isReservedId(99)).toBe(false);
    expect(isReservedId(1)).toBe(false);
    expect(isReservedId(100)).toBe(false);
  });
});

describe('getDeviceTypeFromId (deprecated)', () => {
  it('should return "desktop" for deviceIndex 0', () => {
    // 0은 Client만 가능
    // Arrange & Act & Assert
    expect(getDeviceTypeFromId(0)).toBe('desktop');
  });

  it('should return "pylon" for deviceIndex 1-15', () => {
    // 1-15는 둘 다 가능하지만 pylon 우선 (레거시 호환)
    // Arrange & Act & Assert
    expect(getDeviceTypeFromId(1)).toBe('pylon');
    expect(getDeviceTypeFromId(5)).toBe('pylon');
    expect(getDeviceTypeFromId(15)).toBe('pylon');
  });

  it('should return null for deviceIndex > 15', () => {
    // 16+은 유효하지 않음
    // Arrange & Act & Assert
    expect(getDeviceTypeFromId(16)).toBeNull();
    expect(getDeviceTypeFromId(100)).toBeNull();
    expect(getDeviceTypeFromId(500)).toBeNull();
  });

  it('should return null for negative numbers', () => {
    // Arrange & Act & Assert
    expect(getDeviceTypeFromId(-1)).toBeNull();
    expect(getDeviceTypeFromId(-100)).toBeNull();
  });

  it('should return null for non-integer numbers', () => {
    // Arrange & Act & Assert
    expect(getDeviceTypeFromId(1.5)).toBeNull();
    expect(getDeviceTypeFromId(0.5)).toBeNull();
  });
});
