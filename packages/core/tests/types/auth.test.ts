/**
 * @file auth.test.ts
 * @description 인증 관련 타입 테스트
 */

import { describe, it, expect } from 'vitest';
import type {
  AuthPayload,
  AuthResultPayload,
  AuthenticatedDevice,
  DeviceRole,
} from '../../src/types/auth.js';
import type { DeviceType, DeviceId } from '../../src/types/device.js';

describe('DeviceRole', () => {
  it('should accept valid device roles', () => {
    // DeviceRole은 'controller' | 'viewer' 중 하나여야 함
    const controller: DeviceRole = 'controller';
    const viewer: DeviceRole = 'viewer';

    expect(controller).toBe('controller');
    expect(viewer).toBe('viewer');
  });

  it('should be usable in type guards', () => {
    const validRoles: DeviceRole[] = ['controller', 'viewer'];

    const isValidRole = (value: string): value is DeviceRole => {
      return validRoles.includes(value as DeviceRole);
    };

    expect(isValidRole('controller')).toBe(true);
    expect(isValidRole('viewer')).toBe(true);
    expect(isValidRole('admin')).toBe(false);
  });
});

describe('AuthPayload', () => {
  it('should have required deviceId and deviceType properties', () => {
    // Arrange & Act
    const payload: AuthPayload = {
      deviceId: 'my-pc-001',
      deviceType: 'pylon',
    };

    // Assert
    expect(payload.deviceId).toBe('my-pc-001');
    expect(payload.deviceType).toBe('pylon');
  });

  it('should accept string deviceId', () => {
    // Arrange & Act
    const payload: AuthPayload = {
      deviceId: 'desktop-abc-123',
      deviceType: 'desktop',
    };

    // Assert
    expect(payload.deviceId).toBe('desktop-abc-123');
    expect(typeof payload.deviceId).toBe('string');
  });

  it('should accept number deviceId for pylon', () => {
    // Arrange & Act - Pylon은 숫자 deviceId를 사용
    const pylonPayload1: AuthPayload = {
      deviceId: 1,
      deviceType: 'pylon',
    };

    const pylonPayload2: AuthPayload = {
      deviceId: 2,
      deviceType: 'pylon',
    };

    // Assert
    expect(pylonPayload1.deviceId).toBe(1);
    expect(pylonPayload2.deviceId).toBe(2);
    expect(typeof pylonPayload1.deviceId).toBe('number');
    expect(typeof pylonPayload2.deviceId).toBe('number');
  });

  it('should allow optional mac property', () => {
    // Arrange & Act
    const payloadWithMac: AuthPayload = {
      deviceId: 'my-pc-001',
      deviceType: 'desktop',
      mac: '00:1A:2B:3C:4D:5E',
    };

    const payloadWithoutMac: AuthPayload = {
      deviceId: 'my-pc-002',
      deviceType: 'mobile',
    };

    // Assert
    expect(payloadWithMac.mac).toBe('00:1A:2B:3C:4D:5E');
    expect(payloadWithoutMac.mac).toBeUndefined();
  });

  it('should work with all device types', () => {
    // Arrange & Act
    const pylonPayload: AuthPayload = { deviceId: 1, deviceType: 'pylon' };
    const desktopPayload: AuthPayload = { deviceId: 'pc2', deviceType: 'desktop' };
    const mobilePayload: AuthPayload = { deviceId: 'phone1', deviceType: 'mobile' };
    const relayPayload: AuthPayload = { deviceId: 'relay1', deviceType: 'relay' };

    // Assert
    expect(pylonPayload.deviceType).toBe('pylon');
    expect(desktopPayload.deviceType).toBe('desktop');
    expect(mobilePayload.deviceType).toBe('mobile');
    expect(relayPayload.deviceType).toBe('relay');
  });

  it('should support mixed deviceId types in a collection', () => {
    // Arrange & Act - 다양한 타입의 deviceId를 하나의 배열에서 처리
    const payloads: AuthPayload[] = [
      { deviceId: 1, deviceType: 'pylon' },
      { deviceId: 'desktop-001', deviceType: 'desktop' },
      { deviceId: 2, deviceType: 'pylon' },
      { deviceId: 'mobile-xyz', deviceType: 'mobile' },
    ];

    // Assert
    expect(payloads[0].deviceId).toBe(1);
    expect(payloads[1].deviceId).toBe('desktop-001');
    expect(payloads[2].deviceId).toBe(2);
    expect(payloads[3].deviceId).toBe('mobile-xyz');
  });

  it('should allow optional deviceId for app clients', () => {
    // Arrange & Act - App 클라이언트는 deviceId 없이 요청 가능
    // 서버에서 자동으로 deviceId를 발급해줌
    const appPayloadWithoutId: AuthPayload = {
      deviceType: 'desktop',
    };

    const appPayloadWithId: AuthPayload = {
      deviceId: 'auto-assigned-001',
      deviceType: 'desktop',
    };

    // Assert
    expect(appPayloadWithoutId.deviceId).toBeUndefined();
    expect(appPayloadWithoutId.deviceType).toBe('desktop');
    expect(appPayloadWithId.deviceId).toBe('auto-assigned-001');
  });

  it('should allow mobile client to connect without deviceId', () => {
    // Arrange & Act - 모바일 클라이언트도 deviceId 없이 연결 가능
    const mobilePayload: AuthPayload = {
      deviceType: 'mobile',
      mac: 'AA:BB:CC:DD:EE:FF',
    };

    // Assert
    expect(mobilePayload.deviceId).toBeUndefined();
    expect(mobilePayload.deviceType).toBe('mobile');
    expect(mobilePayload.mac).toBe('AA:BB:CC:DD:EE:FF');
  });
});

