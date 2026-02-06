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
    it('should return Building2 icon for office-building-outline', () => {
      const Icon = getDeviceIcon('office-building-outline');
      expect(Icon).toBeDefined();
      expect(Icon.$$typeof).toBe(Symbol.for('react.forward_ref'));
    });

    it('should return Home icon for home-outline', () => {
      const Icon = getDeviceIcon('home-outline');
      expect(Icon).toBeDefined();
      expect(Icon.$$typeof).toBe(Symbol.for('react.forward_ref'));
    });

    it('should return Monitor icon for monitor', () => {
      const Icon = getDeviceIcon('monitor');
      expect(Icon).toBeDefined();
      expect(Icon.$$typeof).toBe(Symbol.for('react.forward_ref'));
    });

    it('should return Monitor icon for pylon (legacy)', () => {
      const Icon = getDeviceIcon('pylon');
      expect(Icon).toBeDefined();
      expect(Icon.$$typeof).toBe(Symbol.for('react.forward_ref'));
    });

    it('should return fallback icon for unknown type', () => {
      const Icon = getDeviceIcon('unknown');
      expect(Icon).toBeDefined();
      expect(Icon.$$typeof).toBe(Symbol.for('react.forward_ref'));
    });

    it('should return fallback icon for undefined', () => {
      const Icon = getDeviceIcon(undefined);
      expect(Icon).toBeDefined();
    });
  });
});
