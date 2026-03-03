/**
 * @file utils/buildInfo.ts
 * @description 빌드 정보 (빌드 시점에 임베드된 버전 사용)
 */

import { CLIENT_VERSION } from '../version';

/**
 * 환경 감지: 빌드 버전이 'dev'이면 개발 환경
 */
const env = CLIENT_VERSION === 'dev' ? 'dev' : 'release';

/**
 * 버전 정보 초기화 및 테마 적용
 * 앱 시작 시 한 번 호출됩니다.
 */
export async function loadVersionInfo(): Promise<void> {
  // 환경별 테마 클래스 적용
  applyEnvTheme(env);

  // 환경별 document.title 적용
  document.title = BuildInfo.appName;
}

/**
 * 환경별 테마 클래스를 <html> 태그에 적용합니다.
 * dev/stage/release 환경에 따라 메인 컬러가 달라집니다.
 */
function applyEnvTheme(env: string): void {
  const html = document.documentElement;

  // 기존 환경 클래스 제거
  html.classList.remove('env-dev', 'env-stage', 'env-release');

  // 새 환경 클래스 추가
  html.classList.add(`env-${env}`);
}

export const BuildInfo = {
  /** 환경: dev, release */
  get env(): string { return env; },

  /** 빌드 버전: vMMDD_N (dev에서는 'dev') */
  get version(): string { return CLIENT_VERSION; },

  /** 앱 이름 - 버전 포함 */
  get appName(): string {
    return `Estelle (${CLIENT_VERSION})`;
  },

  /** 표시용: 버전 문자열 */
  get display(): string {
    return CLIENT_VERSION;
  },
};
