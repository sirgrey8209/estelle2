/**
 * @file utils/buildInfo.ts
 * @description 빌드 정보 (환경별 버전 표시)
 */

export const BuildInfo = {
  /** 환경: dev, stage, release */
  env: import.meta.env?.VITE_BUILD_ENV ?? 'dev',

  /** 빌드 버전: vMMDD_N (dev에서는 빈 문자열) */
  version: import.meta.env?.VITE_BUILD_VERSION ?? '',

  /** 빌드 시간 */
  buildTime: import.meta.env?.VITE_BUILD_TIME ?? new Date().toISOString(),

  /** 앱 이름 */
  appName: 'Estelle',

  /** 표시용: "(dev)" 또는 "(stage)v0207_1" */
  get display(): string {
    return this.version ? `(${this.env})${this.version}` : `(${this.env})`;
  },
} as const;
