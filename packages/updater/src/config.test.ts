// packages/updater/src/config.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

vi.mock('fs');

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load config from file', async () => {
    const mockConfig = {
      masterUrl: 'ws://5.223.72.58:9900',
      whitelist: ['5.223.72.58', '121.0.0.1'],
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

    const { loadConfig } = await import('./config.js');
    const config = loadConfig('/path/to/config.json');

    expect(config.masterUrl).toBe('ws://5.223.72.58:9900');
    expect(config.whitelist).toContain('5.223.72.58');
  });

  it('should parse masterUrl to extract IP', async () => {
    vi.resetModules();
    const { parseMasterIp } = await import('./config.js');

    expect(parseMasterIp('ws://5.223.72.58:9900')).toBe('5.223.72.58');
    expect(parseMasterIp('ws://192.168.1.1:8080')).toBe('192.168.1.1');
  });
});
