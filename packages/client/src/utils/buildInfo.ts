/**
 * @file utils/buildInfo.ts
 * @description 빌드 정보 (웹)
 */

/**
 * 빌드 정보
 */
export const BuildInfo = {
  /** 앱 버전 */
  version: import.meta.env?.VITE_APP_VERSION ?? '2.0.0',

  /** 커밋 해시 (빌드 시 주입) */
  commit: import.meta.env?.VITE_COMMIT_HASH ?? 'dev',

  /** 빌드 시간 (빌드 시 주입) */
  buildTime: import.meta.env?.VITE_BUILD_TIME ?? new Date().toISOString(),

  /** 앱 이름 */
  appName: 'Estelle',
} as const;

/**
 * 버전 비교
 * @returns 0: 같음, 1: local이 최신, -1: remote가 최신
 */
export function compareVersions(local: string, remote: string): number {
  const localParts = local.split('.').map(Number);
  const remoteParts = remote.split('.').map(Number);

  for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
    const l = localParts[i] ?? 0;
    const r = remoteParts[i] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }

  return 0;
}
