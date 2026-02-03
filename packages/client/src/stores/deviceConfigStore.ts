import { create } from 'zustand';

/**
 * 디바이스 설정 정보
 */
export interface DeviceConfig {
  /** 디바이스 ID (1-9: Pylon) */
  deviceId: number;
  /** 표시 이름 */
  name: string;
  /** 아이콘 (이모지) */
  icon: string;
}

/**
 * 디바이스 설정 스토어 상태
 */
export interface DeviceConfigState {
  /** Device ID → 설정 매핑 */
  configs: Record<number, DeviceConfig>;

  // Actions
  setConfig: (deviceId: number, name: string, icon: string) => void;
  getConfig: (deviceId: number) => DeviceConfig | undefined;
  getIcon: (deviceId: number) => string;
  getName: (deviceId: number) => string;
  removeConfig: (deviceId: number) => void;
  reset: () => void;
}

/**
 * 기본 아이콘 (Material Community Icon 이름)
 */
const DEFAULT_ICON = 'monitor';

/**
 * 기본 이름 생성
 */
const getDefaultName = (deviceId: number) => `Pylon ${deviceId}`;

/**
 * 초기 상태 - Pylon 아이콘 하드코딩
 */
const initialState = {
  configs: {
    1: { deviceId: 1, name: 'Office', icon: 'office-building-outline' },
    2: { deviceId: 2, name: 'Home', icon: 'home-outline' },
  } as Record<number, DeviceConfig>,
};

/**
 * 디바이스 설정 스토어
 *
 * Device ID별 아이콘/이름 매핑을 관리합니다.
 * 현재는 메모리에만 저장되며, 필요시 persist 추가 가능.
 */
export const useDeviceConfigStore = create<DeviceConfigState>()((set, get) => ({
  ...initialState,

  setConfig: (deviceId, name, icon) => {
    set((state) => ({
      configs: {
        ...state.configs,
        [deviceId]: { deviceId, name, icon },
      },
    }));
  },

  getConfig: (deviceId) => {
    return get().configs[deviceId];
  },

  getIcon: (deviceId) => {
    return get().configs[deviceId]?.icon ?? DEFAULT_ICON;
  },

  getName: (deviceId) => {
    return get().configs[deviceId]?.name ?? getDefaultName(deviceId);
  },

  removeConfig: (deviceId) => {
    set((state) => {
      const { [deviceId]: _, ...rest } = state.configs;
      return { configs: rest };
    });
  },

  reset: () => {
    set({ ...initialState });
  },
}));
