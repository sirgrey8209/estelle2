/**
 * @file folder-manager.ts
 * @description FolderManager - 폴더 탐색/생성/이름변경 (크로스 플랫폼)
 *
 * 새 워크스페이스 다이얼로그에서 사용하는 폴더 관리 기능을 제공합니다.
 * 파일 I/O는 FolderFileSystem 인터페이스로 추상화하여 테스트 용이성을 확보합니다.
 *
 * 기능:
 * - 폴더 목록 조회 (숨김/시스템 폴더 제외)
 * - 폴더 생성 (유효성 검사 포함)
 * - 폴더 이름 변경
 * - 상위 폴더 경로 조회
 * - 크로스 플랫폼 지원 (Windows/Linux)
 *
 * @example
 * ```typescript
 * import fs from 'fs';
 * import { FolderManager } from './managers/folder-manager.js';
 *
 * // 실제 파일 시스템으로 초기화 (플랫폼 자동 감지)
 * const folderManager = new FolderManager(fs);
 *
 * // 또는 명시적 플랫폼 지정
 * const folderManager = new FolderManager(fs, { platform: 'windows', defaultPath: 'C:\\WorkSpace' });
 *
 * // 폴더 목록 조회
 * const result = folderManager.listFolders('C:\\workspace');
 * console.log(result.folders);
 * console.log(result.platform); // 'windows' | 'linux'
 *
 * // 폴더 생성
 * folderManager.createFolder('C:\\workspace', 'new-project');
 * ```
 */

import path from 'path';
import os from 'os';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 플랫폼 타입
 */
export type PlatformType = 'windows' | 'linux';

/**
 * 플랫폼 설정 옵션
 */
export interface PlatformOptions {
  /** 플랫폼 (기본값: 자동 감지) */
  platform?: PlatformType;
  /** 기본 경로 (기본값: 플랫폼별 기본값) */
  defaultPath?: string;
}

/**
 * 디렉토리 엔트리 (readdirSync 결과 타입)
 */
interface DirEntry {
  isDirectory(): boolean;
  name: string;
}

/**
 * 폴더 파일 시스템 인터페이스
 *
 * @description
 * 폴더 관리에 필요한 파일 시스템 작업을 추상화합니다.
 * Node.js fs 모듈과 호환되는 인터페이스입니다.
 */
export interface FolderFileSystem {
  /** 경로 존재 여부 확인 */
  existsSync(path: string): boolean;

  /** 경로 정보 조회 */
  statSync(path: string): { isDirectory(): boolean };

  /** 디렉토리 내용 조회 (withFileTypes 옵션 필수) */
  readdirSync(
    path: string,
    options: { withFileTypes: true }
  ): Array<DirEntry>;

  /** 디렉토리 생성 */
  mkdirSync(path: string): void;

  /** 파일/디렉토리 이름 변경 */
  renameSync(oldPath: string, newPath: string): void;
}

/**
 * hasChildren이 포함된 폴더 정보
 */
export interface FolderInfo {
  /** 폴더 이름 */
  name: string;
  /** 하위 폴더 유무 */
  hasChildren: boolean;
}

/**
 * 폴더 목록 조회 결과
 */
export interface ListFoldersResult {
  /** 성공 여부 */
  success: boolean;

  /** 정규화된 경로 */
  path: string;

  /** 폴더 이름 목록 (하위 호환용) */
  folders: string[];

  /** 폴더 정보 목록 (hasChildren 포함) */
  foldersWithChildren: FolderInfo[];

  /** 플랫폼 (windows | linux) */
  platform: PlatformType;

  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 드라이브 정보
 */
export interface DriveInfo {
  /** 드라이브 경로 (예: 'C:\\' 또는 '/') */
  path: string;
  /** 드라이브 레이블 (예: 'C:' 또는 '/') */
  label: string;
  /** 하위 폴더 유무 */
  hasChildren: boolean;
}

/**
 * 드라이브 목록 조회 결과
 */
export interface ListDrivesResult {
  /** 성공 여부 */
  success: boolean;
  /** 드라이브 목록 */
  drives: DriveInfo[];
  /** 플랫폼 (windows | linux) */
  platform: PlatformType;
  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 폴더 생성/이름변경 결과
 */
export interface FolderOperationResult {
  /** 성공 여부 */
  success: boolean;

  /** 생성/변경된 폴더 경로 */
  path?: string;

