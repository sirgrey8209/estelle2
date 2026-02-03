/**
 * @file deviceConfigStore.test.ts
 * @description Device ID ↔ 아이콘/이름 매핑 스토어 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDeviceConfigStore } from './deviceConfigStore';

// Zustand 스토어 테스트용 헬퍼
const act = (fn: () => void) => fn();

describe('deviceConfigStore', () => {
  const getStore = () => useDeviceConfigStore.getState();

  beforeEach(() => {
    // 각 테스트 전 스토어 초기화
    act(() => {
      getStore().reset();
    });
  });

  describe('setConfig', () => {
    it('디바이스 설정을 저장할 수 있어야 한다', () => {
      act(() => {
        getStore().setConfig(1, 'Home PC', '🏠');
      });

      expect(getStore().configs[1]).toEqual({
        deviceId: 1,
        name: 'Home PC',
        icon: '🏠',
      });
    });

    it('여러 디바이스 설정을 저장할 수 있어야 한다', () => {
      act(() => {
        getStore().setConfig(1, 'Home PC', '🏠');
        getStore().setConfig(2, 'Office PC', '🏢');
      });

      expect(getStore().configs[1]?.name).toBe('Home PC');
      expect(getStore().configs[2]?.name).toBe('Office PC');
    });

    it('기존 설정을 덮어쓸 수 있어야 한다', () => {
      act(() => {
        getStore().setConfig(1, 'Old Name', '🖥️');
      });

      act(() => {
        getStore().setConfig(1, 'New Name', '🏠');
      });

      expect(getStore().configs[1]?.name).toBe('New Name');
      expect(getStore().configs[1]?.icon).toBe('🏠');
    });
  });

  describe('getConfig', () => {
    it('저장된 설정을 반환해야 한다', () => {
      act(() => {
        getStore().setConfig(1, 'Home PC', '🏠');
      });

      const config = getStore().getConfig(1);
      expect(config).toEqual({
        deviceId: 1,
        name: 'Home PC',
        icon: '🏠',
      });
    });

    it('존재하지 않는 설정은 undefined를 반환해야 한다', () => {
      const config = getStore().getConfig(99);
      expect(config).toBeUndefined();
    });
  });

  describe('getIcon', () => {
    it('저장된 아이콘을 반환해야 한다', () => {
      act(() => {
        getStore().setConfig(1, 'Home PC', '🏠');
      });

      expect(getStore().getIcon(1)).toBe('🏠');
    });

    it('설정이 없으면 기본 아이콘을 반환해야 한다', () => {
      expect(getStore().getIcon(99)).toBe('monitor');
    });
  });

  describe('getName', () => {
    it('저장된 이름을 반환해야 한다', () => {
      act(() => {
        getStore().setConfig(1, 'Home PC', '🏠');
      });

      expect(getStore().getName(1)).toBe('Home PC');
    });

    it('설정이 없으면 기본 이름을 반환해야 한다', () => {
      expect(getStore().getName(1)).toBe('Pylon 1');
      expect(getStore().getName(2)).toBe('Pylon 2');
    });
  });

  describe('removeConfig', () => {
    it('설정을 삭제할 수 있어야 한다', () => {
      act(() => {
        getStore().setConfig(1, 'Home PC', '🏠');
      });

      expect(getStore().getConfig(1)).toBeDefined();

      act(() => {
        getStore().removeConfig(1);
      });

      expect(getStore().getConfig(1)).toBeUndefined();
    });

    it('다른 설정에 영향을 주지 않아야 한다', () => {
      act(() => {
        getStore().setConfig(1, 'Home PC', '🏠');
        getStore().setConfig(2, 'Office PC', '🏢');
      });

      act(() => {
        getStore().removeConfig(1);
      });

      expect(getStore().getConfig(1)).toBeUndefined();
      expect(getStore().getConfig(2)).toBeDefined();
    });
  });

  describe('reset', () => {
    it('모든 설정을 초기화해야 한다', () => {
      act(() => {
        getStore().setConfig(1, 'Home PC', '🏠');
        getStore().setConfig(2, 'Office PC', '🏢');
      });

      act(() => {
        getStore().reset();
      });

      expect(Object.keys(getStore().configs).length).toBe(0);
    });
  });
});
