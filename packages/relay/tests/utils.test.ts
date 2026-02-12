/**
 * @file utils.test.ts
 * @description 유틸리티 함수 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  getClientIp,
  getDeviceInfo,
  generateClientId,
  parseDeviceId,
} from '../src/utils.js';
import type { DeviceConfig } from '../src/types.js';

describe('getClientIp', () => {
  it('should extract IP from X-Forwarded-For header', () => {
    const req = {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    expect(getClientIp(req)).toBe('203.0.113.195');
  });

  it('should trim whitespace from X-Forwarded-For', () => {
    const req = {
      headers: { 'x-forwarded-for': '  10.0.0.1  , 192.168.1.1' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('should use remoteAddress when no X-Forwarded-For', () => {
    const req = {
      headers: {},
      socket: { remoteAddress: '192.168.1.100' },
    };
    expect(getClientIp(req)).toBe('192.168.1.100');
  });

  it('should return "unknown" when no IP available', () => {
    const req = {
      headers: {},
      socket: {},
    };
    expect(getClientIp(req)).toBe('unknown');
  });
});

describe('getDeviceInfo', () => {
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'Office', icon: '🏢', role: 'office', allowedIps: ['*'] },
    2: { name: 'Home', icon: '🏠', role: 'home', allowedIps: ['*'] },
  };

  it('should return registered device info', () => {
    const info = getDeviceInfo(1, testDevices);
    expect(info).toEqual({
      name: 'Office',
      icon: '🏢',
      role: 'office',
    });
  });

  it('should return dynamic client info for 0~15 range', () => {
    const info = getDeviceInfo(5, testDevices);
    expect(info).toEqual({
      name: 'Client 5',
      icon: '📱',
      role: 'client',
    });
  });

  it('should return unknown device info for out of range', () => {
    const info = getDeviceInfo(50, testDevices);
    expect(info).toEqual({
      name: 'Device 50',
      icon: '💻',
      role: 'unknown',
    });
  });
});

describe('generateClientId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateClientId();
    const id2 = generateClientId();
    expect(id1).not.toBe(id2);
  });

  it('should start with "client-"', () => {
    const id = generateClientId();
    expect(id.startsWith('client-')).toBe(true);
  });

  it('should contain timestamp and random part', () => {
    const id = generateClientId();
    const parts = id.split('-');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('client');
    expect(parseInt(parts[1], 10)).toBeGreaterThan(0);
    expect(parts[2].length).toBeGreaterThan(0);
  });
});

describe('parseDeviceId', () => {
  it('should return number for number input', () => {
    expect(parseDeviceId(1)).toBe(1);
    expect(parseDeviceId(100)).toBe(100);
  });

  it('should parse string to number', () => {
    expect(parseDeviceId('1')).toBe(1);
    expect(parseDeviceId('100')).toBe(100);
  });

  it('should return null for invalid string', () => {
    expect(parseDeviceId('abc')).toBe(null);
    expect(parseDeviceId('')).toBe(null);
  });

  it('should return null for null/undefined', () => {
    expect(parseDeviceId(null)).toBe(null);
    expect(parseDeviceId(undefined)).toBe(null);
  });
});

// ============================================================================
// 새 체계 테스트 (ClientIndexAllocator 기반 마이그레이션)
// ============================================================================

describe('[새 체계] getDeviceInfo - isValidClientIndex 기반', () => {
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'Office', icon: '🏢', role: 'office', allowedIps: ['*'] },
    2: { name: 'Home', icon: '🏠', role: 'home', allowedIps: ['*'] },
  };

  it('should_return_client_info_when_deviceId_is_0', () => {
    // Arrange & Act
    const info = getDeviceInfo(0, testDevices);

    // Assert — 새 체계: deviceId 0은 동적 클라이언트
    expect(info.role).toBe('client');
    expect(info.name).toBe('Client 0');
    expect(info.icon).toBe('📱');
  });

  it('should_return_client_info_when_deviceId_is_5', () => {
    // Arrange & Act
    const info = getDeviceInfo(5, testDevices);

    // Assert — 새 체계: deviceId 5는 동적 클라이언트 (등록된 디바이스가 아닌 경우)
    expect(info.role).toBe('client');
    expect(info.name).toBe('Client 5');
  });

  it('should_return_client_info_when_deviceId_is_15', () => {
    // Arrange & Act
    const info = getDeviceInfo(15, testDevices);

    // Assert — 새 체계: deviceId 15는 동적 클라이언트
    expect(info.role).toBe('client');
    expect(info.name).toBe('Client 15');
  });

  it('should_return_unknown_when_deviceId_is_16', () => {
    // Arrange & Act
    const info = getDeviceInfo(16, testDevices);

    // Assert — 새 체계: 16은 유효한 clientIndex가 아니므로 unknown
    expect(info.role).toBe('unknown');
  });

  it('should_return_unknown_when_deviceId_is_100', () => {
    // Arrange & Act
    const info = getDeviceInfo(100, testDevices);

    // Assert — 새 체계: 100은 유효한 clientIndex가 아니므로 unknown
    // (현재 구체계에서는 100이 client로 반환되므로 이 테스트는 실패해야 함)
    expect(info.role).toBe('unknown');
  });

  it('should_still_return_registered_device_info', () => {
    // Arrange & Act — 등록된 디바이스는 여전히 정상 반환
    const info = getDeviceInfo(1, testDevices);

    // Assert
    expect(info).toEqual({
      name: 'Office',
      icon: '🏢',
      role: 'office',
    });
  });
});