  /** 에러 메시지 (실패 시) */
  error?: string;
}

// ============================================================================
// 상수
// ============================================================================

/** Windows 기본 경로 */
const WINDOWS_DEFAULT_PATH = 'C:\\WorkSpace';

/** Linux 기본 경로 */
const LINUX_DEFAULT_PATH = process.env['HOME'] || '/home';

/** Windows: 폴더명에 사용할 수 없는 문자 패턴 */
const WINDOWS_INVALID_CHARS_PATTERN = /[<>:"/\\|?*\x00-\x1f]/;

/** Linux: 폴더명에 사용할 수 없는 문자 패턴 (/ 와 null byte) */
const LINUX_INVALID_CHARS_PATTERN = /[/\0]/;

// ============================================================================
// FolderManager 클래스
// ============================================================================

/**
 * FolderManager - 폴더 탐색/생성/이름변경 (크로스 플랫폼)
 *
 * @description
 * 새 워크스페이스 다이얼로그에서 폴더를 탐색하고 관리하는 기능을 제공합니다.
 * 파일 I/O는 FolderFileSystem 인터페이스로 추상화하여 테스트 용이성을 확보합니다.
 *
 * 설계 원칙:
 * - 파일 시스템 추상화: 테스트 시 인메모리 구현 사용 가능
 * - 크로스 플랫폼: Windows/Linux 모두 지원
 * - 유효성 검사: 폴더명 특수문자 체크 (플랫폼별)
 *
 * @example
 * ```typescript
 * import fs from 'fs';
 * import { FolderManager } from './managers/folder-manager.js';
 *
 * const folderManager = new FolderManager(fs);
 *
 * // 폴더 목록 조회
 * const result = folderManager.listFolders('C:\\workspace');
 *
 * // 폴더 생성
 * folderManager.createFolder('C:\\workspace', 'new-project');
 *
 * // 폴더 이름 변경
 * folderManager.renameFolder('C:\\workspace\\old', 'new');
 *
 * // 상위 폴더 경로
 * const parent = folderManager.getParentPath('C:\\workspace\\project');
 * ```
 */
export class FolderManager {
  /** 파일 시스템 인터페이스 */
  private readonly fs: FolderFileSystem;

  /** 플랫폼 */
  private readonly platform: PlatformType;

  /** 기본 경로 */
  private readonly defaultPath: string;

  /**
   * FolderManager 생성자
   *
   * @param fileSystem - 파일 시스템 구현체
   * @param options - 플랫폼 설정 옵션
   */
  constructor(fileSystem: FolderFileSystem, options?: PlatformOptions) {
    this.fs = fileSystem;

    // 플랫폼 결정: 옵션 > 환경변수 > 자동 감지
    const envPlatform = process.env['PYLON_PLATFORM'] as PlatformType | undefined;
    this.platform = options?.platform || envPlatform || this.detectPlatform();

    // 기본 경로 결정: 옵션 > 환경변수 > 플랫폼 기본값
    const envDefaultPath = process.env['PYLON_DEFAULT_PATH'];
    this.defaultPath = options?.defaultPath || envDefaultPath ||
      (this.platform === 'windows' ? WINDOWS_DEFAULT_PATH : LINUX_DEFAULT_PATH);
  }

  /**
   * 현재 플랫폼 감지
   */
  private detectPlatform(): PlatformType {
    return os.platform() === 'win32' ? 'windows' : 'linux';
  }

  /**
   * 현재 플랫폼 반환
   */
  getPlatform(): PlatformType {
    return this.platform;
  }

  /**
   * 폴더명 유효성 검사 패턴 반환
   */
  private getInvalidCharsPattern(): RegExp {
    return this.platform === 'windows'
      ? WINDOWS_INVALID_CHARS_PATTERN
      : LINUX_INVALID_CHARS_PATTERN;
  }

  // ============================================================================
  // 폴더 목록 조회
  // ============================================================================

  /**
   * 폴더 목록 조회
   *
   * @description
   * 지정된 경로의 폴더 목록을 반환합니다.
   * 숨김 폴더(.으로 시작)와 시스템 폴더($로 시작)는 제외됩니다.
   * 한글 기준으로 알파벳 순 정렬됩니다.
   *
   * @param targetPath - 조회할 경로 (기본값: 플랫폼별 기본 경로)
   * @returns 폴더 목록 조회 결과
   */
  listFolders(targetPath: string = this.defaultPath): ListFoldersResult {
    try {
      // 빈 경로면 기본 경로 사용
      const effectivePath = targetPath || this.defaultPath;

      // 경로 정규화
      const normalizedPath = path.normalize(effectivePath);

      // 경로 존재 확인
      if (!this.fs.existsSync(normalizedPath)) {
        return {
          success: false,
          path: normalizedPath,
          folders: [],
          foldersWithChildren: [],
          platform: this.platform,
          error: '경로가 존재하지 않습니다.',
        };
      }

      // 디렉토리인지 확인
      const stat = this.fs.statSync(normalizedPath);
      if (!stat.isDirectory()) {
        return {
          success: false,
          path: normalizedPath,
          folders: [],
          foldersWithChildren: [],
          platform: this.platform,
          error: '디렉토리가 아닙니다.',
        };
      }

      // 폴더 목록 조회
      const entries = this.fs.readdirSync(normalizedPath, { withFileTypes: true });
      const folderNames = entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => !entry.name.startsWith('.'))  // 숨김 폴더 제외
        .filter((entry) => !entry.name.startsWith('$'))  // 시스템 폴더 제외
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, 'ko'));       // 한글 정렬

      // 각 폴더의 하위 폴더 유무 확인
      const foldersWithChildren: FolderInfo[] = folderNames.map((name) => {
        const folderPath = path.join(normalizedPath, name);
        const hasChildren = this.checkHasChildren(folderPath);
        return { name, hasChildren };
      });

      return {
        success: true,
        path: normalizedPath,
        folders: folderNames,
        foldersWithChildren,
        platform: this.platform,
      };
    } catch (err) {
      const error = err as Error;
      console.error('[FolderManager] listFolders error:', error.message);
      return {
        success: false,
        path: targetPath,
        folders: [],
        foldersWithChildren: [],
        platform: this.platform,
        error: error.message,
      };
    }
  }

