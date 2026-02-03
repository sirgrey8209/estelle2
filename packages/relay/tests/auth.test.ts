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
import { DYNAMIC_DEVICE_ID_START } from '../src/constants.js';

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
    it('should authenticate dynamic device ID (100+)', () => {
      const result = authenticateDevice(100, 'app', '10.0.0.1', testDevices);
      expect(result).toEqual({ success: true });
    });

    it('should authenticate dynamic device ID (105)', () => {
      const result = authenticateDevice(105, 'app', '192.168.1.200', testDevices);
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
  it('should return false for static device IDs', () => {
    expect(isDynamicDeviceId(1)).toBe(false);
    expect(isDynamicDeviceId(99)).toBe(false);
  });

  it('should return true for dynamic device IDs', () => {
    expect(isDynamicDeviceId(100)).toBe(true);
    expect(isDynamicDeviceId(105)).toBe(true);
    expect(isDynamicDeviceId(1000)).toBe(true);
  });

  it('should use DYNAMIC_DEVICE_ID_START as boundary', () => {
    expect(isDynamicDeviceId(DYNAMIC_DEVICE_ID_START - 1)).toBe(false);
    expect(isDynamicDeviceId(DYNAMIC_DEVICE_ID_START)).toBe(true);
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
