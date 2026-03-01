// packages/updater/src/ip.test.ts
import { describe, it, expect, vi } from 'vitest';
import https from 'https';
import { EventEmitter } from 'events';

vi.mock('https');

describe('ip', () => {
  it('should get external IP from ipify', async () => {
    const mockResponse = new EventEmitter() as any;
    mockResponse.setEncoding = vi.fn();

    vi.mocked(https.get).mockImplementation((url, callback: any) => {
      callback(mockResponse);
      process.nextTick(() => {
        mockResponse.emit('data', '5.223.72.58');
        mockResponse.emit('end');
      });
      return new EventEmitter() as any;
    });

    const { getExternalIp } = await import('./ip.js');
    const ip = await getExternalIp();

    expect(ip).toBe('5.223.72.58');
  });
});
