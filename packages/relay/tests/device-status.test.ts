/**
 * @file device-status.test.ts
 * @description 디바이스 상태 함수 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Client, DeviceConfig } from '../src/types.js';
import {
  getDeviceList,
  getDeviceListByType,
  createDeviceStatusMessage,
  createClientDisconnectMessage,
  getConnectionCount,
  getAuthenticatedCount,
  getConnectionStats,
} from '../src/device-status.js';

describe('device-status', () => {
  // 테스트용 디바이스 설정
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'Office', icon: '🏢', role: 'office', allowedIps: ['*'] },
    2: { name: 'Home', icon: '🏠', role: 'home', allowedIps: ['*'] },
  };

  // 테스트용 클라이언트 생성 헬퍼
  function createClient(
    deviceId: number | null,
    deviceType: 'pylon' | 'app' | null,
    authenticated: boolean
  ): Client {
    return {
      deviceId,
      deviceType,
      ip: '192.168.1.100',
      connectedAt: new Date('2024-01-15T10:00:00Z'),
      authenticated,
    };
  }

  let clients: Map<string, Client>;

  beforeEach(() => {
    clients = new Map([
      ['client-pylon-1', createClient(1, 'pylon', true)],
      ['client-pylon-2', createClient(2, 'pylon', true)],
      ['client-app-3', createClient(3, 'app', true)],
      ['client-pending', createClient(null, null, false)],
    ]);
  });

  describe('getDeviceList', () => {
    it('should return only authenticated devices', () => {
      const list = getDeviceList(clients, testDevices);
      expect(list).toHaveLength(3);
    });

    it('should include device info', () => {
      const list = getDeviceList(clients, testDevices);

      const pylon1 = list.find(d => d.deviceId === 1);
      expect(pylon1).toBeDefined();
      expect(pylon1?.name).toBe('Office');
      expect(pylon1?.icon).toBe('🏢');
      expect(pylon1?.role).toBe('office');
      expect(pylon1?.deviceType).toBe('pylon');
      expect(pylon1?.connectedAt).toBeDefined();
    });

    it('should return dynamic client info for app', () => {
      const list = getDeviceList(clients, testDevices);

      const app3 = list.find(d => d.deviceId === 3);
      expect(app3).toBeDefined();
      expect(app3?.name).toBe('Client 3');
      expect(app3?.icon).toBe('📱');
      expect(app3?.role).toBe('client');
    });

    it('should return empty list when no authenticated clients', () => {
      const emptyClients = new Map([
        ['client-pending', createClient(null, null, false)],
      ]);
      const list = getDeviceList(emptyClients, testDevices);
      expect(list).toHaveLength(0);
    });
  });

  describe('getDeviceListByType', () => {
    it('should filter by pylon type', () => {
      const pylons = getDeviceListByType(clients, 'pylon', testDevices);
      expect(pylons).toHaveLength(2);
      pylons.forEach(d => expect(d.deviceType).toBe('pylon'));
    });

    it('should filter by app type', () => {
      const apps = getDeviceListByType(clients, 'app', testDevices);
      expect(apps).toHaveLength(1);
      apps.forEach(d => expect(d.deviceType).toBe('app'));
    });
  });

  describe('createDeviceStatusMessage', () => {
    it('should create device_status message', () => {
      const message = createDeviceStatusMessage(clients, testDevices);

      expect(message.type).toBe('device_status');
      expect(message.payload).toBeDefined();
      expect(message.payload.devices).toBeInstanceOf(Array);
      expect(message.payload.devices).toHaveLength(3);
    });
  });

  describe('createClientDisconnectMessage', () => {
    it('should create client_disconnect message', () => {
      const message = createClientDisconnectMessage(100, 'app');

      expect(message.type).toBe('client_disconnect');
      expect(message.payload.deviceId).toBe(100);
      expect(message.payload.deviceType).toBe('app');
    });
  });

  describe('getConnectionCount', () => {
    it('should return total connection count', () => {
      expect(getConnectionCount(clients)).toBe(4);
    });

    it('should return 0 for empty map', () => {
      expect(getConnectionCount(new Map())).toBe(0);
    });
  });

  describe('getAuthenticatedCount', () => {
    it('should return authenticated client count', () => {
      expect(getAuthenticatedCount(clients)).toBe(3);
    });

    it('should return 0 when no authenticated clients', () => {
      const pending = new Map([
        ['client-1', createClient(null, null, false)],
      ]);
      expect(getAuthenticatedCount(pending)).toBe(0);
    });
  });

  describe('getConnectionStats', () => {
    it('should return stats by type', () => {
      const stats = getConnectionStats(clients);

      expect(stats.pylon).toBe(2);
      expect(stats.app).toBe(1);
      expect(stats.unauthenticated).toBe(1);
    });

    it('should handle empty map', () => {
      const stats = getConnectionStats(new Map());

      expect(stats.pylon).toBe(0);
      expect(stats.app).toBe(0);
      expect(stats.unauthenticated).toBe(0);
    });
  });
});
