// scripts/deploy/version.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('generateVersion', () => {
  const counterPath = '/tmp/test-build-counter.json';

  beforeEach(() => {
    if (fs.existsSync(counterPath)) {
      fs.unlinkSync(counterPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(counterPath)) {
      fs.unlinkSync(counterPath);
    }
    vi.useRealTimers();
  });

  it('should generate version with date and counter', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15'));

    const { generateVersion } = await import('./version.js');
    const version = generateVersion(counterPath);

    expect(version).toBe('v0315_1');
  });

  it('should increment counter on same day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15'));

    const { generateVersion } = await import('./version.js');
    generateVersion(counterPath);
    const version2 = generateVersion(counterPath);

    expect(version2).toBe('v0315_2');
  });

  it('should reset counter on new day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15'));

    const { generateVersion } = await import('./version.js');
    generateVersion(counterPath);

    vi.setSystemTime(new Date('2026-03-16'));
    // Need fresh import to reset module cache
    vi.resetModules();
    const { generateVersion: genV2 } = await import('./version.js');
    const version = genV2(counterPath);

    expect(version).toBe('v0316_1');
  });
});
