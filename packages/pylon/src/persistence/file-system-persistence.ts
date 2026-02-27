/**
 * @file file-system-persistence.ts
 * @description 파일 시스템 기반 영속성 구현
 *
 * 워크스페이스와 공유 데이터를 JSON 파일로 저장/로드합니다.
 * 메시지는 SQLite MessageStore에서 직접 관리합니다.
 *
 * 저장 구조:
 * ```
 * {baseDir}/
 *   workspaces.json         # 워크스페이스 목록
 *   shares.json             # 공유 목록
 *   account.json            # 계정 정보
 * ```
 *
 * @example
 * ```typescript
 * import * as fs from 'fs';
 * import { FileSystemPersistence } from './file-system-persistence.js';
 *
 * const persistence = new FileSystemPersistence('./data', fs);
 *
 * // 워크스페이스 로드/저장
 * const data = persistence.loadWorkspaceStore();
 * await persistence.saveWorkspaceStore(newData);
 * ```
 */

import type { PersistenceAdapter, PersistedAccount } from './types.js';
import type { WorkspaceStoreData } from '../stores/workspace-store.js';
import type { ShareStoreData } from '../stores/share-store.js';

/**
 * 파일시스템 인터페이스 (테스트 용이성을 위한 추상화)
 */
export interface FileSystemInterface {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
  writeFileSync(path: string, data: string, encoding: string): void;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  readdirSync(path: string): string[];
  unlinkSync(path: string): void;
}

/**
 * 파일 시스템 기반 영속성 어댑터
 *
 * @description
 * 워크스페이스와 메시지 데이터를 파일 시스템에 JSON 형식으로 저장합니다.
 * 파일시스템 인터페이스를 주입받아 테스트 용이성을 확보합니다.
 */
export class FileSystemPersistence implements PersistenceAdapter {
  private readonly baseDir: string;
  private readonly workspacesPath: string;
  private readonly sharesPath: string;
  private readonly accountPath: string;
  private readonly fs: FileSystemInterface;

  /**
   * FileSystemPersistence 생성자
   *
   * @param baseDir - 데이터 저장 기본 디렉토리
   * @param fs - 파일시스템 인터페이스 (기본: Node.js fs)
   */
  constructor(baseDir: string, fs: FileSystemInterface) {
    this.baseDir = baseDir;
    this.workspacesPath = this.joinPath(baseDir, 'workspaces.json');
    this.sharesPath = this.joinPath(baseDir, 'shares.json');
    this.accountPath = this.joinPath(baseDir, 'account.json');
    this.fs = fs;

    // 디렉토리 생성
    this.ensureDirectories();
  }

  /**
   * 필요한 디렉토리 생성
   */
  private ensureDirectories(): void {
    this.fs.mkdirSync(this.baseDir, { recursive: true });
  }

  /**
   * 경로 결합 (플랫폼 독립적)
   */
  private joinPath(...parts: string[]): string {
    return parts.join('/').replace(/\/+/g, '/');
  }

  // ============================================================================
  // WorkspaceStore
  // ============================================================================

  /**
   * WorkspaceStore 데이터 로드
   */
  loadWorkspaceStore(): WorkspaceStoreData | undefined {
    try {
      if (!this.fs.existsSync(this.workspacesPath)) {
        return undefined;
      }

      const content = this.fs.readFileSync(this.workspacesPath, 'utf-8');
      return JSON.parse(content) as WorkspaceStoreData;
    } catch (error) {
      console.error('[Persistence] Failed to load workspace store:', error);
      return undefined;
    }
  }

  /**
   * WorkspaceStore 데이터 저장
   */
  async saveWorkspaceStore(data: WorkspaceStoreData): Promise<void> {
    // 런타임 중 폴더가 삭제될 수 있으므로 저장 전 확인
    if (!this.fs.existsSync(this.baseDir)) {
      this.fs.mkdirSync(this.baseDir, { recursive: true });
    }
    const content = JSON.stringify(data, null, 2);
    this.fs.writeFileSync(this.workspacesPath, content, 'utf-8');
  }

  // ============================================================================
  // ShareStore
  // ============================================================================

  /**
   * ShareStore 데이터 로드
   */
  loadShareStore(): ShareStoreData | undefined {
    try {
      if (!this.fs.existsSync(this.sharesPath)) {
        return undefined;
      }

      const content = this.fs.readFileSync(this.sharesPath, 'utf-8');
      return JSON.parse(content) as ShareStoreData;
    } catch (error) {
      console.error('[Persistence] Failed to load share store:', error);
      return undefined;
    }
  }

  /**
   * ShareStore 데이터 저장
   */
  async saveShareStore(data: ShareStoreData): Promise<void> {
    // 런타임 중 폴더가 삭제될 수 있으므로 저장 전 확인
    if (!this.fs.existsSync(this.baseDir)) {
      this.fs.mkdirSync(this.baseDir, { recursive: true });
    }
    const content = JSON.stringify(data, null, 2);
    this.fs.writeFileSync(this.sharesPath, content, 'utf-8');
  }

  // ============================================================================
  // Account
  // ============================================================================

  /**
   * 마지막 계정 정보 로드
   */
  loadLastAccount(): PersistedAccount | undefined {
    try {
      if (!this.fs.existsSync(this.accountPath)) {
        return undefined;
      }

      const content = this.fs.readFileSync(this.accountPath, 'utf-8');
      return JSON.parse(content) as PersistedAccount;
    } catch (error) {
      console.error('[Persistence] Failed to load account:', error);
      return undefined;
    }
  }

  /**
   * 계정 정보 저장
   */
  async saveLastAccount(account: PersistedAccount): Promise<void> {
    // 런타임 중 폴더가 삭제될 수 있으므로 저장 전 확인
    if (!this.fs.existsSync(this.baseDir)) {
      this.fs.mkdirSync(this.baseDir, { recursive: true });
    }
    const content = JSON.stringify(account, null, 2);
    this.fs.writeFileSync(this.accountPath, content, 'utf-8');
  }
}
