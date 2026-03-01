/**
 * Builder Module for Deploy Process
 *
 * Wraps `pnpm build` to compile TypeScript packages.
 * Returns a structured result indicating success or failure.
 *
 * This module is part of the cross-platform deploy script system,
 * providing a consistent interface for build operations across
 * different environments.
 */
import { execSync } from 'child_process';

export interface BuildResult {
  success: boolean;
  error?: string;
}

export async function build(repoRoot: string): Promise<BuildResult> {
  try {
    execSync('pnpm build', {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
