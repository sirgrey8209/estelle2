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

  it('should return dynamic client info for 100+', () => {
    const info = getDeviceInfo(105, testDevices);
    expect(info).toEqual({
      name: 'Client 105',
      icon: '📱',
      role: 'client',
    });
  });

  it('should return unknown device info for unregistered < 100', () => {
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
