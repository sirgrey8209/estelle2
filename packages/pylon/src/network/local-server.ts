/**
 * LocalServer - Desktop App 연결용 로컬 WebSocket 서버
 *
 * 기능:
 * - 로컬 WebSocket 서버 (기본 포트 9000)
 * - Desktop App 클라이언트 연결 관리
 * - 연결/해제 이벤트 콜백
 * - Relay 상태 콜백
 * - 메시지 브로드캐스트
 *
 * @module network/local-server
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Logger } from '../utils/logger.js';
import type { PacketLogger } from '../utils/packet-logger.js';

/**
 * 기본 로컬 서버 포트
 */
export const DEFAULT_LOCAL_PORT = 9000;

/**
 * LocalServer 생성 옵션
 */
export interface LocalServerOptions {
  /** 서버 포트 (기본: 9000) */
  port?: number;
  /** 로거 인스턴스 (선택) */
  logger?: Logger;
  /** 패킷 로거 인스턴스 (선택) */
  packetLogger?: PacketLogger;
}

/**
 * LocalServer 콜백 인터페이스
 */
export interface LocalServerCallbacks {
  /**
   * 메시지 수신 콜백
   * @param data - 파싱된 메시지 데이터
   * @param ws - 메시지를 보낸 WebSocket 클라이언트
   */
  onMessage: (data: unknown, ws: WebSocket) => void;

  /**
   * 클라이언트 연결 콜백
   * @param ws - 연결된 WebSocket 클라이언트
   */
  onConnect: (ws: WebSocket) => void;

  /**
   * Relay 연결 상태 조회 콜백
   * @returns Relay 연결 여부
   */
  getRelayStatus: () => boolean;
}

/**
 * LocalServer 클래스
 *
 * Desktop App이 연결하는 로컬 WebSocket 서버입니다.
 * 연결된 클라이언트에게 Pylon 상태를 전달하고,
 * 클라이언트로부터 메시지를 수신합니다.
 *
 * @example
 * ```typescript
 * const server = createLocalServer({ port: 9000 });
 *
 * server.onMessage((data, ws) => {
 *   console.log('Received:', data);
 * });
 *
 * server.onConnect((ws) => {
 *   console.log('Client connected');
 * });
 *
 * server.setRelayStatusCallback(() => relayClient.isConnected());
 *
 * server.start();
 * ```
 */
export class LocalServer {
  /** 서버 포트 */
  private readonly port: number;

  /** WebSocket 서버 인스턴스 */
  private wss: WebSocketServer | null = null;

  /** 연결된 클라이언트 Set */
  private clients: Set<WebSocket> = new Set();

  /** 메시지 수신 콜백 */
  private messageCallback: ((data: unknown, ws: WebSocket) => void) | null = null;

  /** 연결 콜백 */
  private connectCallback: ((ws: WebSocket) => void) | null = null;

  /** Relay 상태 조회 콜백 */
  private relayStatusCallback: (() => boolean) = () => false;

  /** 로거 인스턴스 */
  private readonly logger?: Logger;

  /** 패킷 로거 인스턴스 */
  private readonly packetLogger?: PacketLogger;

  /**
   * LocalServer 인스턴스 생성
   *
   * @param options - LocalServer 생성 옵션
   */
  constructor(options: LocalServerOptions = {}) {
    this.port = options.port ?? DEFAULT_LOCAL_PORT;
    this.logger = options.logger;
    this.packetLogger = options.packetLogger;
  }

  /**
   * 서버 포트 반환
   *
   * @returns 서버 포트
   */
  getPort(): number {
    return this.port;
  }

  /**
   * 서버 실행 여부 반환
   *
   * @returns 서버가 실행 중이면 true
   */
  isRunning(): boolean {
    return this.wss !== null;
  }

  /**
   * 연결된 클라이언트 수 반환
   *
   * @returns 클라이언트 수
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Relay 연결 상태 반환
   *
   * @returns Relay 연결 여부
   */
  getRelayStatus(): boolean {
    return this.relayStatusCallback();
  }

