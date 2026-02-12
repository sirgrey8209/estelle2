/**
 * @file device-id-validation.test.ts
 * @description deviceIndex 기반 검증 로직 테스트
 *
 * 24비트 ID 시스템의 deviceIndex 범위:
 * - Pylon: 1~15 (deviceIndex 필수)
 * - Client: 0~15 (자동 할당, 빈 번호 재활용)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateDeviceId,
  assignDeviceId,
  ClientIndexAllocator,
  DeviceIdAssigner,
} from '../src/device-id-validation.js';
import type { DeviceType } from '@estelle/core';

// ============================================================================
// validateDeviceId 테스트
// ============================================================================

describe('validateDeviceId', () => {
  describe('pylon 디바이스', () => {
    it('should accept deviceIndex in pylon range (1-15)', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(validateDeviceId(1, deviceType)).toBe(true);
      expect(validateDeviceId(5, deviceType)).toBe(true);
      expect(validateDeviceId(15, deviceType)).toBe(true);
    });

    it('should reject pylon without deviceIndex', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(validateDeviceId(undefined, deviceType)).toBe(false);
    });

    it('should reject pylon with deviceIndex 0', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert - Pylon은 0 불가
      expect(validateDeviceId(0, deviceType)).toBe(false);
    });

    it('should reject pylon with deviceIndex outside range (>15)', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(validateDeviceId(16, deviceType)).toBe(false);
      expect(validateDeviceId(100, deviceType)).toBe(false);
    });

    it('should reject pylon with negative deviceIndex', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(validateDeviceId(-1, deviceType)).toBe(false);
      expect(validateDeviceId(-100, deviceType)).toBe(false);
    });

    it('should reject pylon with non-integer deviceIndex', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(validateDeviceId(1.5, deviceType)).toBe(false);
      expect(validateDeviceId(5.999, deviceType)).toBe(false);
    });
  });

  describe('desktop 디바이스', () => {
    it('should accept desktop with deviceIndex in range (0-15)', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';

      // Act & Assert
      expect(validateDeviceId(0, deviceType)).toBe(true);
      expect(validateDeviceId(1, deviceType)).toBe(true);
      expect(validateDeviceId(15, deviceType)).toBe(true);
    });

    it('should accept desktop without deviceIndex (auto-assign)', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';

      // Act & Assert
      expect(validateDeviceId(undefined, deviceType)).toBe(true);
    });

    it('should reject desktop with deviceIndex above 15', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';

      // Act & Assert
      expect(validateDeviceId(16, deviceType)).toBe(false);
      expect(validateDeviceId(100, deviceType)).toBe(false);
    });

    it('should reject desktop with negative deviceIndex', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';

      // Act & Assert
      expect(validateDeviceId(-1, deviceType)).toBe(false);
      expect(validateDeviceId(-100, deviceType)).toBe(false);
    });

    it('should reject desktop with non-integer deviceIndex', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';

      // Act & Assert
      expect(validateDeviceId(0.5, deviceType)).toBe(false);
      expect(validateDeviceId(10.1, deviceType)).toBe(false);
    });
  });

  describe('엣지 케이스', () => {
    it('should handle deviceIndex 0 correctly', () => {
      // 0은 Client만 가능, Pylon은 불가
      expect(validateDeviceId(0, 'pylon')).toBe(false);
      expect(validateDeviceId(0, 'desktop')).toBe(true);
    });

    it('should handle boundary values correctly', () => {
      // pylon 경계
      expect(validateDeviceId(1, 'pylon')).toBe(true); // 최소값
      expect(validateDeviceId(15, 'pylon')).toBe(true); // 최대값
      expect(validateDeviceId(16, 'pylon')).toBe(false); // 범위 초과

      // desktop 경계
      expect(validateDeviceId(0, 'desktop')).toBe(true); // 최소값
      expect(validateDeviceId(15, 'desktop')).toBe(true); // 최대값
      expect(validateDeviceId(16, 'desktop')).toBe(false); // 범위 초과
    });
  });
});

// ============================================================================
// assignDeviceId 테스트
// ============================================================================

describe('assignDeviceId', () => {
  describe('pylon 디바이스', () => {
    it('should throw error when pylon has no deviceIndex', () => {
      // Arrange
      const deviceType: DeviceType = 'pylon';

      // Act & Assert
      expect(() => assignDeviceId(deviceType)).toThrow(
        'pylon must provide deviceId'
      );
    });
  });

  describe('desktop 디바이스', () => {
    it('should assign 0 as first desktop deviceIndex', () => {
      // Arrange
      const deviceType: DeviceType = 'desktop';
      const allocator = new ClientIndexAllocator();

      // Act
      const idx = allocator.assign(deviceType);

      // Assert
      expect(idx).toBe(0);
    });

    it('should assign sequential deviceIndices for subsequent desktops', () => {
      // Arrange
      const allocator = new ClientIndexAllocator();

      // Act
      const idx1 = allocator.assign('desktop');
      const idx2 = allocator.assign('desktop');
      const idx3 = allocator.assign('desktop');

      // Assert
      expect(idx1).toBe(0);
      expect(idx2).toBe(1);
      expect(idx3).toBe(2);
    });
  });
});

// ============================================================================
// ClientIndexAllocator 클래스 테스트
// ============================================================================

describe('ClientIndexAllocator', () => {
  let allocator: ClientIndexAllocator;

  beforeEach(() => {
    allocator = new ClientIndexAllocator();
  });

  describe('초기 상태', () => {
    it('should start with nextId = 0', () => {
      // Act
      const idx = allocator.assign('desktop');

      // Assert
      expect(idx).toBe(0);
    });
  });

  describe('deviceIndex 할당', () => {
    it('should assign sequential deviceIndices', () => {
      // Act & Assert
      expect(allocator.assign('desktop')).toBe(0);
      expect(allocator.assign('desktop')).toBe(1);
      expect(allocator.assign('desktop')).toBe(2);
    });

    it('should throw for pylon type', () => {
      // Act & Assert
      expect(() => allocator.assign('pylon')).toThrow(
        'pylon must provide deviceId'
      );
    });

    it('should throw when all deviceIndices are used', () => {
      // Arrange - 모든 deviceIndex 할당 (0~15 = 16개)
      for (let i = 0; i < 16; i++) {
        allocator.assign('desktop');
      }

      // Act & Assert
      expect(() => allocator.assign('desktop')).toThrow(
        'No available client deviceIndex (max: 16 clients)'
      );
    });
  });

  describe('deviceIndex 리셋', () => {
    it('should reset all assignments', () => {
      // Arrange
      allocator.assign('desktop'); // 0
      allocator.assign('desktop'); // 1
      allocator.assign('desktop'); // 2

      // Act
      allocator.reset();

      // Assert
      expect(allocator.assign('desktop')).toBe(0);
    });
  });

  describe('빈 번호 재활용', () => {
    it('should reuse released deviceIndex', () => {
      // Arrange
      const idx1 = allocator.assign('desktop'); // 0
      allocator.assign('desktop'); // 1

      // Act
      allocator.release(idx1); // 0 해제

      // Assert - 빈 번호 중 가장 작은 0 재사용
      expect(allocator.assign('desktop')).toBe(0);
    });

    it('should find smallest available deviceIndex', () => {
      // Arrange
      allocator.assign('desktop'); // 0
      const idx2 = allocator.assign('desktop'); // 1
      allocator.assign('desktop'); // 2
      const idx4 = allocator.assign('desktop'); // 3

      // Act - 1, 3 해제
      allocator.release(idx2);
      allocator.release(idx4);

      // Assert - 가장 작은 1 먼저
      expect(allocator.assign('desktop')).toBe(1);
      expect(allocator.assign('desktop')).toBe(3);
      expect(allocator.assign('desktop')).toBe(4);
    });

    it('should track assigned deviceIndices', () => {
      // Arrange
      const idx1 = allocator.assign('desktop');
      const idx2 = allocator.assign('desktop');

      // Act
      allocator.release(idx1);

      // Assert
      expect(allocator.isAssigned(idx1)).toBe(false);
      expect(allocator.isAssigned(idx2)).toBe(true);
    });
  });

  describe('현재 상태 조회', () => {
    it('should return next available deviceIndex', () => {
      // Arrange
      allocator.assign('desktop'); // 0
      allocator.assign('desktop'); // 1

      // Act
      const nextIdx = allocator.getNextId();

      // Assert
      expect(nextIdx).toBe(2);
    });

    it('should return -1 when all deviceIndices are used', () => {
      // Arrange - 모든 deviceIndex 할당
      for (let i = 0; i < 16; i++) {
        allocator.assign('desktop');
      }

      // Act
      const nextIdx = allocator.getNextId();

      // Assert
      expect(nextIdx).toBe(-1);
    });

    it('should return list of assigned deviceIndices', () => {
      // Arrange
      allocator.assign('desktop'); // 0
      allocator.assign('desktop'); // 1

      // Act
      const assigned = allocator.getAssignedIds();

      // Assert
      expect(assigned).toEqual([0, 1]);
    });

    it('should return correct next after release', () => {
      // Arrange
      const idx1 = allocator.assign('desktop'); // 0
      allocator.assign('desktop'); // 1
      allocator.release(idx1); // 0 해제

      // Act
      const nextIdx = allocator.getNextId();

      // Assert - 빈 번호 중 가장 작은 0
      expect(nextIdx).toBe(0);
    });
  });
});

// ============================================================================
// 레거시 별칭 테스트
// ============================================================================

describe('DeviceIdAssigner (레거시 별칭)', () => {
  it('should be alias for ClientIndexAllocator', () => {
    // Assert
    expect(DeviceIdAssigner).toBe(ClientIndexAllocator);
  });

  it('should work with DeviceIdAssigner name', () => {
    // Arrange
    const assigner = new DeviceIdAssigner();

    // Act
    const idx = assigner.assign('desktop');

    // Assert
    expect(idx).toBe(0);
  });
});
