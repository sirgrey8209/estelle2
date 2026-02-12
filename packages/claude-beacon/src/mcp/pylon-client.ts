/**
 * @file pylon-client.ts
 * @description PylonClient - MCP 도구에서 PylonMcpServer로 요청을 보내는 TCP 클라이언트
 *
 * MCP 도구에서 link/unlink/list 요청을 처리한다.
 * 싱글턴 제거: BeaconClient lookup 응답의 mcpHost:mcpPort로 동적 연결.
 *
 * 프로토콜:
 * - 요청: { "action": "link", "conversationId": 2049, "path": "docs/spec.md" }
 * - 요청: { "action": "unlink", "conversationId": 2049, "path": "docs/spec.md" }
 * - 요청: { "action": "list", "conversationId": 2049 }
 * - 응답: { "success": true, "docs": [...] }
 * - 응답: { "success": false, "error": "..." }
 */

import net from 'net';
import type { LinkedDocument } from '@estelle/core';

// ============================================================================
// 상수
// ============================================================================

/** 기본 타임아웃 (5초) */
const DEFAULT_TIMEOUT = 5000;

// ============================================================================
// 타입 정의
// ============================================================================

/** PylonClient 옵션 */
export interface PylonClientOptions {
  /** MCP 서버 호스트 */
  host: string;
  /** MCP 서버 포트 */
  port: number;
  /** 타임아웃 (밀리초) */
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
  conversationId: number;
  path?: string;
  description?: string;
}

// ============================================================================
// PylonClient 클래스
// ============================================================================

/**
 * PylonClient - MCP 서버에서 PylonMcpServer TCP 서버로 요청을 보내는 클라이언트
 *
 * 싱글턴 패턴 제거: 각 요청마다 host:port를 지정하여 동적으로 연결.
 * BeaconClient lookup 결과에서 받은 mcpHost, mcpPort로 연결한다.
 */
export class PylonClient {
  // ============================================================================
  // Private 필드
  // ============================================================================

  private _host: string;
  private _port: number;
  private _timeout: number;

  // ============================================================================
  // 생성자
  // ============================================================================

  constructor(options: PylonClientOptions) {
    this._host = options.host;
    this._port = options.port;
    this._timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  // ============================================================================
  // 공개 속성
  // ============================================================================

  /** 호스트 */
  get host(): string {
    return this._host;
  }

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
   * @param conversationId 대화 ID
   * @param path 문서 경로
   * @returns Link 결과
   * @throws 연결 실패, 타임아웃
   */
  async link(conversationId: number, path: string): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'link',
      conversationId,
      path,
    });
  }

  /**
   * 문서 연결 해제
   *
   * @param conversationId 대화 ID
   * @param path 문서 경로
   * @returns Link 결과
   * @throws 연결 실패, 타임아웃
   */
  async unlink(conversationId: number, path: string): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'unlink',
      conversationId,
      path,
    });
  }

  /**
   * 연결된 문서 목록 조회
   *
   * @param conversationId 대화 ID
   * @returns Link 결과
   * @throws 연결 실패, 타임아웃
   */
  async list(conversationId: number): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'list',
      conversationId,
    });
  }

  /**
   * 파일 전송
   *
   * @param conversationId 대화 ID
   * @param path 파일 경로
   * @param description 파일 설명 (선택)
   * @returns SendFile 결과
   * @throws 연결 실패, 타임아웃
   */
  async sendFile(
    conversationId: number,
    path: string,
    description?: string,
  ): Promise<SendFileResult> {
    return this._sendRequest<SendFileResult>({
      action: 'send_file',
      conversationId,
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
      const socket = net.createConnection({ port: this._port, host: this._host });
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
