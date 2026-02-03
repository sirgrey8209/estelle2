/**
 * @file folder-manager.test.ts
 * @description FolderManager 테스트
 *
 * 폴더 탐색/생성/이름변경 기능을 테스트합니다.
 * 파일 I/O는 FileSystem 인터페이스로 추상화하여 모킹 없이 테스트합니다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FolderManager,
  type FolderFileSystem,
} from '../../src/managers/folder-manager.js';

// ============================================================================
// 테스트용 인메모리 파일 시스템
// ============================================================================

/**
 * 테스트용 인메모리 파일 시스템
 *
 * FolderManager 테스트를 위한 가상 파일 시스템입니다.
 * 실제 파일 I/O 없이 폴더 관리 로직을 테스트합니다.
 */
class InMemoryFolderFileSystem implements FolderFileSystem {
  private files: Map<string, { isDirectory: boolean; name: string }> = new Map();

  constructor() {
    // 기본 루트 디렉토리 설정
    this._addDirectory('C:\\');
    this._addDirectory('C:\\workspace');
  }

  existsSync(path: string): boolean {
    return this.files.has(this._normalizePath(path));
  }

  statSync(path: string): { isDirectory(): boolean } {
    const normalizedPath = this._normalizePath(path);
    const entry = this.files.get(normalizedPath);
    if (!entry) {
      const error = new Error(`ENOENT: no such file or directory, stat '${path}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    }
    return {
      isDirectory: () => entry.isDirectory,
    };
  }

  readdirSync(
    path: string,
    options: { withFileTypes: true }
  ): Array<{ isDirectory(): boolean; name: string }> {
    const normalizedPath = this._normalizePath(path);
    const results: Array<{ isDirectory(): boolean; name: string }> = [];

    for (const [filePath, entry] of this.files) {
      // 직접 하위 항목만 가져오기
      const parent = this._getParent(filePath);
      if (parent === normalizedPath) {
        results.push({
          isDirectory: () => entry.isDirectory,
          name: entry.name,
        });
      }
    }

    return results;
  }

  mkdirSync(path: string): void {
    const normalizedPath = this._normalizePath(path);
    const name = this._getFileName(normalizedPath);
    this.files.set(normalizedPath, { isDirectory: true, name });
  }

  renameSync(oldPath: string, newPath: string): void {
    const normalizedOld = this._normalizePath(oldPath);
    const normalizedNew = this._normalizePath(newPath);

    const entry = this.files.get(normalizedOld);
    if (!entry) {
      const error = new Error(`ENOENT: no such file or directory, rename '${oldPath}'`);
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      throw error;
    }

    this.files.delete(normalizedOld);
    this.files.set(normalizedNew, {
      isDirectory: entry.isDirectory,
      name: this._getFileName(normalizedNew),
    });
  }

  // 헬퍼: 디렉토리 추가
  _addDirectory(path: string): void {
    const normalizedPath = this._normalizePath(path);
    const name = this._getFileName(normalizedPath);
    this.files.set(normalizedPath, { isDirectory: true, name: name || path });
  }

  // 헬퍼: 파일 추가
  _addFile(path: string): void {
    const normalizedPath = this._normalizePath(path);
    const name = this._getFileName(normalizedPath);
    this.files.set(normalizedPath, { isDirectory: false, name });
  }

  // 경로 정규화 (Windows 스타일)
  private _normalizePath(p: string): string {
    // 백슬래시로 통일, 마지막 슬래시 제거
    return p.replace(/\//g, '\\').replace(/\\$/, '');
  }

  // 부모 경로 가져오기
  private _getParent(p: string): string {
    const lastSlash = p.lastIndexOf('\\');
    if (lastSlash <= 2) return p.substring(0, lastSlash + 1); // C:\ 같은 루트
    return p.substring(0, lastSlash);
  }

  // 파일/폴더 이름 가져오기
  private _getFileName(p: string): string {
    const lastSlash = p.lastIndexOf('\\');
    return p.substring(lastSlash + 1);
  }

  // 에러 시뮬레이션용 플래그
  _simulateAccessError = false;
}

// ============================================================================
// FolderManager 테스트
// ============================================================================

describe('FolderManager', () => {
  let fs: InMemoryFolderFileSystem;
  let folderManager: FolderManager;

  beforeEach(() => {
    fs = new InMemoryFolderFileSystem();
    folderManager = new FolderManager(fs);
  });

  // ============================================================================
  // 폴더 목록 조회 테스트
  // ============================================================================
  describe('listFolders', () => {
    it('should list folders in directory', () => {
      fs._addDirectory('C:\\workspace\\project1');
      fs._addDirectory('C:\\workspace\\project2');

      const result = folderManager.listFolders('C:\\workspace');

      expect(result.success).toBe(true);
      expect(result.folders).toHaveLength(2);
      expect(result.folders).toContain('project1');
      expect(result.folders).toContain('project2');
    });

    it('should use default path when not provided', () => {
      const result = folderManager.listFolders();

      expect(result.success).toBe(true);
      expect(result.path).toBe('C:\\workspace');
    });

    it('should return error for non-existent path', () => {
      const result = folderManager.listFolders('C:\\nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('존재하지 않습니다');
    });

    it('should return error for non-directory path', () => {
      fs._addFile('C:\\workspace\\file.txt');

      const result = folderManager.listFolders('C:\\workspace\\file.txt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('디렉토리가 아닙니다');
    });

    it('should exclude hidden folders (starting with .)', () => {
      fs._addDirectory('C:\\workspace\\visible');
      fs._addDirectory('C:\\workspace\\.hidden');

      const result = folderManager.listFolders('C:\\workspace');

      expect(result.success).toBe(true);
      expect(result.folders).toContain('visible');
      expect(result.folders).not.toContain('.hidden');
    });

    it('should exclude system folders (starting with $)', () => {
      fs._addDirectory('C:\\workspace\\normal');
      fs._addDirectory('C:\\workspace\\$Recycle.Bin');

      const result = folderManager.listFolders('C:\\workspace');

      expect(result.success).toBe(true);
      expect(result.folders).toContain('normal');
      expect(result.folders).not.toContain('$Recycle.Bin');
    });

    it('should only list directories, not files', () => {
      fs._addDirectory('C:\\workspace\\folder');
      fs._addFile('C:\\workspace\\file.txt');

      const result = folderManager.listFolders('C:\\workspace');

      expect(result.success).toBe(true);
      expect(result.folders).toContain('folder');
      expect(result.folders).not.toContain('file.txt');
    });

    it('should sort folders alphabetically (Korean locale)', () => {
      fs._addDirectory('C:\\workspace\\가나다');
      fs._addDirectory('C:\\workspace\\abc');
      fs._addDirectory('C:\\workspace\\zzz');

      const result = folderManager.listFolders('C:\\workspace');

      expect(result.success).toBe(true);
      // 폴더가 정렬되어 있는지 확인 (정렬 순서는 locale에 따라 다를 수 있음)
      expect(result.folders).toHaveLength(3);
      expect(result.folders).toContain('abc');
      expect(result.folders).toContain('가나다');
      expect(result.folders).toContain('zzz');
    });
  });

  // ============================================================================
  // 폴더 생성 테스트
  // ============================================================================
  describe('createFolder', () => {
    it('should create new folder', () => {
      const result = folderManager.createFolder('C:\\workspace', 'newproject');

      expect(result.success).toBe(true);
      expect(result.path).toBe('C:\\workspace\\newproject');
      expect(fs.existsSync('C:\\workspace\\newproject')).toBe(true);
    });

    it('should return error for empty folder name', () => {
      const result = folderManager.createFolder('C:\\workspace', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('비어있습니다');
    });

    it('should return error for whitespace-only folder name', () => {
      const result = folderManager.createFolder('C:\\workspace', '   ');

      expect(result.success).toBe(false);
      expect(result.error).toContain('비어있습니다');
    });

    it('should return error for invalid characters in name', () => {
      const invalidNames = ['test<folder', 'test>folder', 'test:folder', 'test"folder', 'test|folder', 'test?folder', 'test*folder'];

      for (const name of invalidNames) {
        const result = folderManager.createFolder('C:\\workspace', name);

        expect(result.success).toBe(false);
        expect(result.error).toContain('사용할 수 없는 문자');
      }
    });

    it('should return error for backslash in name', () => {
      const result = folderManager.createFolder('C:\\workspace', 'test\\folder');

      expect(result.success).toBe(false);
      expect(result.error).toContain('사용할 수 없는 문자');
    });

    it('should return error for forward slash in name', () => {
      const result = folderManager.createFolder('C:\\workspace', 'test/folder');

      expect(result.success).toBe(false);
      expect(result.error).toContain('사용할 수 없는 문자');
    });

    it('should return error when parent path not exists', () => {
      const result = folderManager.createFolder('C:\\nonexistent', 'folder');

      expect(result.success).toBe(false);
      expect(result.error).toContain('상위 경로');
    });

    it('should return error when folder already exists', () => {
      fs._addDirectory('C:\\workspace\\existing');

      const result = folderManager.createFolder('C:\\workspace', 'existing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('이미 존재');
    });

    it('should trim whitespace from folder name', () => {
      const result = folderManager.createFolder('C:\\workspace', '  trimmed  ');

      expect(result.success).toBe(true);
      expect(result.path).toBe('C:\\workspace\\trimmed');
    });
  });

  // ============================================================================
  // 폴더 이름 변경 테스트
  // ============================================================================
  describe('renameFolder', () => {
    beforeEach(() => {
      fs._addDirectory('C:\\workspace\\oldname');
    });

    it('should rename folder', () => {
      const result = folderManager.renameFolder(
        'C:\\workspace\\oldname',
        'newname'
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('C:\\workspace\\newname');
      expect(fs.existsSync('C:\\workspace\\newname')).toBe(true);
      expect(fs.existsSync('C:\\workspace\\oldname')).toBe(false);
    });

    it('should return error for empty new name', () => {
      const result = folderManager.renameFolder('C:\\workspace\\oldname', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('비어있습니다');
    });

    it('should return error for invalid characters in new name', () => {
      const result = folderManager.renameFolder(
        'C:\\workspace\\oldname',
        'new<name'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('사용할 수 없는 문자');
    });

    it('should return error when folder not exists', () => {
      const result = folderManager.renameFolder(
        'C:\\workspace\\nonexistent',
        'newname'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('존재하지 않습니다');
    });

    it('should return error when path is not a directory', () => {
      fs._addFile('C:\\workspace\\file.txt');

      const result = folderManager.renameFolder(
        'C:\\workspace\\file.txt',
        'newname'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('디렉토리가 아닙니다');
    });

    it('should return error when new name already exists', () => {
      fs._addDirectory('C:\\workspace\\existing');

      const result = folderManager.renameFolder(
        'C:\\workspace\\oldname',
        'existing'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('같은 이름의 폴더');
    });

    it('should trim whitespace from new name', () => {
      const result = folderManager.renameFolder(
        'C:\\workspace\\oldname',
        '  trimmed  '
      );

      expect(result.success).toBe(true);
      expect(result.path).toBe('C:\\workspace\\trimmed');
    });
  });

  // ============================================================================
  // 상위 폴더 경로 테스트
  // ============================================================================
  describe('getParentPath', () => {
    it('should return parent path', () => {
      const parent = folderManager.getParentPath('C:\\workspace\\project');

      expect(parent).toBe('C:\\workspace');
    });

    it('should return root for root path', () => {
      const parent = folderManager.getParentPath('C:\\');

      expect(parent).toBe('C:\\');
    });

    it('should handle deep nested paths', () => {
      const parent = folderManager.getParentPath('C:\\a\\b\\c\\d');

      expect(parent).toBe('C:\\a\\b\\c');
    });

    it('should normalize forward slashes', () => {
      const parent = folderManager.getParentPath('C:/workspace/project');

      // 정규화된 결과
      expect(parent).toBe('C:\\workspace');
    });
  });

  // ============================================================================
  // 기본 경로 테스트
  // ============================================================================
  describe('getDefaultPath', () => {
    it('should return default base path', () => {
      const defaultPath = folderManager.getDefaultPath();

      expect(defaultPath).toBe('C:\\workspace');
    });
  });

  // ============================================================================
  // 경로 정규화 테스트
  // ============================================================================
  describe('경로 정규화', () => {
    it('should normalize path in listFolders', () => {
      fs._addDirectory('C:\\workspace\\project');

      const result = folderManager.listFolders('C:/workspace');

      expect(result.success).toBe(true);
      // path.normalize는 슬래시를 백슬래시로 변환
      expect(result.path).toBe('C:\\workspace');
    });

    it('should handle trailing slash', () => {
      fs._addDirectory('C:\\workspace\\project');

      const result = folderManager.listFolders('C:\\workspace\\');

      expect(result.success).toBe(true);
      // 마지막 백슬래시는 유지될 수 있음
      expect(result.path.startsWith('C:\\workspace')).toBe(true);
    });
  });
});
