/**
 * @file auth-v2.test.ts
 * @description AuthPayload v2 타입 테스트 (deviceId: number로 통일)
 *
 * 변경 사항:
 * - deviceId: number (숫자로 통일)
 * - name?: string (디바이스 이름 추가)
 * - DeviceType: 'pylon' | 'desktop' (mobile, relay 제거)
 */

import { describe, it, expect } from 'vitest';
import type {
  AuthPayload,
  AuthResultPayload,
  AuthenticatedDevice,
  DeviceRole,
} from '../../src/types/auth.js';
import type { DeviceType } from '../../src/types/device.js';

describe('AuthPayload v2', () => {
  describe('deviceId는 숫자 타입만 허용', () => {
    it('should accept number deviceId for pylon', () => {
      // Arrange & Act
      const payload: AuthPayload = {
        deviceId: 1,
        deviceType: 'pylon',
      };

      // Assert
      expect(payload.deviceId).toBe(1);
      expect(typeof payload.deviceId).toBe('number');
    });

    it('should accept number deviceId for desktop', () => {
      // Arrange & Act
      const payload: AuthPayload = {
        deviceId: 100,
        deviceType: 'desktop',
      };

      // Assert
      expect(payload.deviceId).toBe(100);
      expect(typeof payload.deviceId).toBe('number');
    });

    it('deviceId 없이 인증 요청이 가능해야 한다 (서버에서 자동 발급)', () => {
      // Arrange & Act
      const payload: AuthPayload = {
        deviceType: 'desktop',
      };

      // Assert
      expect(payload.deviceId).toBeUndefined();
      expect(payload.deviceType).toBe('desktop');
    });
  });

  describe('name 필드', () => {
    it('name 필드를 선택적으로 포함할 수 있어야 한다', () => {
      // Arrange & Act
      const payloadWithName: AuthPayload = {
        deviceId: 1,
        deviceType: 'pylon',
        name: 'Main Pylon',
      };

      const payloadWithoutName: AuthPayload = {
        deviceId: 100,
        deviceType: 'desktop',
      };

      // Assert
      expect(payloadWithName.name).toBe('Main Pylon');
      expect(payloadWithoutName.name).toBeUndefined();
    });

    it('name 필드에 한글이 포함될 수 있어야 한다', () => {
      // Arrange & Act
      const payload: AuthPayload = {
        deviceId: 1,
        deviceType: 'pylon',
        name: '메인 파일론',
      };

      // Assert
      expect(payload.name).toBe('메인 파일론');
    });

    it('name 필드가 빈 문자열일 수 있어야 한다', () => {
      // Arrange & Act
      const payload: AuthPayload = {
        deviceId: 1,
        deviceType: 'pylon',
        name: '',
      };

      // Assert
      expect(payload.name).toBe('');
    });
  });

  describe('DeviceType 제한', () => {
    it('pylon 타입만 사용할 수 있어야 한다', () => {
      // Arrange & Act
      const payload: AuthPayload = {
        deviceId: 1,
        deviceType: 'pylon',
      };

      // Assert
      expect(payload.deviceType).toBe('pylon');
    });

    it('desktop 타입만 사용할 수 있어야 한다', () => {
      // Arrange & Act
      const payload: AuthPayload = {
        deviceId: 100,
        deviceType: 'desktop',
      };

      // Assert
      expect(payload.deviceType).toBe('desktop');
    });

    // 참고: 'mobile'과 'relay'는 더 이상 유효한 DeviceType이 아님
    // TypeScript 컴파일 에러가 발생해야 함 (타입 테스트)
  });

  describe('mac 필드', () => {
    it('mac 필드를 선택적으로 포함할 수 있어야 한다', () => {
      // Arrange & Act
      const payloadWithMac: AuthPayload = {
        deviceId: 100,
        deviceType: 'desktop',
        mac: '00:1A:2B:3C:4D:5E',
      };

      // Assert
      expect(payloadWithMac.mac).toBe('00:1A:2B:3C:4D:5E');
    });
  });

  describe('통합 테스트', () => {
    it('모든 필드를 포함한 완전한 AuthPayload를 생성할 수 있어야 한다', () => {
      // Arrange & Act
      const payload: AuthPayload = {
        deviceId: 1,
        deviceType: 'pylon',
        name: 'My Pylon Server',
        mac: 'AA:BB:CC:DD:EE:FF',
      };

      // Assert
      expect(payload.deviceId).toBe(1);
      expect(payload.deviceType).toBe('pylon');
      expect(payload.name).toBe('My Pylon Server');
      expect(payload.mac).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('여러 AuthPayload를 배열로 관리할 수 있어야 한다', () => {
      // Arrange & Act
      const payloads: AuthPayload[] = [
        { deviceId: 1, deviceType: 'pylon', name: 'Pylon 1' },
        { deviceId: 2, deviceType: 'pylon', name: 'Pylon 2' },
        { deviceId: 100, deviceType: 'desktop', name: 'Desktop 1' },
        { deviceId: 101, deviceType: 'desktop', name: 'Desktop 2' },
      ];

      // Assert
      expect(payloads).toHaveLength(4);
      expect(payloads.filter(p => p.deviceType === 'pylon')).toHaveLength(2);
      expect(payloads.filter(p => p.deviceType === 'desktop')).toHaveLength(2);
    });
  });
});

describe('DeviceType v2', () => {
  it('pylon과 desktop만 유효한 DeviceType이어야 한다', () => {
    // Arrange
    const validTypes: DeviceType[] = ['pylon', 'desktop'];

    // Act & Assert
    expect(validTypes).toContain('pylon');
    expect(validTypes).toContain('desktop');
    expect(validTypes).toHaveLength(2);
  });

  it('타입 가드로 DeviceType을 검증할 수 있어야 한다', () => {
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
});

describe('AuthenticatedDevice v2', () => {
  it('숫자 deviceId를 사용해야 한다', () => {
    // Arrange & Act
    const device: AuthenticatedDevice = {
      deviceId: 1,
      deviceType: 'pylon',
      name: 'Claude Pylon',
      icon: 'pylon-icon.png',
      role: 'controller',
    };

    // Assert
    expect(device.deviceId).toBe(1);
    expect(typeof device.deviceId).toBe('number');
  });

  it('desktop 디바이스의 deviceId는 100 이상이어야 한다', () => {
    // Arrange & Act
    const device: AuthenticatedDevice = {
      deviceId: 100,
      deviceType: 'desktop',
      name: 'My Desktop',
      icon: 'desktop.png',
      role: 'controller',
    };

    // Assert
    expect(device.deviceId).toBe(100);
    expect(device.deviceId).toBeGreaterThanOrEqual(100);
  });

  it('모든 필수 속성을 가져야 한다', () => {
    // Arrange & Act
    const device: AuthenticatedDevice = {
      deviceId: 1,
      deviceType: 'pylon',
      name: 'Test Device',
      icon: 'test.png',
      role: 'viewer',
    };

    // Assert
    expect(device).toHaveProperty('deviceId');
    expect(device).toHaveProperty('deviceType');
    expect(device).toHaveProperty('name');
    expect(device).toHaveProperty('icon');
    expect(device).toHaveProperty('role');
  });
});

describe('AuthResultPayload v2', () => {
  it('성공 응답에 숫자 deviceId를 포함해야 한다', () => {
    // Arrange & Act
    const result: AuthResultPayload = {
      success: true,
      deviceId: 1,
    };

    // Assert
    expect(result.success).toBe(true);
    expect(result.deviceId).toBe(1);
    expect(typeof result.deviceId).toBe('number');
  });

  it('성공 응답에 완전한 device 정보를 포함할 수 있어야 한다', () => {
    // Arrange & Act
    const result: AuthResultPayload = {
      success: true,
      device: {
        deviceId: 100,
        deviceType: 'desktop',
        name: 'My Desktop',
        icon: 'desktop.png',
        role: 'controller',
      },
    };

    // Assert
    expect(result.success).toBe(true);
    expect(result.device?.deviceId).toBe(100);
    expect(result.device?.deviceType).toBe('desktop');
  });

  it('실패 응답에 에러 메시지를 포함해야 한다', () => {
    // Arrange & Act
    const result: AuthResultPayload = {
      success: false,
      error: 'Invalid device ID',
    };

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid device ID');
  });
});
