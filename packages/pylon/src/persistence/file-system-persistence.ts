/**
 * @file file-system-persistence.ts
 * @description 파일 시스템 기반 영속성 구현
 *
 * 워크스페이스와 메시지 데이터를 JSON 파일로 저장/로드합니다.
 *
 * 저장 구조:
 * ```
 * {baseDir}/
 *   workspaces.json         # 워크스페이스 목록
 *   messages/
 *     {sessionId}.json      # 세션별 메시지
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
 *
 * // 메시지 세션 로드/저장
 * const session = persistence.loadMessageSession('session-1');
 * await persistence.saveMessageSession('session-1', sessionData);
 * ```
 */

import type { PersistenceAdapter } from './types.js';
import type { WorkspaceStoreData } from '../stores/workspace-store.js';
import type { SessionData } from '../stores/message-store.js';

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
  private readonly messagesDir: string;
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
    this.messagesDir = this.joinPath(baseDir, 'messages');
    this.fs = fs;

    // 디렉토리 생성
    this.ensureDirectories();
  }

  /**
   * 필요한 디렉토리 생성
   */
  private ensureDirectories(): void {
    this.fs.mkdirSync(this.baseDir, { recursive: true });
    this.fs.mkdirSync(this.messagesDir, { recursive: true });
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
  // MessageStore (세션 단위)
  // ============================================================================

  /**
   * 세션 파일 경로 생성
   */
  private getSessionPath(sessionId: string): string {
    return this.joinPath(this.messagesDir, `${sessionId}.json`);
  }

  /**
   * 메시지 세션 로드
   */
  loadMessageSession(sessionId: string): SessionData | undefined {
    try {
      const sessionPath = this.getSessionPath(sessionId);

      if (!this.fs.existsSync(sessionPath)) {
        return undefined;
      }

      const content = this.fs.readFileSync(sessionPath, 'utf-8');
      return JSON.parse(content) as SessionData;
    } catch (error) {
      console.error(`[Persistence] Failed to load session ${sessionId}:`, error);
      return undefined;
    }
  }

  /**
   * 메시지 세션 저장
   */
  async saveMessageSession(sessionId: string, data: SessionData): Promise<void> {
    // 런타임 중 폴더가 삭제될 수 있으므로 저장 전 확인
    if (!this.fs.existsSync(this.messagesDir)) {
      this.fs.mkdirSync(this.messagesDir, { recursive: true });
    }
    const sessionPath = this.getSessionPath(sessionId);
    const content = JSON.stringify(data, null, 2);
    this.fs.writeFileSync(sessionPath, content, 'utf-8');
  }

  /**
   * 메시지 세션 삭제
   */
  async deleteMessageSession(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);

    if (this.fs.existsSync(sessionPath)) {
      this.fs.unlinkSync(sessionPath);
    }
  }

  /**
   * 저장된 모든 세션 ID 목록
   */
  listMessageSessions(): string[] {
    try {
      if (!this.fs.existsSync(this.messagesDir)) {
        return [];
      }

      const files = this.fs.readdirSync(this.messagesDir);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
    } catch (error) {
      console.error('[Persistence] Failed to list sessions:', error);
      return [];
    }
  }
}
