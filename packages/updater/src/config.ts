/**
 * Configuration loader for estelle-updater
 */
import fs from 'fs';
import path from 'path';
import type { UpdaterConfig } from './types.js';

export function loadConfig(configPath: string): UpdaterConfig {
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as UpdaterConfig;
}

export function parseMasterIp(masterUrl: string): string {
  // ws://5.223.72.58:9900 → 5.223.72.58
  const url = new URL(masterUrl);
  return url.hostname;
}

export function getDefaultConfigPath(): string {
  // Find repo root by looking for package.json with workspaces
  let dir = process.cwd();
  let prevDir = '';
  while (dir !== prevDir) {  // Cross-platform: stops when dirname no longer changes
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.workspaces) {
        return path.join(dir, 'config', 'updater.json');
      }
    }
    prevDir = dir;
    dir = path.dirname(dir);
  }
  return path.join(process.cwd(), 'config', 'updater.json');
}
