/**
 * @file device.test.ts
 * @description Device 관련 타입 테스트
 */

import { describe, it, expect } from 'vitest';
import type { DeviceType, DeviceId, Character } from '../../src/types/device.js';

describe('DeviceType', () => {
  it('should accept valid device types', () => {
    // DeviceType은 'pylon' | 'desktop' | 'mobile' | 'relay' 중 하나여야 함
    const pylon: DeviceType = 'pylon';
    const desktop: DeviceType = 'desktop';
    const mobile: DeviceType = 'mobile';
    const relay: DeviceType = 'relay';

    expect(pylon).toBe('pylon');
    expect(desktop).toBe('desktop');
    expect(mobile).toBe('mobile');
    expect(relay).toBe('relay');
  });

  it('should be usable in type guards', () => {
    const validTypes: DeviceType[] = ['pylon', 'desktop', 'mobile', 'relay'];

    const isValidDeviceType = (value: string): value is DeviceType => {
      return validTypes.includes(value as DeviceType);
    };

    expect(isValidDeviceType('pylon')).toBe(true);
    expect(isValidDeviceType('desktop')).toBe(true);
    expect(isValidDeviceType('mobile')).toBe(true);
    expect(isValidDeviceType('relay')).toBe(true);
    expect(isValidDeviceType('invalid')).toBe(false);
  });
});

describe('DeviceId', () => {
  it('should have pcId and deviceType properties', () => {
    const deviceId: DeviceId = {
      pcId: 'my-pc-001',
      deviceType: 'pylon',
    };

    expect(deviceId.pcId).toBe('my-pc-001');
    expect(deviceId.deviceType).toBe('pylon');
  });

  it('should work with all device types', () => {
    const pylonDevice: DeviceId = { pcId: 'pc1', deviceType: 'pylon' };
    const desktopDevice: DeviceId = { pcId: 'pc2', deviceType: 'desktop' };
    const mobileDevice: DeviceId = { pcId: 'phone1', deviceType: 'mobile' };
    const relayDevice: DeviceId = { pcId: 'relay1', deviceType: 'relay' };

    expect(pylonDevice.deviceType).toBe('pylon');
    expect(desktopDevice.deviceType).toBe('desktop');
    expect(mobileDevice.deviceType).toBe('mobile');
    expect(relayDevice.deviceType).toBe('relay');
  });

  it('should be comparable for equality', () => {
    const device1: DeviceId = { pcId: 'pc1', deviceType: 'pylon' };
    const device2: DeviceId = { pcId: 'pc1', deviceType: 'pylon' };
    const device3: DeviceId = { pcId: 'pc1', deviceType: 'desktop' };

    // 같은 pcId와 deviceType을 가진 경우
    expect(device1.pcId).toBe(device2.pcId);
    expect(device1.deviceType).toBe(device2.deviceType);

    // deviceType이 다른 경우
    expect(device1.deviceType).not.toBe(device3.deviceType);
  });
});

describe('Character', () => {
  it('should have name, icon, and description properties', () => {
    const character: Character = {
      name: 'Claude',
      icon: 'claude-icon.png',
      description: 'AI Assistant',
    };

    expect(character.name).toBe('Claude');
    expect(character.icon).toBe('claude-icon.png');
    expect(character.description).toBe('AI Assistant');
  });

  it('should allow empty strings for optional visual elements', () => {
    const minimalCharacter: Character = {
      name: 'Bot',
      icon: '',
      description: '',
    };

    expect(minimalCharacter.name).toBe('Bot');
    expect(minimalCharacter.icon).toBe('');
    expect(minimalCharacter.description).toBe('');
  });

  it('should support unicode characters in name and description', () => {
    const koreanCharacter: Character = {
      name: '클로드',
      icon: 'korean-icon.png',
      description: 'AI 어시스턴트입니다',
    };

    expect(koreanCharacter.name).toBe('클로드');
    expect(koreanCharacter.description).toBe('AI 어시스턴트입니다');
  });
});
