/**
 * @file setupTests.ts
 * @description Vitest + React Testing Library 설정 (웹 환경)
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// jsdom 환경 확인
if (typeof document === 'undefined') {
  throw new Error('setupTests.ts는 jsdom 환경에서 실행되어야 합니다.');
}

// localStorage mock
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageData[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageData[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageData).forEach((key) => delete localStorageData[key]);
  }),
  key: vi.fn((index: number) => Object.keys(localStorageData)[index] ?? null),
  get length() {
    return Object.keys(localStorageData).length;
  },
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// WebSocket mock
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url: string;

  send = vi.fn();
  close = vi.fn();

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // 비동기로 onopen 호출 시뮬레이션
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  // 테스트에서 메시지 수신 시뮬레이션용
  simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }
}

// @ts-expect-error - global WebSocket mock
globalThis.WebSocket = MockWebSocket;

// window.matchMedia mock (반응형 테스트용)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ResizeObserver mock
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.ResizeObserver = MockResizeObserver;

// IntersectionObserver mock
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// @ts-expect-error - global IntersectionObserver mock
globalThis.IntersectionObserver = MockIntersectionObserver;

// URL.createObjectURL mock (이미지 업로드 테스트용)
URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-object-url');
URL.revokeObjectURL = vi.fn();

// 테스트 유틸리티: localStorage 초기화
export function clearLocalStorage() {
  Object.keys(localStorageData).forEach((key) => delete localStorageData[key]);
}

// 테스트 유틸리티: Zustand 스토어 리셋
export function resetAllStores() {
  clearLocalStorage();
}

// Console 에러 억제 (테스트 노이즈 감소)
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // React 경고 무시
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') ||
      args[0].includes('React does not recognize') ||
      args[0].includes('Invalid DOM property'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

// 각 테스트 후 cleanup
import { afterEach } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
});
