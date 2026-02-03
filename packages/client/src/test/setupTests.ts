/**
 * @file setupTests.ts
 * @description Vitest + React Native Testing Library 설정
 */

import { vi } from 'vitest';

// React Native 모킹
vi.mock('react-native', async () => {
  const RN = await vi.importActual<typeof import('react-native')>('react-native');

  return {
    ...RN,
    Platform: {
      OS: 'web',
      select: (obj: Record<string, unknown>) => obj.web ?? obj.default,
    },
    Dimensions: {
      get: () => ({ width: 1024, height: 768 }),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    StyleSheet: {
      ...RN.StyleSheet,
      create: (styles: Record<string, unknown>) => styles,
    },
  };
});

// Expo ImagePicker 모킹
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///test/image.jpg', fileName: 'image.jpg' }],
  }),
  launchCameraAsync: vi.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///test/camera.jpg', fileName: 'camera.jpg' }],
  }),
  MediaTypeOptions: {
    Images: 'Images',
    Videos: 'Videos',
    All: 'All',
  },
}));

// NativeWind 클래스명 무시 (스타일링 테스트 제외)
vi.mock('nativewind', () => ({
  styled: (component: unknown) => component,
}));

// AsyncStorage mock (Zustand persist용)
const asyncStorageData: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(asyncStorageData[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      asyncStorageData[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete asyncStorageData[key];
      return Promise.resolve();
    }),
    getAllKeys: vi.fn(() => Promise.resolve(Object.keys(asyncStorageData))),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach((key) => delete asyncStorageData[key]);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      Object.keys(asyncStorageData).forEach((key) => delete asyncStorageData[key]);
      return Promise.resolve();
    }),
  },
}));

// Zustand 테스트 유틸리티
export function resetAllStores() {
  // 각 스토어의 reset 함수 호출
}

// WebSocket mock
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  send = vi.fn();
  close = vi.fn();

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
}

// @ts-expect-error - global WebSocket mock
globalThis.WebSocket = MockWebSocket;

// Console 에러 억제 (테스트 노이즈 감소)
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // React Native 관련 경고 무시
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') || args[0].includes('NativeWind'))
  ) {
    return;
  }
  originalConsoleError(...args);
};
