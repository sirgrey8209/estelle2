/**
 * @file deviceId.test.ts
 * @description deviceId 관련 타입 및 유틸리티 테스트
 *
 * ID 대역 규칙:
 * - 1-9: pylon
 * - 10-99: (예약)
 * - 100+: desktop (자동 할당)
 */

import { describe, it, expect } from 'vitest';
import {
  isValidPylonId,
  isValidDesktopId,
  isReservedId,
  getDeviceTypeFromId,
  PYLON_ID_MIN,
  PYLON_ID_MAX,
  DESKTOP_ID_MIN,
  RESERVED_ID_MIN,
  RESERVED_ID_MAX,
} from '../../src/utils/deviceId.js';

describe('deviceId 상수', () => {
  it('pylon ID 범위 상수가 정의되어 있어야 한다', () => {
    // Arrange & Act & Assert
    expect(PYLON_ID_MIN).toBe(1);
    expect(PYLON_ID_MAX).toBe(9);
  });

  it('예약 ID 범위 상수가 정의되어 있어야 한다', () => {
    // Arrange & Act & Assert
    expect(RESERVED_ID_MIN).toBe(10);
    expect(RESERVED_ID_MAX).toBe(99);
  });

  it('desktop ID 최소값 상수가 정의되어 있어야 한다', () => {
    // Arrange & Act & Assert
    expect(DESKTOP_ID_MIN).toBe(100);
  });
});

describe('isValidPylonId', () => {
  it('should return true for valid pylon IDs (1-9)', () => {
    // Arrange & Act & Assert
    expect(isValidPylonId(1)).toBe(true);
    expect(isValidPylonId(5)).toBe(true);
    expect(isValidPylonId(9)).toBe(true);
  });

  it('should return false for IDs outside pylon range', () => {
    // Arrange & Act & Assert
    expect(isValidPylonId(0)).toBe(false);
    expect(isValidPylonId(10)).toBe(false);
    expect(isValidPylonId(100)).toBe(false);
  });

  it('should return false for negative numbers', () => {
    // Arrange & Act & Assert
    expect(isValidPylonId(-1)).toBe(false);
    expect(isValidPylonId(-100)).toBe(false);
  });

  it('should return false for non-integer numbers', () => {
    // Arrange & Act & Assert
    expect(isValidPylonId(1.5)).toBe(false);
    expect(isValidPylonId(5.9)).toBe(false);
  });
});

describe('isValidDesktopId', () => {
  it('should return true for valid desktop IDs (100+)', () => {
    // Arrange & Act & Assert
    expect(isValidDesktopId(100)).toBe(true);
    expect(isValidDesktopId(150)).toBe(true);
    expect(isValidDesktopId(1000)).toBe(true);
  });

  it('should return false for IDs below desktop range', () => {
    // Arrange & Act & Assert
    expect(isValidDesktopId(1)).toBe(false);
    expect(isValidDesktopId(50)).toBe(false);
    expect(isValidDesktopId(99)).toBe(false);
  });

  it('should return false for negative numbers', () => {
    // Arrange & Act & Assert
    expect(isValidDesktopId(-1)).toBe(false);
    expect(isValidDesktopId(-100)).toBe(false);
  });

  it('should return false for non-integer numbers', () => {
    // Arrange & Act & Assert
    expect(isValidDesktopId(100.5)).toBe(false);
    expect(isValidDesktopId(150.9)).toBe(false);
  });
});

describe('isReservedId', () => {
  it('should return true for reserved IDs (10-99)', () => {
    // Arrange & Act & Assert
    expect(isReservedId(10)).toBe(true);
    expect(isReservedId(50)).toBe(true);
    expect(isReservedId(99)).toBe(true);
  });

  it('should return false for IDs outside reserved range', () => {
    // Arrange & Act & Assert
    expect(isReservedId(1)).toBe(false);
    expect(isReservedId(9)).toBe(false);
    expect(isReservedId(100)).toBe(false);
  });

  it('should return false for negative numbers', () => {
    // Arrange & Act & Assert
    expect(isReservedId(-1)).toBe(false);
    expect(isReservedId(-50)).toBe(false);
  });
});

describe('getDeviceTypeFromId', () => {
  it('should return "pylon" for pylon IDs (1-9)', () => {
    // Arrange & Act & Assert
    expect(getDeviceTypeFromId(1)).toBe('pylon');
    expect(getDeviceTypeFromId(5)).toBe('pylon');
    expect(getDeviceTypeFromId(9)).toBe('pylon');
  });

  it('should return "desktop" for desktop IDs (100+)', () => {
    // Arrange & Act & Assert
    expect(getDeviceTypeFromId(100)).toBe('desktop');
    expect(getDeviceTypeFromId(500)).toBe('desktop');
    expect(getDeviceTypeFromId(1000)).toBe('desktop');
  });

  it('should return null for reserved IDs (10-99)', () => {
    // Arrange & Act & Assert
    expect(getDeviceTypeFromId(10)).toBeNull();
    expect(getDeviceTypeFromId(50)).toBeNull();
    expect(getDeviceTypeFromId(99)).toBeNull();
  });

  it('should return null for invalid IDs (0 or negative)', () => {
    // Arrange & Act & Assert
    expect(getDeviceTypeFromId(0)).toBeNull();
    expect(getDeviceTypeFromId(-1)).toBeNull();
    expect(getDeviceTypeFromId(-100)).toBeNull();
  });

  it('should return null for non-integer numbers', () => {
    // Arrange & Act & Assert
    expect(getDeviceTypeFromId(1.5)).toBeNull();
    expect(getDeviceTypeFromId(100.5)).toBeNull();
  });
});
