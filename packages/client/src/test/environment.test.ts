/**
 * @file environment.test.ts
 * @description 테스트 환경 검증 (jsdom)
 */

import { describe, it, expect } from 'vitest';

describe('Test Environment', () => {
  it('jsdom 환경에서 document 접근 가능', () => {
    expect(typeof document).toBe('object');
    expect(document.createElement).toBeDefined();
  });

  it('jsdom 환경에서 window 접근 가능', () => {
    expect(typeof window).toBe('object');
    expect(window.innerWidth).toBeGreaterThan(0);
  });

  it('localStorage 모킹이 작동해야 한다', () => {
    localStorage.setItem('test-key', 'test-value');
    expect(localStorage.getItem('test-key')).toBe('test-value');
    localStorage.removeItem('test-key');
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('WebSocket 모킹이 작동해야 한다', () => {
    const ws = new WebSocket('ws://test.example.com');
    expect(ws.readyState).toBe(WebSocket.OPEN);
    expect(ws.send).toBeDefined();
    expect(ws.close).toBeDefined();
  });

  it('URL.createObjectURL 모킹이 작동해야 한다', () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    expect(url).toContain('blob:');
  });

  it('ResizeObserver 모킹이 작동해야 한다', () => {
    const observer = new ResizeObserver(() => {});
    expect(observer.observe).toBeDefined();
    expect(observer.disconnect).toBeDefined();
  });

  it('matchMedia 모킹이 작동해야 한다', () => {
    const mql = window.matchMedia('(min-width: 768px)');
    expect(mql.matches).toBeDefined();
    expect(mql.addEventListener).toBeDefined();
  });
});