  /**
   * 폴더에 하위 디렉토리가 있는지 확인
   *
   * @description
   * 숨김 폴더(.으로 시작)와 시스템 폴더($로 시작)는 제외합니다.
   *
   * @param folderPath - 확인할 폴더 경로
   * @returns 하위 폴더 유무
   */
  private checkHasChildren(folderPath: string): boolean {
    try {
      const entries = this.fs.readdirSync(folderPath, { withFileTypes: true });
      return entries.some(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          !entry.name.startsWith('$')
      );
    } catch {
      return false;
    }
  }

  /**
   * 드라이브(루트) 목록 조회
   *
   * @description
   * Windows: 사용 가능한 드라이브 목록 (A-Z 스캔)
   * Linux: 루트 '/'를 단일 항목으로 반환
   *
   * @returns 드라이브 목록 조회 결과
   */
  listDrives(): ListDrivesResult {
    try {
      if (this.platform === 'windows') {
        return this.listWindowsDrives();
      } else {
        return {
          success: true,
          drives: [{
            path: '/',
            label: '/',
            hasChildren: this.checkHasChildren('/'),
          }],
          platform: this.platform,
        };
      }
    } catch (err) {
      const error = err as Error;
      console.error('[FolderManager] listDrives error:', error.message);
      return {
        success: false,
        drives: [],
        platform: this.platform,
        error: error.message,
      };
    }
  }

  /**
   * Windows 드라이브 목록 조회
   */
  private listWindowsDrives(): ListDrivesResult {
    const drives: DriveInfo[] = [];

    // A-Z 드라이브 스캔
    for (let i = 65; i <= 90; i++) {
      const driveLetter = String.fromCharCode(i);
      const drivePath = `${driveLetter}:\\`;

      try {
        if (this.fs.existsSync(drivePath)) {
          drives.push({
            path: drivePath,
            label: `${driveLetter}:`,
            hasChildren: this.checkHasChildren(drivePath),
          });
        }
      } catch {
        // 드라이브 접근 실패 시 무시
      }
    }

    return {
      success: true,
      drives,
      platform: this.platform,
    };
  }

  // ============================================================================
  // 폴더 생성
  // ============================================================================

