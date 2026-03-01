/**
 * PM2 Manager Tests
 *
 * Tests for the PM2 service management module using spawnSync.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'child_process';

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}));

describe('pm2Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('stopService', () => {
    it('should stop pm2 service by name', async () => {
      const mockSpawnSync = vi.mocked(spawnSync);
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        pid: 123,
        output: [],
        signal: null,
      });

      const { stopService } = await import('./pm2-manager.js');
      stopService('estelle-pylon');

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'pm2',
        ['delete', 'estelle-pylon'],
        expect.any(Object)
      );
    });

    it('should not throw on already stopped service', async () => {
      const mockSpawnSync = vi.mocked(spawnSync);
      mockSpawnSync.mockImplementation(() => {
        throw new Error('Process not found');
      });

      const { stopService } = await import('./pm2-manager.js');

      // Should not throw
      expect(() => stopService('estelle-pylon')).not.toThrow();
    });
  });

  describe('startService', () => {
    it('should start pm2 service with config', async () => {
      const mockSpawnSync = vi.mocked(spawnSync);
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        pid: 123,
        output: [],
        signal: null,
      });

      const { startService } = await import('./pm2-manager.js');
      const result = startService({
        name: 'estelle-relay',
        script: 'dist/bin.js',
        cwd: '/app/relay',
        env: { PORT: '8080' },
      });

      expect(result.success).toBe(true);
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'pm2',
        ['start', 'dist/bin.js', '--name', 'estelle-relay', '--cwd', '/app/relay'],
        expect.objectContaining({
          stdio: 'inherit',
          env: expect.objectContaining({ PORT: '8080' }),
        })
      );
    });

    it('should return error on failed start', async () => {
      const mockSpawnSync = vi.mocked(spawnSync);
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('Failed to start'),
        pid: 123,
        output: [],
        signal: null,
      });

      const { startService } = await import('./pm2-manager.js');
      const result = startService({
        name: 'estelle-relay',
        script: 'dist/bin.js',
        cwd: '/app/relay',
      });

      expect(result.success).toBe(false);
    });
  });
});
