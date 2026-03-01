// packages/updater/src/ip.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'os';

vi.mock('os');

describe('ip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should get local IPv4 address from network interfaces', async () => {
    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [
        { address: '5.223.72.58', family: 'IPv4', internal: false } as any,
      ],
    });

    const { getExternalIp } = await import('./ip.js');
    const ip = getExternalIp();

    expect(ip).toBe('5.223.72.58');
  });

  it('should skip internal addresses', async () => {
    vi.mocked(os.networkInterfaces).mockReturnValue({
      lo: [
        { address: '127.0.0.1', family: 'IPv4', internal: true } as any,
      ],
      eth0: [
        { address: '10.0.0.1', family: 'IPv4', internal: false } as any,
      ],
    });

    const { getExternalIp } = await import('./ip.js');
    const ip = getExternalIp();

    expect(ip).toBe('10.0.0.1');
  });

  it('should skip IPv6 addresses', async () => {
    vi.mocked(os.networkInterfaces).mockReturnValue({
      eth0: [
        { address: 'fe80::1', family: 'IPv6', internal: false } as any,
        { address: '192.168.1.100', family: 'IPv4', internal: false } as any,
      ],
    });

    const { getExternalIp } = await import('./ip.js');
    const ip = getExternalIp();

    expect(ip).toBe('192.168.1.100');
  });

  it('should return unknown if no valid interface found', async () => {
    vi.mocked(os.networkInterfaces).mockReturnValue({});

    const { getExternalIp } = await import('./ip.js');
    const ip = getExternalIp();

    expect(ip).toBe('unknown');
  });
});