  /**
   * 폴더 생성
   *
   * @description
   * 지정된 부모 경로에 새 폴더를 생성합니다.
   * 폴더명 유효성을 검사하고 중복을 체크합니다.
   *
   * @param parentPath - 부모 경로
   * @param folderName - 생성할 폴더 이름
   * @returns 폴더 생성 결과
   */
  createFolder(parentPath: string, folderName: string): FolderOperationResult {
    try {
      // 폴더명 유효성 검사
      if (!folderName || folderName.trim() === '') {
        return { success: false, error: '폴더 이름이 비어있습니다.' };
      }

      // 특수문자 검사 (플랫폼별)
      if (this.getInvalidCharsPattern().test(folderName)) {
        return {
          success: false,
          error: '폴더 이름에 사용할 수 없는 문자가 포함되어 있습니다.',
        };
      }

      const normalizedParent = path.normalize(parentPath);
      const newFolderPath = path.join(normalizedParent, folderName.trim());

      // 부모 경로 존재 확인
      if (!this.fs.existsSync(normalizedParent)) {
        return { success: false, error: '상위 경로가 존재하지 않습니다.' };
      }

      // 이미 존재하는지 확인
      if (this.fs.existsSync(newFolderPath)) {
        return { success: false, error: '이미 존재하는 폴더입니다.' };
      }

      // 폴더 생성
      this.fs.mkdirSync(newFolderPath);
      console.log(`[FolderManager] Created folder: ${newFolderPath}`);

      return {
        success: true,
        path: newFolderPath,
      };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      console.error('[FolderManager] createFolder error:', error.message);
      return {
        success: false,
        error: error.code === 'EACCES' ? '권한이 없습니다.' : error.message,
      };
    }
  }

  // ============================================================================
  // 폴더 이름 변경
  // ============================================================================

  /**
   * 폴더 이름 변경
   *
   * @description
   * 기존 폴더의 이름을 변경합니다.
   * 새 이름의 유효성을 검사하고 중복을 체크합니다.
   *
   * @param folderPath - 변경할 폴더 전체 경로
   * @param newName - 새 이름
   * @returns 이름 변경 결과
   */
  renameFolder(folderPath: string, newName: string): FolderOperationResult {
    try {
      // 새 이름 유효성 검사
      if (!newName || newName.trim() === '') {
        return { success: false, error: '새 이름이 비어있습니다.' };
      }

      // 특수문자 검사 (플랫폼별)
      if (this.getInvalidCharsPattern().test(newName)) {
        return {
          success: false,
          error: '폴더 이름에 사용할 수 없는 문자가 포함되어 있습니다.',
        };
      }

      const normalizedPath = path.normalize(folderPath);

      // 경로 존재 확인
      if (!this.fs.existsSync(normalizedPath)) {
        return { success: false, error: '폴더가 존재하지 않습니다.' };
      }

      // 디렉토리인지 확인
      const stat = this.fs.statSync(normalizedPath);
      if (!stat.isDirectory()) {
        return { success: false, error: '디렉토리가 아닙니다.' };
      }

      const parentDir = path.dirname(normalizedPath);
      const newPath = path.join(parentDir, newName.trim());

      // 이미 존재하는지 확인
      if (this.fs.existsSync(newPath)) {
        return { success: false, error: '같은 이름의 폴더가 이미 존재합니다.' };
      }

      // 이름 변경
      this.fs.renameSync(normalizedPath, newPath);
      console.log(`[FolderManager] Renamed folder: ${normalizedPath} -> ${newPath}`);

      return {
        success: true,
        path: newPath,
      };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      console.error('[FolderManager] renameFolder error:', error.message);
      return {
        success: false,
        error: error.code === 'EACCES' ? '권한이 없습니다.' : error.message,
      };
    }
  }

  // ============================================================================
  // 유틸리티 메서드
  // ============================================================================

  /**
   * 상위 폴더 경로 반환
   *
   * @description
   * 현재 경로의 상위 폴더 경로를 반환합니다.
   * 루트까지 올라갔으면 현재 경로를 반환합니다.
   *
   * @param currentPath - 현재 경로
   * @returns 상위 경로
   */
  getParentPath(currentPath: string): string {
    const normalizedPath = path.normalize(currentPath);
    const parentPath = path.dirname(normalizedPath);

    // 루트까지 올라갔으면 현재 경로 반환
    if (parentPath === normalizedPath) {
      return normalizedPath;
    }

    return parentPath;
  }

  /**
   * 기본 경로 반환
   *
   * @returns 기본 베이스 경로
   */
  getDefaultPath(): string {
    return this.defaultPath;
  }
}
