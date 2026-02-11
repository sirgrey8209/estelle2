/**
 * @file credential-manager.ts
 * @description 인증 파일(.credentials.json) 관리 모듈
 *
 * Claude Code 계정 전환 기능을 위한 인증 파일 관리를 담당합니다.
 *
 * 주요 기능:
 * - 현재 활성 계정 정보 조회
 * - 인증 파일 스왑 (계정 전환)
 * - 백업 파일에서 복원
 *
 * 디렉토리 구조:
 * - configDir: CLAUDE_CONFIG_DIR (예: ~/.claude-dev/)
 *   - .credentials.json: 활성 인증 파일
 * - backupDir: 인증 백업 디렉토리 (예: ~/.claude-credentials/)
 *   - linegames.json: 회사 계정 인증
 *   - personal.json: 개인 계정 인증
 *
 * @example
 * ```typescript
 * const manager = new CredentialManager({
 *   configDir: process.env.HOME + '/.claude-dev',
 *   backupDir: process.env.HOME + '/.claude-credentials',
 * });
 *
 * // 현재 계정 확인
 * const account = await manager.getCurrentAccount();
 * console.log(account); // { account: 'linegames', subscriptionType: 'team' }
 *
 * // 계정 전환
 * await manager.switchAccount('personal');
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AccountType } from '@estelle/core';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 계정 정보
 */
export interface AccountInfo {
  /** 계정 타입 */
  account: AccountType;
  /** 구독 타입 (team, max 등) */
  subscriptionType: string;
}

/**
 * CredentialManager 옵션
 */
export interface CredentialManagerOptions {
  /** CLAUDE_CONFIG_DIR 경로 */
  configDir: string;
  /** 인증 백업 디렉토리 경로 */
  backupDir: string;
}

/**
 * 인증 파일 구조 (일부)
 */
interface CredentialsFile {
  claudeAiOauth?: {
    subscriptionType?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ============================================================================
// CredentialManager 클래스
// ============================================================================

/**
 * CredentialManager - 인증 파일 관리 클래스
 *
 * @description
 * Claude Code 인증 파일을 관리하고 계정 전환을 처리합니다.
 *
 * 동작 방식:
 * 1. 백업 디렉토리에서 계정별 인증 파일 보관
 * 2. 계정 전환 시 백업 파일을 configDir/.credentials.json으로 복사
 * 3. subscriptionType으로 현재 계정 타입 판별
 *
 * @example
 * ```typescript
 * const manager = new CredentialManager({
 *   configDir: '/home/user/.claude-dev',
 *   backupDir: '/home/user/.claude-credentials',
 * });
 *
 * // 계정 전환
 * await manager.switchAccount('personal');
 * ```
 */
export class CredentialManager {
  private readonly configDir: string;
  private readonly backupDir: string;

  /**
   * CredentialManager 생성자
   *
   * @param options - 설정 옵션
   */
  constructor(options: CredentialManagerOptions) {
    this.configDir = options.configDir;
    this.backupDir = options.backupDir;
  }

  // ==========================================================================
  // Public 메서드
  // ==========================================================================

  /**
   * 현재 활성 계정 정보 조회
   *
   * @description
   * configDir/.credentials.json 파일을 읽어 현재 활성 계정을 판별합니다.
   * subscriptionType으로 계정을 구분합니다:
   * - 'team' → 'linegames' (회사 계정)
   * - 'max' → 'personal' (개인 계정)
   *
   * @returns 계정 정보 또는 null (파일 없거나 읽기 실패)
   */
  async getCurrentAccount(): Promise<AccountInfo | null> {
    const credentialsPath = this.getCredentialsPath();

    try {
      if (!fs.existsSync(credentialsPath)) {
        return null;
      }

      const content = await fs.promises.readFile(credentialsPath, 'utf-8');
      const credentials: CredentialsFile = JSON.parse(content);

      const subscriptionType = credentials.claudeAiOauth?.subscriptionType;
      if (!subscriptionType) {
        return null;
      }

      const account = this.subscriptionToAccount(subscriptionType);
      return {
        account,
        subscriptionType,
      };
    } catch (error) {
      console.error('[CredentialManager] Failed to read credentials:', error);
      return null;
    }
  }

  /**
   * 계정 전환 (인증 파일 스왑)
   *
   * @description
   * 백업 디렉토리에서 지정된 계정의 인증 파일을 가져와
   * configDir/.credentials.json에 복사합니다.
   *
   * @param account - 전환할 계정 ('linegames' | 'personal')
   * @throws 백업 파일이 없는 경우 에러
   */
  async switchAccount(account: AccountType): Promise<void> {
    const backupPath = this.getBackupPath(account);
    const credentialsPath = this.getCredentialsPath();

    // 백업 파일 존재 확인
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found for account: ${account} (${backupPath})`);
    }

    // 파일 복사
    await fs.promises.copyFile(backupPath, credentialsPath);

    console.log(`[CredentialManager] Switched to account: ${account}`);
  }

  /**
   * 백업 파일 존재 여부 확인
   *
   * @param account - 확인할 계정
   * @returns 백업 파일 존재 여부
   */
  async hasBackup(account: AccountType): Promise<boolean> {
    const backupPath = this.getBackupPath(account);
    return fs.existsSync(backupPath);
  }

  /**
   * 사용 가능한 계정 목록 조회
   *
   * @returns 백업이 존재하는 계정 목록
   */
  async getAvailableAccounts(): Promise<AccountType[]> {
    const accounts: AccountType[] = [];

    if (await this.hasBackup('linegames')) {
      accounts.push('linegames');
    }
    if (await this.hasBackup('personal')) {
      accounts.push('personal');
    }

    return accounts;
  }

  // ==========================================================================
  // Private 메서드
  // ==========================================================================

  /**
   * 인증 파일 경로 반환
   */
  private getCredentialsPath(): string {
    return path.join(this.configDir, '.credentials.json');
  }

  /**
   * 백업 파일 경로 반환
   */
  private getBackupPath(account: AccountType): string {
    return path.join(this.backupDir, `${account}.json`);
  }

  /**
   * subscriptionType을 AccountType으로 변환
   */
  private subscriptionToAccount(subscriptionType: string): AccountType {
    switch (subscriptionType) {
      case 'team':
        return 'linegames';
      case 'max':
        return 'personal';
      default:
        // 알 수 없는 타입은 기본적으로 personal로 처리
        console.warn(`[CredentialManager] Unknown subscription type: ${subscriptionType}`);
        return 'personal';
    }
  }
}
