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
      masterUrl: 'ws://89.167.4.124:9900',
      whitelist: ['89.167.4.124', '121.0.0.1'],
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

    const { loadConfig } = await import('./config.js');
    const config = loadConfig('/path/to/config.json');

    expect(config.masterUrl).toBe('ws://89.167.4.124:9900');
    expect(config.whitelist).toContain('89.167.4.124');
  });

  it('should parse masterUrl to extract IP', async () => {
    vi.resetModules();
    const { parseMasterIp } = await import('./config.js');

    expect(parseMasterIp('ws://89.167.4.124:9900')).toBe('89.167.4.124');
    expect(parseMasterIp('ws://192.168.1.1:8080')).toBe('192.168.1.1');
  });
});