describe('AuthenticatedDevice', () => {
  it('should have all required properties', () => {
    const device: AuthenticatedDevice = {
      deviceId: { pcId: 'my-pc-001', deviceType: 'pylon' },
      deviceType: 'pylon',
      name: 'Claude Pylon',
      icon: 'pylon-icon.png',
      role: 'controller',
    };

    expect(device.deviceId).toEqual({ pcId: 'my-pc-001', deviceType: 'pylon' });
    expect(device.deviceType).toBe('pylon');
    expect(device.name).toBe('Claude Pylon');
    expect(device.icon).toBe('pylon-icon.png');
    expect(device.role).toBe('controller');
  });

  it('should support different roles', () => {
    const controllerDevice: AuthenticatedDevice = {
      deviceId: { pcId: 'pc1', deviceType: 'desktop' },
      deviceType: 'desktop',
      name: 'Desktop Controller',
      icon: 'desktop.png',
      role: 'controller',
    };

    const viewerDevice: AuthenticatedDevice = {
      deviceId: { pcId: 'phone1', deviceType: 'mobile' },
      deviceType: 'mobile',
      name: 'Mobile Viewer',
      icon: 'mobile.png',
      role: 'viewer',
    };

    expect(controllerDevice.role).toBe('controller');
    expect(viewerDevice.role).toBe('viewer');
  });

  it('should support unicode characters in name', () => {
    const koreanDevice: AuthenticatedDevice = {
      deviceId: { pcId: 'pc1', deviceType: 'pylon' },
      deviceType: 'pylon',
      name: '메인 서버',
      icon: 'server.png',
      role: 'controller',
    };

    expect(koreanDevice.name).toBe('메인 서버');
  });
});

describe('AuthResultPayload', () => {
  it('should have required success property', () => {
    const successResult: AuthResultPayload = {
      success: true,
    };

    const failResult: AuthResultPayload = {
      success: false,
    };

    expect(successResult.success).toBe(true);
    expect(failResult.success).toBe(false);
  });

  it('should allow optional error property on failure', () => {
    const failWithError: AuthResultPayload = {
      success: false,
      error: 'Invalid credentials',
    };

    const failWithoutError: AuthResultPayload = {
      success: false,
    };

    expect(failWithError.error).toBe('Invalid credentials');
    expect(failWithoutError.error).toBeUndefined();
  });

  it('should allow optional deviceId property on success', () => {
    const successWithDeviceId: AuthResultPayload = {
      success: true,
      deviceId: { pcId: 'my-pc-001', deviceType: 'pylon' },
    };

    const successWithoutDeviceId: AuthResultPayload = {
      success: true,
    };

    expect(successWithDeviceId.deviceId).toEqual({
      pcId: 'my-pc-001',
      deviceType: 'pylon',
    });
    expect(successWithoutDeviceId.deviceId).toBeUndefined();
  });

  it('should allow optional device property with full device info', () => {
    const successWithDevice: AuthResultPayload = {
      success: true,
      device: {
        deviceId: { pcId: 'my-pc-001', deviceType: 'pylon' },
        deviceType: 'pylon',
        name: 'Main Pylon',
        icon: 'pylon.png',
        role: 'controller',
      },
    };

    expect(successWithDevice.device).toBeDefined();
    expect(successWithDevice.device?.name).toBe('Main Pylon');
    expect(successWithDevice.device?.role).toBe('controller');
  });

  it('should support complete success response (as used in relay)', () => {
    // Relay에서 실제로 사용되는 완전한 성공 응답 구조
    const completeSuccessResponse: AuthResultPayload = {
      success: true,
      device: {
        deviceId: { pcId: 'workstation-001', deviceType: 'desktop' },
        deviceType: 'desktop',
        name: 'My Desktop',
        icon: 'desktop-icon.png',
        role: 'controller',
      },
    };

    expect(completeSuccessResponse.success).toBe(true);
    expect(completeSuccessResponse.device?.deviceId.pcId).toBe('workstation-001');
    expect(completeSuccessResponse.device?.deviceType).toBe('desktop');
    expect(completeSuccessResponse.device?.name).toBe('My Desktop');
    expect(completeSuccessResponse.device?.icon).toBe('desktop-icon.png');
    expect(completeSuccessResponse.device?.role).toBe('controller');
  });

  it('should support failure response with error message', () => {
    const failureResponse: AuthResultPayload = {
      success: false,
      error: 'Authentication failed: unknown device',
    };

    expect(failureResponse.success).toBe(false);
    expect(failureResponse.error).toBe('Authentication failed: unknown device');
    expect(failureResponse.device).toBeUndefined();
    expect(failureResponse.deviceId).toBeUndefined();
  });
});
