import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run pnpm build in repo root', async () => {
    const mockExecSync = vi.mocked(execSync);
    mockExecSync.mockReturnValue(Buffer.from('Build complete'));

    const { build } = await import('./builder.js');
    const result = await build('/test/repo');

    expect(mockExecSync).toHaveBeenCalledWith('pnpm build', {
      cwd: '/test/repo',
      stdio: 'inherit',
    });
    expect(result.success).toBe(true);
  });

  it('should return error on build failure', async () => {
    const mockExecSync = vi.mocked(execSync);
    mockExecSync.mockImplementation(() => {
      throw new Error('Build failed');
    });

    vi.resetModules();
    const { build } = await import('./builder.js');
    const result = await build('/test/repo');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Build failed');
  });
});
