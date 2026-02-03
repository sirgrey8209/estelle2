/**
 * @file device-icons.test.ts
 * @description deviceType 기반 아이콘 매핑 유틸리티 테스트
 */

import { describe, it, expect } from 'vitest';
import { getDeviceIcon, DEVICE_ICONS } from './device-icons';
import type { DeviceType } from '@estelle/core';

describe('device-icons', () => {
  describe('DEVICE_ICONS', () => {
    it('should have icon for pylon', () => {
      // Given & When
      const icon = DEVICE_ICONS.pylon;

      // Then
      expect(icon).toBeDefined();
      expect(typeof icon).toBe('string');
    });

    it('should have icon for desktop', () => {
      // Given & When
      const icon = DEVICE_ICONS.desktop;

      // Then
      expect(icon).toBeDefined();
      expect(typeof icon).toBe('string');
    });

    it('should map pylon to server icon', () => {
      // Given & When & Then
      expect(DEVICE_ICONS.pylon).toBe('🖥️');
    });

    it('should map desktop to laptop icon', () => {
      // Given & When & Then
      expect(DEVICE_ICONS.desktop).toBe('💻');
    });
  });

  describe('getDeviceIcon', () => {
    it('should return pylon icon for pylon type', () => {
      // Given
      const deviceType: DeviceType = 'pylon';

      // When
      const icon = getDeviceIcon(deviceType);

      // Then
      expect(icon).toBe('🖥️');
    });

    it('should return desktop icon for desktop type', () => {
      // Given
      const deviceType: DeviceType = 'desktop';

      // When
      const icon = getDeviceIcon(deviceType);

      // Then
      expect(icon).toBe('💻');
    });

    it('should return fallback icon for unknown type', () => {
      // Given - unknown type (TypeScript would complain, but runtime safety)
      const unknownType = 'unknown' as DeviceType;

      // When
      const icon = getDeviceIcon(unknownType);

      // Then
      expect(icon).toBe('❓');
    });
  });
});
