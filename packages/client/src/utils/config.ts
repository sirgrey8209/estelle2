/**
 * @file utils/config.ts
 * @description 앱 설정
 */

/**
 * Relay 서버 설정
 */
export const RelayConfig = {
  /** Relay 서버 URL */
  url: process.env.EXPO_PUBLIC_RELAY_URL ?? 'wss://estelle-relay.example.com',

  /** 로컬 개발 URL */
  localUrl: 'ws://localhost:8080',

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
  debug: __DEV__,

  /** 최대 메시지 수 (per desk) */
  maxMessages: 1000,

  /** 최대 배포 로그 수 */
  maxDeployLogs: 100,

  /** 입력창 최대 높이 */
  inputBarMaxHeight: 200,
} as const;

/**
 * GitHub 설정
 */
export const GitHubConfig = {
  /** 릴리즈 베이스 URL */
  releaseBaseUrl: 'https://github.com/sirgrey8209/estelle/releases/download/deploy',

  /** APK 파일명 */
  apkFilename: 'app-release.apk',

  /** Windows ZIP 파일명 */
  windowsFilename: 'estelle-windows.zip',
} as const;
