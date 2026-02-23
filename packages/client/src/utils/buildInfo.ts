/**
 * @file utils/buildInfo.ts
 * @description 빌드 정보 (런타임에 version.json에서 로드)
 */

interface VersionInfo {
  env: string;
  version: string;
  buildTime: string;
}

/** 버전 정보 (fetch 전에는 기본값) */
let versionInfo: VersionInfo = { env: 'dev', version: '', buildTime: '' };

/**
 * version.json에서 버전 정보를 로드합니다.
 * 앱 시작 시 한 번 호출됩니다.
 * 로드 후 환경별 테마 클래스를 적용합니다.
 */
export async function loadVersionInfo(): Promise<void> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (res.ok) {
      versionInfo = await res.json();
    }
  } catch {
    // fetch 실패 시 기본값 유지 (dev)
  }

  // 환경별 테마 클래스 적용
  applyEnvTheme(versionInfo.env);

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
  /** 환경: dev, stage, release */
  get env(): string { return versionInfo.env; },

  /** 빌드 버전: vMMDD_N (dev에서는 빈 문자열) */
  get version(): string { return versionInfo.version; },

  /** 빌드 시간 */
  get buildTime(): string { return versionInfo.buildTime; },

  /** 앱 이름 (환경별: Estelle, Estelle - stage, Estelle - dev) */
  get appName(): string {
    if (this.env === 'release') return 'Estelle';
    return `Estelle - ${this.env}`;
  },

  /** 표시용: "(dev)" 또는 "(stage)v0207_1" */
  get display(): string {
    return this.version ? `(${this.env})${this.version}` : `(${this.env})`;
  },
};
