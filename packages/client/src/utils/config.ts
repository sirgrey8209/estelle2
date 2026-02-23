/**
 * @file utils/config.ts
 * @description 앱 설정
 */

/**
 * 개발 모드 감지 (Vite 환경)
 */
const isDev = import.meta.env?.DEV ?? false;

/**
 * Relay URL을 런타임에 결정
 * - localhost → ws://localhost:3000 (dev)
 * - 그 외 → wss://{host} (stage/release 자동 구분)
 */
function deriveRelayUrl(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'ws://localhost:3000';
  }
  return `wss://${typeof window !== 'undefined' ? window.location.host : 'your-app-name.fly.dev'}`;
}

/**
 * Relay 서버 설정
 */
export const RelayConfig = {
  /** Relay 서버 URL */
  url: deriveRelayUrl(),

  /** 재연결 시도 횟수 */
  maxReconnectAttempts: 5,

  /** 재연결 간격 (ms) */
  reconnectInterval: 3000,

  /** 하트비트 간격 (ms) */
  heartbeatInterval: 30000,

  /** 연결 타임아웃 (ms) */
  connectionTimeout: 10000,
} as const;

/**
 * 이미지 캐시 설정
 */
export const ImageCacheConfig = {
  /** 최대 캐시 크기 (bytes) - 기본 50MB */
  maxSize: 50 * 1024 * 1024,

  /** 캐시 만료 시간 (ms) - 기본 1시간 */
  expireTime: 60 * 60 * 1000,
} as const;

/**
 * 앱 설정
 */
export const AppConfig = {
  /** 디버그 모드 */
  debug: isDev,

  /** 앱 타이틀 (웹) */
  title: isDev ? 'Estelle (dev)' : 'Estelle',

  /** 최대 메시지 수 (per desk) */
  maxMessages: 1000,

  /** 최대 배포 로그 수 */
  maxDeployLogs: 100,

  /** 입력창 최대 높이 */
  inputBarMaxHeight: 200,
} as const;

/**
 * GitHub 설정
 * TODO: 실제 배포 시 GitHub 저장소 URL로 변경 필요
 */
export const GitHubConfig = {
  /** 릴리즈 베이스 URL */
  releaseBaseUrl: 'https://github.com/your-username/estelle/releases/download/deploy',

  /** APK 파일명 */
  apkFilename: 'app-release.apk',

  /** Windows ZIP 파일명 */
  windowsFilename: 'estelle-windows.zip',
} as const;
