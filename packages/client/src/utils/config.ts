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
 *
 * 클라이언트는 항상 Relay에서 서빙되므로 window.location.host를 사용
 */
function deriveRelayUrl(): string {
  // 브라우저 환경이 아니면 (테스트 등) dev URL 반환
  if (typeof window === 'undefined') {
    return 'ws://localhost:3000';
  }

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'ws://localhost:3000';
  }

  // Relay에서 서빙되므로 현재 호스트 사용, protocol에 따라 ws/wss 결정
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
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

// ============================================================================
// Platform 설정 (Pylon에서 전달받은 값 사용)
// ============================================================================

export type PlatformType = 'windows' | 'linux';

/**
 * 플랫폼별 경로 유틸리티
 */
export const PlatformUtils = {
  /** 경로 구분자 */
  getSeparator: (platform: PlatformType): string =>
    platform === 'windows' ? '\\' : '/',

  /** 루트 경로 여부 확인 */
  isRootPath: (path: string, platform: PlatformType): boolean => {
    if (platform === 'windows') {
      // C:\ 또는 빈 문자열 (드라이브 목록)
      return path === '' || /^[A-Z]:\\?$/i.test(path);
    }
    return path === '/' || path === '';
  },

  /** 드라이브 루트 여부 (Windows 전용) */
  isDriveRoot: (path: string): boolean =>
    /^[A-Z]:$/i.test(path),

  /** 경로에서 폴더명 추출 */
  getFolderName: (path: string, platform: PlatformType): string => {
    const sep = platform === 'windows' ? /[/\\]/ : /\//;
    const name = path.split(sep).filter(Boolean).pop() || '';
    // Windows 드라이브 루트(C:)는 이름으로 사용하지 않음
    if (platform === 'windows' && /^[A-Z]:$/i.test(name)) {
      return '';
    }
    return name;
  },

  /** 상위 경로 계산 */
  getParentPath: (path: string, platform: PlatformType): string | null => {
    if (platform === 'windows') {
      const parts = path.split(/[/\\]/).filter(Boolean);
      if (parts.length <= 1) {
        // 드라이브 루트 또는 그 이상 → 드라이브 목록으로
        return '';
      }
      parts.pop();
      // 드라이브 루트인 경우 백슬래시 추가
      if (parts.length === 1 && /^[A-Z]:$/i.test(parts[0])) {
        return `${parts[0]}\\`;
      }
      return parts.join('\\');
    } else {
      // Linux
      if (path === '/' || path === '') return null;
      const parts = path.split('/').filter(Boolean);
      if (parts.length <= 1) return '/';
      parts.pop();
      return '/' + parts.join('/');
    }
  },

  /** 경로 결합 */
  joinPath: (basePath: string, folderName: string, platform: PlatformType): string => {
    const sep = PlatformUtils.getSeparator(platform);
    if (platform === 'windows') {
      // 드라이브 루트(C:\)인 경우
      if (/^[A-Z]:\\?$/i.test(basePath)) {
        const drive = basePath.replace(/\\$/, '');
        return `${drive}\\${folderName}`;
      }
      return `${basePath}${sep}${folderName}`;
    } else {
      // Linux
      if (basePath === '/') {
        return `/${folderName}`;
      }
      return `${basePath}/${folderName}`;
    }
  },
} as const;

