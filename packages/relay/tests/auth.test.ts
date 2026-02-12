/**
 * @file auth.test.ts
 * @description 인증 함수 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  authenticateDevice,
  isIpAllowed,
  isDynamicDeviceId,
  isRegisteredDevice,
} from '../src/auth.js';
import type { DeviceConfig } from '../src/types.js';
import { isValidClientIndex } from '@estelle/core';

describe('authenticateDevice', () => {
  // 테스트용 디바이스 설정
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'Office', icon: '🏢', role: 'office', allowedIps: ['*'] },
    2: { name: 'Home', icon: '🏠', role: 'home', allowedIps: ['192.168.1.100', '192.168.1.101'] },
  };

  describe('등록된 디바이스 인증', () => {
    it('should authenticate registered device with wildcard IP', () => {
      const result = authenticateDevice(1, 'pylon', '10.0.0.1', testDevices);
      expect(result).toEqual({ success: true });
    });

    it('should authenticate registered device with allowed IP', () => {
      const result = authenticateDevice(2, 'pylon', '192.168.1.100', testDevices);
      expect(result).toEqual({ success: true });
    });

    it('should reject registered device with disallowed IP', () => {
      const result = authenticateDevice(2, 'pylon', '10.0.0.1', testDevices);
      expect(result.success).toBe(false);
      expect(result.error).toContain('IP not allowed');
    });
  });

  describe('동적 디바이스 인증', () => {
    it('should authenticate dynamic device ID (0~15)', () => {
      const result = authenticateDevice(0, 'app', '10.0.0.1', testDevices);
      expect(result).toEqual({ success: true });
    });

    it('should authenticate dynamic device ID (5)', () => {
      const result = authenticateDevice(5, 'app', '192.168.1.200', testDevices);
      expect(result).toEqual({ success: true });
    });
  });

  describe('미등록 디바이스 거부', () => {
    it('should reject unregistered device ID (< 100)', () => {
      const result = authenticateDevice(50, 'pylon', '10.0.0.1', testDevices);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown device');
    });

    it('should reject unregistered device ID (99)', () => {
      const result = authenticateDevice(99, 'pylon', '10.0.0.1', testDevices);
      expect(result.success).toBe(false);
    });
  });
});

describe('isIpAllowed', () => {
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'D1', icon: '🏢', role: 'office', allowedIps: ['*'] },
    2: { name: 'D2', icon: '🏠', role: 'home', allowedIps: ['192.168.1.100'] },
  };

  it('should allow any IP for wildcard device', () => {
    expect(isIpAllowed(1, '10.0.0.1', testDevices)).toBe(true);
    expect(isIpAllowed(1, '192.168.1.100', testDevices)).toBe(true);
  });

  it('should allow specific IP for restricted device', () => {
    expect(isIpAllowed(2, '192.168.1.100', testDevices)).toBe(true);
  });

  it('should reject disallowed IP', () => {
    expect(isIpAllowed(2, '10.0.0.1', testDevices)).toBe(false);
  });

  it('should return false for unregistered device', () => {
    expect(isIpAllowed(99, '192.168.1.100', testDevices)).toBe(false);
  });
});

describe('isDynamicDeviceId', () => {
  it('should return true for valid client index range (0~15)', () => {
    expect(isDynamicDeviceId(0)).toBe(true);
    expect(isDynamicDeviceId(5)).toBe(true);
    expect(isDynamicDeviceId(15)).toBe(true);
  });

  it('should return false for out of range IDs', () => {
    expect(isDynamicDeviceId(16)).toBe(false);
    expect(isDynamicDeviceId(99)).toBe(false);
    expect(isDynamicDeviceId(100)).toBe(false);
    expect(isDynamicDeviceId(1000)).toBe(false);
  });

  it('should use isValidClientIndex boundary (0~15)', () => {
    expect(isDynamicDeviceId(-1)).toBe(false);
    expect(isDynamicDeviceId(0)).toBe(true);
    expect(isDynamicDeviceId(15)).toBe(true);
    expect(isDynamicDeviceId(16)).toBe(false);
  });
});

describe('isRegisteredDevice', () => {
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'D1', icon: '🏢', role: 'office', allowedIps: ['*'] },
    2: { name: 'D2', icon: '🏠', role: 'home', allowedIps: ['*'] },
  };

  it('should return true for registered devices', () => {
    expect(isRegisteredDevice(1, testDevices)).toBe(true);
    expect(isRegisteredDevice(2, testDevices)).toBe(true);
  });

  it('should return false for unregistered devices', () => {
    expect(isRegisteredDevice(3, testDevices)).toBe(false);
    expect(isRegisteredDevice(100, testDevices)).toBe(false);
  });
});

// ============================================================================
// 새 체계 테스트 (ClientIndexAllocator 기반 마이그레이션)
// ============================================================================

describe('[새 체계] authenticateDevice - isValidClientIndex 기반', () => {
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'Office', icon: '🏢', role: 'office', allowedIps: ['*'] },
    2: { name: 'Home', icon: '🏠', role: 'home', allowedIps: ['192.168.1.100'] },
  };

  describe('동적 디바이스 인증 (0~15 범위)', () => {
    it('should_authenticate_dynamic_device_when_deviceId_is_0', () => {
      // Arrange & Act
      const result = authenticateDevice(0, 'app', '10.0.0.1', testDevices);

      // Assert — 새 체계: 0은 유효한 clientIndex이므로 성공해야 함
      expect(result).toEqual({ success: true });
    });

    it('should_authenticate_dynamic_device_when_deviceId_is_15', () => {
      // Arrange & Act
      const result = authenticateDevice(15, 'app', '10.0.0.1', testDevices);

      // Assert — 새 체계: 15는 유효한 clientIndex이므로 성공해야 함
      expect(result).toEqual({ success: true });
    });

    it('should_authenticate_dynamic_device_when_deviceId_is_5', () => {
      // Arrange & Act
      const result = authenticateDevice(5, 'app', '10.0.0.1', testDevices);

      // Assert — 새 체계: 5는 유효한 clientIndex이므로 성공해야 함
      expect(result).toEqual({ success: true });
    });
  });

  describe('유효하지 않은 동적 디바이스 거부 (16 이상)', () => {
    it('should_reject_device_when_deviceId_is_16', () => {
      // Arrange & Act
      const result = authenticateDevice(16, 'app', '10.0.0.1', testDevices);

      // Assert — 새 체계: 16은 유효한 clientIndex가 아니므로 실패해야 함
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown device');
    });

    it('should_reject_device_when_deviceId_is_100', () => {
      // Arrange & Act
      const result = authenticateDevice(100, 'app', '10.0.0.1', testDevices);

      // Assert — 새 체계: 100은 유효한 clientIndex가 아니므로 실패해야 함
      // (현재 구체계에서는 100이 통과하므로 이 테스트는 실패해야 함)
      expect(result.success).toBe(false);
    });

    it('should_reject_device_when_deviceId_is_1000', () => {
      // Arrange & Act
      const result = authenticateDevice(1000, 'app', '10.0.0.1', testDevices);

      // Assert — 새 체계: 1000은 유효한 clientIndex가 아니므로 실패해야 함
      expect(result.success).toBe(false);
    });
  });
});

describe('[새 체계] isDynamicDeviceId - isValidClientIndex 기반', () => {
  it('should_return_true_when_deviceId_in_client_index_range_0_to_15', () => {
    // Assert — 새 체계: 0~15가 동적 디바이스
    expect(isDynamicDeviceId(0)).toBe(true);
    expect(isDynamicDeviceId(5)).toBe(true);
    expect(isDynamicDeviceId(15)).toBe(true);
  });

  it('should_return_false_when_deviceId_above_client_index_range', () => {
    // Assert — 새 체계: 16 이상은 동적 디바이스가 아님
    expect(isDynamicDeviceId(16)).toBe(false);
    expect(isDynamicDeviceId(100)).toBe(false);
    expect(isDynamicDeviceId(1000)).toBe(false);
  });

  it('should_return_false_when_deviceId_is_negative', () => {
    // Assert — 음수는 항상 false
    expect(isDynamicDeviceId(-1)).toBe(false);
    expect(isDynamicDeviceId(-100)).toBe(false);
  });

  it('should_use_isValidClientIndex_not_DYNAMIC_DEVICE_ID_START', () => {
    // Assert — 새 체계에서 경계값은 0~15
    // isValidClientIndex(0) = true, isValidClientIndex(15) = true
    // isValidClientIndex(16) = false
    expect(isDynamicDeviceId(0)).toBe(isValidClientIndex(0));   // true === true
    expect(isDynamicDeviceId(15)).toBe(isValidClientIndex(15)); // true === true
    expect(isDynamicDeviceId(16)).toBe(isValidClientIndex(16)); // false === false
  });
});
