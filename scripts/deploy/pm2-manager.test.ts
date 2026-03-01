import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('pm2Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('stopService', () => {
    it('should stop pm2 service by name', async () => {
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue(Buffer.from(''));

      const { stopService } = await import('./pm2-manager.js');
      stopService('estelle-pylon');

      expect(mockExecSync).toHaveBeenCalledWith(
        'pm2 delete estelle-pylon',
        expect.any(Object)
      );
    });

    it('should not throw on already stopped service', async () => {
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation(() => {
        throw new Error('Process not found');
      });

      vi.resetModules();
      const { stopService } = await import('./pm2-manager.js');

      // Should not throw
      expect(() => stopService('estelle-pylon')).not.toThrow();
    });
  });

  describe('startService', () => {
    it('should start pm2 service with config', async () => {
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue(Buffer.from(''));

      vi.resetModules();
      const { startService } = await import('./pm2-manager.js');
      const result = startService({
        name: 'estelle-relay',
        script: 'dist/bin.js',
        cwd: '/app/relay',
        env: { PORT: '8080' },
      });

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalled();
    });
  });
});
