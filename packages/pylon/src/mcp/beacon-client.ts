/**
 * @file beacon-client.ts
 * @description BeaconClient - MCP 서버에서 BeaconServer로 toolUseId lookup 요청을 보내는 TCP 클라이언트
 *
 * MCP 도구에서 toolUseId로 해당 도구 호출이 어느 Pylon에서 발생했는지 조회한다.
 *
 * 프로토콜:
 * - 요청: { "action": "lookup", "toolUseId": "toolu_xxx" }
 * - 응답: { "success": true, "pylonAddress": "...", "entityId": 123, "raw": {...} }
 */

import net from 'net';

// ============================================================================
// 상수
// ============================================================================

/** 기본 포트 (ClaudeBeacon TCP 서버) */
const DEFAULT_PORT = 9875;

/** 기본 타임아웃 (5초) */
const DEFAULT_TIMEOUT = 5000;

// ============================================================================
// 타입 정의
// ============================================================================

/** BeaconClient 옵션 */
export interface BeaconClientOptions {
  port?: number;
  timeout?: number;
}

/** Tool use raw 데이터 */
export interface ToolUseRaw {
  type: string;
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Lookup 성공 결과 */
export interface LookupSuccessResult {
  success: true;
  pylonAddress: string;
  entityId: number;
  raw: ToolUseRaw;
}

/** Lookup 실패 결과 */
export interface LookupFailureResult {
  success: false;
  error: string;
}

/** Lookup 결과 타입 */
export type LookupResult = LookupSuccessResult | LookupFailureResult;

/** Lookup 요청 */
interface LookupRequest {
  action: 'lookup';
  toolUseId: string;
}

// ============================================================================
// BeaconClient 클래스
// ============================================================================

/**
 * BeaconClient - MCP 서버에서 BeaconServer TCP 서버로 요청을 보내는 클라이언트
 *
 * 싱글턴 패턴으로 구현되어 MCP 도구들이 동일한 인스턴스를 공유할 수 있다.
 */
export class BeaconClient {
  // ============================================================================
  // Static 필드 (싱글턴)
  // ============================================================================

  private static _instance: BeaconClient | null = null;

  // ============================================================================
  // Private 필드
  // ============================================================================

  private _port: number;
  private _timeout: number;

  // ============================================================================
  // 생성자
  // ============================================================================

  constructor(options?: BeaconClientOptions) {
    this._port = options?.port ?? DEFAULT_PORT;
    this._timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  }

  // ============================================================================
  // 싱글턴 메서드
  // ============================================================================

  /**
   * 싱글턴 인스턴스 반환
   */
  static getInstance(): BeaconClient {
    if (!BeaconClient._instance) {
      BeaconClient._instance = new BeaconClient();
    }
    return BeaconClient._instance;
  }

  /**
   * 싱글턴 인스턴스 리셋 (테스트용)
   */
  static resetInstance(): void {
    BeaconClient._instance = null;
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
   * toolUseId로 PylonInfo 조회
   *
   * @param toolUseId 조회할 도구 호출 ID
   * @returns Lookup 결과 (성공 시 PylonInfo, 실패 시 에러)
   * @throws 연결 실패, 타임아웃, 빈 toolUseId 등
   */
  async lookup(toolUseId: string): Promise<LookupResult> {
    // 빈 toolUseId 검사
    if (!toolUseId || toolUseId === '') {
      throw new Error('Invalid toolUseId: toolUseId is required');
    }

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
        const request: LookupRequest = {
          action: 'lookup',
          toolUseId,
        };
        socket.write(JSON.stringify(request) + '\n');
      });

      // 데이터 수신
      socket.on('data', (data) => {
        buffer += data.toString();

        try {
          const response = JSON.parse(buffer) as LookupResult;
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