  /**
   * 메시지 콜백 등록 여부 확인
   *
   * @returns 콜백이 등록되어 있으면 true
   */
  hasMessageCallback(): boolean {
    return this.messageCallback !== null;
  }

  /**
   * 연결 콜백 등록 여부 확인
   *
   * @returns 콜백이 등록되어 있으면 true
   */
  hasConnectCallback(): boolean {
    return this.connectCallback !== null;
  }

  /**
   * 메시지 수신 콜백 등록
   *
   * @param callback - 메시지 수신 시 호출될 콜백
   */
  onMessage(callback: (data: unknown, ws: WebSocket) => void): void {
    this.messageCallback = callback;
  }

  /**
   * 클라이언트 연결 콜백 등록
   *
   * @param callback - 클라이언트 연결 시 호출될 콜백
   */
  onConnect(callback: (ws: WebSocket) => void): void {
    this.connectCallback = callback;
  }

  /**
   * Relay 상태 조회 콜백 등록
   *
   * @param callback - Relay 연결 상태를 반환하는 콜백
   */
  setRelayStatusCallback(callback: () => boolean): void {
    this.relayStatusCallback = callback;
  }

  /**
   * 서버 시작
   *
   * WebSocket 서버를 시작하고 클라이언트 연결을 수신합니다.
   */
  start(): void {
    this.wss = new WebSocketServer({ port: this.port });

    // 서버 시작 이벤트
    this.wss.on('listening', () => {
      this.logger?.log(`Local server started on port ${this.port}`);
    });

    // 클라이언트 연결 이벤트
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      this.logger?.log(`Desktop connected. Total: ${this.clients.size}`);

      // 연결 확인 메시지 전송
      ws.send(
        JSON.stringify({
          type: 'connected',
          message: 'Connected to Pylon',
          relayStatus: this.getRelayStatus(),
        })
      );

      // 연결 콜백 호출
      if (this.connectCallback) {
        this.connectCallback(ws);
      }

      // 메시지 수신 이벤트
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.logger?.log('From Desktop:', data);

          if (this.messageCallback) {
            this.messageCallback(data, ws);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger?.error('Invalid message from Desktop:', message.toString(), errorMessage);
        }
      });

      // 연결 해제 이벤트
      ws.on('close', () => {
        this.clients.delete(ws);
        this.logger?.log(`Desktop disconnected. Total: ${this.clients.size}`);
      });

      // 에러 이벤트
      ws.on('error', (err) => {
        this.logger?.error('Desktop connection error:', err.message);
      });
    });

    // 서버 에러 이벤트
    this.wss.on('error', (err) => {
      this.logger?.error('Local server error:', err.message);
    });
  }

  /**
   * 서버 중지
   *
   * WebSocket 서버를 중지하고 모든 연결을 닫습니다.
   */
  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
      this.clients.clear();
    }
  }

  /**
   * 모든 클라이언트에게 메시지 브로드캐스트
   *
   * relay_status와 pong 타입은 패킷 로그에 기록하지 않습니다.
   *
   * @param data - 전송할 데이터 객체
   */
  broadcast(data: unknown): void {
    // relay_status, pong은 패킷 로그에서 제외
    const dataObj = data as { type?: string };
    if (
      dataObj.type !== 'relay_status' &&
      dataObj.type !== 'pong' &&
      this.packetLogger
    ) {
      this.packetLogger.logSend('desktop', dataObj);
    }

    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Relay 연결 상태를 모든 클라이언트에게 전송
   *
   * @param isConnected - Relay 연결 여부
   */
  sendRelayStatus(isConnected: boolean): void {
    this.broadcast({
      type: 'relay_status',
      connected: isConnected,
    });
  }
}

/**
 * LocalServer 인스턴스 생성 팩토리 함수
 *
 * @param options - LocalServer 생성 옵션
 * @returns LocalServer 인스턴스
 *
 * @example
 * ```typescript
 * const server = createLocalServer({
 *   port: 9000,
 *   logger: myLogger,
 *   packetLogger: myPacketLogger,
 * });
 * ```
 */
export function createLocalServer(options: LocalServerOptions = {}): LocalServer {
  return new LocalServer(options);
}
