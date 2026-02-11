/**
 * @file pylon-client.ts
 * @description PylonClient - MCP 도구에서 PylonMcpServer로 요청을 보내는 TCP 클라이언트
 *
 * MCP 도구에서 link/unlink/list 요청을 처리한다.
 *
 * 프로토콜:
 * - 요청: { "action": "link", "entityId": 2049, "path": "docs/spec.md" }
 * - 요청: { "action": "unlink", "entityId": 2049, "path": "docs/spec.md" }
 * - 요청: { "action": "list", "entityId": 2049 }
 * - 응답: { "success": true, "docs": [...] }
 * - 응답: { "success": false, "error": "..." }
 */

import net from 'net';
import type { LinkedDocument } from '@estelle/core';

// ============================================================================
// 상수
// ============================================================================

/** 기본 포트 (Pylon TCP 서버) - 환경변수로 오버라이드 가능 */
const DEFAULT_PORT = parseInt(process.env['ESTELLE_MCP_PORT'] || '9880', 10);

/** 기본 타임아웃 (5초) */
const DEFAULT_TIMEOUT = 5000;

// ============================================================================
// 타입 정의
// ============================================================================

/** PylonClient 옵션 */
export interface PylonClientOptions {
  port?: number;
  timeout?: number;
}

/** Link 결과 타입 */
export interface LinkResult {
  success: boolean;
  docs?: LinkedDocument[];
  error?: string;
}

/** 파일 정보 타입 */
interface FileInfo {
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  description: string | null;
}

/** SendFile 결과 타입 */
export interface SendFileResult {
  success: boolean;
  file?: FileInfo;
  error?: string;
}

/** 요청 타입 */
interface PylonRequest {
  action: 'link' | 'unlink' | 'list' | 'send_file';
  entityId: number;
  path?: string;
  description?: string;
}

// ============================================================================
// PylonClient 클래스
// ============================================================================

/**
 * PylonClient - MCP 서버에서 PylonMcpServer TCP 서버로 요청을 보내는 클라이언트
 *
 * 싱글턴 패턴으로 구현되어 MCP 도구들이 동일한 인스턴스를 공유할 수 있다.
 */
export class PylonClient {
  // ============================================================================
  // Static 필드 (싱글턴)
  // ============================================================================

  private static _instance: PylonClient | null = null;

  // ============================================================================
  // Private 필드
  // ============================================================================

  private _port: number;
  private _timeout: number;

  // ============================================================================
  // 생성자
  // ============================================================================

  constructor(options?: PylonClientOptions) {
    this._port = options?.port ?? DEFAULT_PORT;
    this._timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  }

  // ============================================================================
  // 싱글턴 메서드
  // ============================================================================

  /**
   * 싱글턴 인스턴스 반환
   */
  static getInstance(): PylonClient {
    if (!PylonClient._instance) {
      PylonClient._instance = new PylonClient();
    }
    return PylonClient._instance;
  }

  /**
   * 싱글턴 인스턴스 리셋 (테스트용)
   */
  static resetInstance(): void {
    PylonClient._instance = null;
  }

  // ============================================================================
  // 공개 속성
  // ============================================================================

  /** 포트 번호 */
  get port(): number {
    return this._port;
  }

  /** 타임아웃 (밀리초) */
  get timeout(): number {
    return this._timeout;
  }

  // ============================================================================
  // 공개 메서드
  // ============================================================================

  /**
   * 문서 연결
   *
   * @param entityId 대화 엔티티 ID
   * @param path 문서 경로
   * @returns Link 결과
   * @throws 연결 실패, 타임아웃
   */
  async link(entityId: number, path: string): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'link',
      entityId,
      path,
    });
  }

  /**
   * 문서 연결 해제
   *
   * @param entityId 대화 엔티티 ID
   * @param path 문서 경로
   * @returns Link 결과
   * @throws 연결 실패, 타임아웃
   */
  async unlink(entityId: number, path: string): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'unlink',
      entityId,
      path,
    });
  }

  /**
   * 연결된 문서 목록 조회
   *
   * @param entityId 대화 엔티티 ID
   * @returns Link 결과
   * @throws 연결 실패, 타임아웃
   */
  async list(entityId: number): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'list',
      entityId,
    });
  }

  /**
   * 파일 전송
   *
   * @param entityId 대화 엔티티 ID
   * @param path 파일 경로
   * @param description 파일 설명 (선택)
   * @returns SendFile 결과
   * @throws 연결 실패, 타임아웃
   */
  async sendFile(
    entityId: number,
    path: string,
    description?: string,
  ): Promise<SendFileResult> {
    return this._sendRequest<SendFileResult>({
      action: 'send_file',
      entityId,
      path,
      description,
    });
  }

  // ============================================================================
  // Private 메서드
  // ============================================================================

  /**
   * TCP 요청 전송
   */
  private _sendRequest<T>(request: PylonRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ port: this._port, host: '127.0.0.1' });
      let buffer = '';
      let timeoutId: NodeJS.Timeout | null = null;

      // 정리 함수
      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        socket.removeAllListeners();
        socket.destroy();
      };

      // 타임아웃 설정
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Request timeout'));
      }, this._timeout);

      // 연결 성공
      socket.on('connect', () => {
        socket.write(JSON.stringify(request));
      });

      // 데이터 수신
      socket.on('data', (data) => {
        buffer += data.toString();

        try {
          const response = JSON.parse(buffer) as T;
          cleanup();
          resolve(response);
        } catch {
          // 아직 완전한 JSON이 아님 - 더 기다림
        }
      });

      // 연결 에러
      socket.on('error', (err) => {
        cleanup();
        reject(err);
      });

      // 연결 종료 (응답 없이)
      socket.on('close', () => {
        // 이미 처리된 경우 무시
        if (timeoutId) {
          cleanup();
          reject(new Error('Connection closed without response'));
        }
      });
    });
  }
}
