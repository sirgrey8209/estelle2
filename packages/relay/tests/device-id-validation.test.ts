/**
 * @file device-id-validation.test.ts
 * @description deviceId 대역 기반 검증 로직 테스트
 *
 * ID 대역 규칙:
 * - 1-9: pylon (필수)
 * - 10-99: 예약
 * - 100+: desktop (자동 할당)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateDeviceId,
  assignDeviceId,
  DeviceIdAssigner,
} from '../src/device-id-validation.js';
import type { DeviceType } from '@estelle/core';

// ============================================================================
// validateDeviceId 테스트
// ============================================================================

describe('validateDeviceId', () => {
  describe('pylon 디바이스', () => {
    it('should accept deviceId in pylon range (1-9)', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(validateDeviceId(1, deviceType)).toBe(true);
      expect(validateDeviceId(5, deviceType)).toBe(true);
      expect(validateDeviceId(9, deviceType)).toBe(true);
    });

    it('should reject pylon without deviceId', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(validateDeviceId(undefined, deviceType)).toBe(false);
    });

    it('should reject pylon with deviceId outside range', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(validateDeviceId(0, deviceType)).toBe(false);
      expect(validateDeviceId(10, deviceType)).toBe(false);
      expect(validateDeviceId(100, deviceType)).toBe(false);
    });

    it('should reject pylon with negative deviceId', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(validateDeviceId(-1, deviceType)).toBe(false);
      expect(validateDeviceId(-100, deviceType)).toBe(false);
    });

    it('should reject pylon with non-integer deviceId', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(validateDeviceId(1.5, deviceType)).toBe(false);
      expect(validateDeviceId(5.999, deviceType)).toBe(false);
    });
  });

  describe('desktop 디바이스', () => {
    it('should accept desktop with deviceId in range (100+)', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';

      // Act & Assert
      expect(validateDeviceId(100, deviceType)).toBe(true);
      expect(validateDeviceId(101, deviceType)).toBe(true);
      expect(validateDeviceId(1000, deviceType)).toBe(true);
    });

    it('should accept desktop without deviceId (auto-assign)', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';

      // Act & Assert
      expect(validateDeviceId(undefined, deviceType)).toBe(true);
    });

    it('should reject desktop with deviceId below 100', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';

      // Act & Assert
      expect(validateDeviceId(1, deviceType)).toBe(false);
      expect(validateDeviceId(50, deviceType)).toBe(false);
      expect(validateDeviceId(99, deviceType)).toBe(false);
    });

    it('should reject desktop with negative deviceId', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';

      // Act & Assert
      expect(validateDeviceId(-1, deviceType)).toBe(false);
      expect(validateDeviceId(-100, deviceType)).toBe(false);
    });

    it('should reject desktop with non-integer deviceId', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';

      // Act & Assert
      expect(validateDeviceId(100.5, deviceType)).toBe(false);
      expect(validateDeviceId(150.1, deviceType)).toBe(false);
    });
  });

  describe('엣지 케이스', () => {
    it('should reject deviceId 0 for all device types', () => {
      expect(validateDeviceId(0, 'pylon')).toBe(false);
      expect(validateDeviceId(0, 'desktop')).toBe(false);
    });

    it('should handle boundary values correctly', () => {
      // pylon 경계
      expect(validateDeviceId(1, 'pylon')).toBe(true); // 최소값
      expect(validateDeviceId(9, 'pylon')).toBe(true); // 최대값
      expect(validateDeviceId(10, 'pylon')).toBe(false); // 예약 영역 시작

      // desktop 경계
      expect(validateDeviceId(99, 'desktop')).toBe(false); // 예약 영역 끝
      expect(validateDeviceId(100, 'desktop')).toBe(true); // 최소값
    });

    it('should reject reserved range (10-99) for all device types', () => {
      expect(validateDeviceId(10, 'pylon')).toBe(false);
      expect(validateDeviceId(50, 'pylon')).toBe(false);
      expect(validateDeviceId(99, 'pylon')).toBe(false);

      expect(validateDeviceId(10, 'desktop')).toBe(false);
      expect(validateDeviceId(50, 'desktop')).toBe(false);
      expect(validateDeviceId(99, 'desktop')).toBe(false);
    });
  });
});

// ============================================================================
// assignDeviceId 테스트
// ============================================================================

describe('assignDeviceId', () => {
  describe('pylon 디바이스', () => {
    it('should throw error when pylon has no deviceId', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(() => assignDeviceId(deviceType)).toThrow(
        'pylon must provide deviceId'
      );
    });
  });

  describe('desktop 디바이스', () => {
    it('should assign 100 as first desktop ID', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';
      const assigner = new DeviceIdAssigner();

      // Act
      const id = assigner.assign(deviceType);

      // Assert
      expect(id).toBe(100);
    });

    it('should assign incremental IDs for subsequent desktops', () => {
      // Arrange
      const assigner = new DeviceIdAssigner();

      // Act
      const id1 = assigner.assign('desktop');
      const id2 = assigner.assign('desktop');
      const id3 = assigner.assign('desktop');

      // Assert
      expect(id1).toBe(100);
      expect(id2).toBe(101);
      expect(id3).toBe(102);
    });
  });
});

// ============================================================================
// DeviceIdAssigner 클래스 테스트
// ============================================================================

describe('DeviceIdAssigner', () => {
  let assigner: DeviceIdAssigner;

  beforeEach(() => {
    assigner = new DeviceIdAssigner();
  });

  describe('초기 상태', () => {
    it('should start with nextId = 100', () => {
      // Act
      const id = assigner.assign('desktop');

      // Assert
      expect(id).toBe(100);
    });
  });

  describe('ID 할당', () => {
    it('should assign sequential IDs', () => {
      // Act & Assert
      expect(assigner.assign('desktop')).toBe(100);
      expect(assigner.assign('desktop')).toBe(101);
      expect(assigner.assign('desktop')).toBe(102);
    });

    it('should throw for pylon type', () => {
      // Act & Assert
      expect(() => assigner.assign('pylon')).toThrow(
        'pylon must provide deviceId'
      );
    });
  });

  describe('ID 리셋', () => {
    it('should reset nextId to 100', () => {
      // Arrange
      assigner.assign('desktop'); // 100
      assigner.assign('desktop'); // 101
      assigner.assign('desktop'); // 102

      // Act
      assigner.reset();

      // Assert
      expect(assigner.assign('desktop')).toBe(100);
    });

    it('should reset to custom value', () => {
      // Arrange
      assigner.assign('desktop'); // 100

      // Act
      assigner.reset(105);

      // Assert
      expect(assigner.assign('desktop')).toBe(105);
    });

    it('should throw error when reset value is below 100', () => {
      // Act & Assert
      expect(() => assigner.reset(99)).toThrow();
      expect(() => assigner.reset(0)).toThrow();
      expect(() => assigner.reset(-1)).toThrow();
    });
  });

  describe('연결된 ID 추적', () => {
    it('should track assigned IDs', () => {
      // Arrange
      const id1 = assigner.assign('desktop');
      const id2 = assigner.assign('desktop');

      // Act
      assigner.release(id1);

      // Assert
      expect(assigner.isAssigned(id1)).toBe(false);
      expect(assigner.isAssigned(id2)).toBe(true);
    });

    it('should reset when all IDs are released', () => {
      // Arrange
      const id1 = assigner.assign('desktop'); // 100
      const id2 = assigner.assign('desktop'); // 101

      // Act
      assigner.release(id1);
      assigner.release(id2);

      // Assert - 모두 해제 시 자동 리셋
      expect(assigner.assign('desktop')).toBe(100);
    });

    it('should not reset if some IDs are still assigned', () => {
      // Arrange
      const id1 = assigner.assign('desktop'); // 100
      assigner.assign('desktop'); // 101

      // Act
      assigner.release(id1); // 100만 해제

      // Assert - 101이 아직 할당되어 있으므로 102 할당
      expect(assigner.assign('desktop')).toBe(102);
    });
  });

  describe('현재 상태 조회', () => {
    it('should return current nextId', () => {
      // Arrange
      assigner.assign('desktop'); // 100
      assigner.assign('desktop'); // 101

      // Act
      const nextId = assigner.getNextId();

      // Assert
      expect(nextId).toBe(102);
    });

    it('should return list of assigned IDs', () => {
      // Arrange
      assigner.assign('desktop'); // 100
      assigner.assign('desktop'); // 101

      // Act
      const assigned = assigner.getAssignedIds();

      // Assert
      expect(assigned).toEqual([100, 101]);
    });
  });
});
