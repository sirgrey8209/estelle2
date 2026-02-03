/**
 * @file folder-manager.ts
 * @description FolderManager - 폴더 탐색/생성/이름변경
 *
 * 새 워크스페이스 다이얼로그에서 사용하는 폴더 관리 기능을 제공합니다.
 * 파일 I/O는 FolderFileSystem 인터페이스로 추상화하여 테스트 용이성을 확보합니다.
 *
 * 기능:
 * - 폴더 목록 조회 (숨김/시스템 폴더 제외)
 * - 폴더 생성 (유효성 검사 포함)
 * - 폴더 이름 변경
 * - 상위 폴더 경로 조회
 *
 * @example
 * ```typescript
 * import fs from 'fs';
 * import { FolderManager } from './managers/folder-manager.js';
 *
 * // 실제 파일 시스템으로 초기화
 * const folderManager = new FolderManager(fs);
 *
 * // 폴더 목록 조회
 * const result = folderManager.listFolders('C:\\workspace');
 * console.log(result.folders);
 *
 * // 폴더 생성
 * folderManager.createFolder('C:\\workspace', 'new-project');
 * ```
 */

import path from 'path';

// ============================================================================
// 타입 정의
// ============================================================================

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
 * 폴더 목록 조회 결과
 */
export interface ListFoldersResult {
  /** 성공 여부 */
  success: boolean;

  /** 정규화된 경로 */
  path: string;

  /** 폴더 이름 목록 */
  folders: string[];

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

/** 기본 베이스 경로 */
const DEFAULT_BASE_PATH = 'C:\\workspace';

/** 폴더명에 사용할 수 없는 문자 패턴 (Windows) */
const INVALID_CHARS_PATTERN = /[<>:"/\\|?*]/;

// ============================================================================
// FolderManager 클래스
// ============================================================================

/**
 * FolderManager - 폴더 탐색/생성/이름변경
 *
 * @description
 * 새 워크스페이스 다이얼로그에서 폴더를 탐색하고 관리하는 기능을 제공합니다.
 * 파일 I/O는 FolderFileSystem 인터페이스로 추상화하여 테스트 용이성을 확보합니다.
 *
 * 설계 원칙:
 * - 파일 시스템 추상화: 테스트 시 인메모리 구현 사용 가능
 * - 경로 정규화: Windows 스타일 경로로 통일
 * - 유효성 검사: 폴더명 특수문자 체크
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

  /**
   * FolderManager 생성자
   *
   * @param fileSystem - 파일 시스템 구현체
   */
  constructor(fileSystem: FolderFileSystem) {
    this.fs = fileSystem;
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
   * @param targetPath - 조회할 경로 (기본값: C:\workspace)
   * @returns 폴더 목록 조회 결과
   */
  listFolders(targetPath: string = DEFAULT_BASE_PATH): ListFoldersResult {
    try {
      // 경로 정규화 (Windows 스타일)
      const normalizedPath = path.normalize(targetPath);

      // 경로 존재 확인
      if (!this.fs.existsSync(normalizedPath)) {
        return {
          success: false,
          path: normalizedPath,
          folders: [],
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
          error: '디렉토리가 아닙니다.',
        };
      }

      // 폴더 목록 조회
      const entries = this.fs.readdirSync(normalizedPath, { withFileTypes: true });
      const folders = entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => !entry.name.startsWith('.'))  // 숨김 폴더 제외
        .filter((entry) => !entry.name.startsWith('$'))  // 시스템 폴더 제외
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, 'ko'));       // 한글 정렬

      return {
        success: true,
        path: normalizedPath,
        folders,
      };
    } catch (err) {
      const error = err as Error;
      console.error('[FolderManager] listFolders error:', error.message);
      return {
        success: false,
        path: targetPath,
        folders: [],
        error: error.message,
      };
    }
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

      // 특수문자 검사 (Windows 금지 문자)
      if (INVALID_CHARS_PATTERN.test(folderName)) {
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

      // 특수문자 검사
      if (INVALID_CHARS_PATTERN.test(newName)) {
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
    return DEFAULT_BASE_PATH;
  }
}
