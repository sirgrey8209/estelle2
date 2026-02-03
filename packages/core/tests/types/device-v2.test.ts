/**
 * @file device-v2.test.ts
 * @description DeviceType v2 타입 테스트 (mobile, relay 제거)
 *
 * 변경 사항:
 * - DeviceType: 'pylon' | 'desktop' (mobile, relay 제거)
 */

import { describe, it, expect } from 'vitest';
import type { DeviceType, Character } from '../../src/types/device.js';

describe('DeviceType v2', () => {
  it('pylon 타입을 허용해야 한다', () => {
    // Arrange & Act
    const pylon: DeviceType = 'pylon';

    // Assert
    expect(pylon).toBe('pylon');
  });

  it('desktop 타입을 허용해야 한다', () => {
    // Arrange & Act
    const desktop: DeviceType = 'desktop';

    // Assert
    expect(desktop).toBe('desktop');
  });

  it('타입 가드가 pylon과 desktop만 허용해야 한다', () => {
    // Arrange
    const isValidDeviceType = (value: string): value is DeviceType => {
      return value === 'pylon' || value === 'desktop';
    };

    // Act & Assert
    expect(isValidDeviceType('pylon')).toBe(true);
    expect(isValidDeviceType('desktop')).toBe(true);
    expect(isValidDeviceType('mobile')).toBe(false);
    expect(isValidDeviceType('relay')).toBe(false);
    expect(isValidDeviceType('invalid')).toBe(false);
  });

  it('DeviceType 배열에 pylon과 desktop만 포함되어야 한다', () => {
    // Arrange
    const validTypes: DeviceType[] = ['pylon', 'desktop'];

    // Act & Assert
    expect(validTypes).toHaveLength(2);
    expect(validTypes).toContain('pylon');
    expect(validTypes).toContain('desktop');
  });
});

describe('Character (변경 없음)', () => {
  it('name, icon, description 속성을 가져야 한다', () => {
    // Arrange & Act
    const character: Character = {
      name: 'Claude',
      icon: 'claude-icon.png',
      description: 'AI Assistant',
    };

    // Assert
    expect(character.name).toBe('Claude');
    expect(character.icon).toBe('claude-icon.png');
    expect(character.description).toBe('AI Assistant');
  });
});
