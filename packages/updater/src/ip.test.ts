// packages/updater/src/ip.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import https from 'https';
import { EventEmitter } from 'events';

vi.mock('https');

describe('ip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

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

  it('should reject on HTTPS request error', async () => {
    const mockError = new Error('Connection refused');

    vi.mocked(https.get).mockImplementation(() => {
      const requestEmitter = new EventEmitter() as any;
      process.nextTick(() => requestEmitter.emit('error', mockError));
      return requestEmitter;
    });

    const { getExternalIp } = await import('./ip.js');
    await expect(getExternalIp()).rejects.toThrow('Connection refused');
  });

  it('should reject on response stream error', async () => {
    const mockResponse = new EventEmitter() as any;
    mockResponse.setEncoding = vi.fn();

    vi.mocked(https.get).mockImplementation((url, callback: any) => {
      callback(mockResponse);
      process.nextTick(() => mockResponse.emit('error', new Error('Stream error')));
      return new EventEmitter() as any;
    });

    const { getExternalIp } = await import('./ip.js');
    await expect(getExternalIp()).rejects.toThrow('Stream error');
  });
});
