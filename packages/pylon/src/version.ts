/**
 * @file version.ts
 * @description 버전 로더 모듈
 *
 * 빌드 시 생성된 version.json 파일을 읽어 버전 정보를 제공합니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface VersionInfo {
  version: string;
  buildTime: string;
}

let cachedVersion: VersionInfo | null = null;

/**
 * 버전 정보를 로드합니다.
 *
 * @description
 * config/version.json 파일을 읽어 버전 정보를 반환합니다.
 * 한 번 로드된 버전 정보는 캐싱됩니다.
 *
 * 경로: dist/version.js → dist → pylon → packages → estelle2 → config/version.json
 *
 * @returns 버전 정보 객체
 */
export function loadVersion(): VersionInfo {
  if (cachedVersion) return cachedVersion;

  // dist/version.js → dist → pylon → packages → estelle2 → config/version.json
  const versionPath = path.resolve(__dirname, '..', '..', '..', 'config', 'version.json');

  try {
    const raw = fs.readFileSync(versionPath, 'utf-8');
    cachedVersion = JSON.parse(raw);
    return cachedVersion!;
  } catch {
    cachedVersion = { version: 'dev', buildTime: new Date().toISOString() };
    return cachedVersion;
  }
}

/**
 * 버전 문자열을 반환합니다.
 *
 * @returns 버전 문자열 (예: "v0303_1")
 */
export function getVersion(): string {
  return loadVersion().version;
}
