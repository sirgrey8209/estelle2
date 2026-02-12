/**
 * RelayClient - Relay 서버 연결용 WebSocket 클라이언트
 *
 * 기능:
 * - Relay 서버에 WebSocket으로 연결
 * - 자동 재연결 (기본 3초 간격)
 * - 연결 상태 관리
 * - 메시지 송수신
 * - 식별 메시지 자동 전송
 *
 * @module network/relay-client
 */

import type { Message, AuthPayload, WebSocketAdapter, WebSocketAdapterFactory } from '@estelle/core';
import type { Logger } from '../utils/logger.js';
import { createWsAdapterFactory } from './ws-websocket-adapter.js';

/**
 * 기본 재연결 간격 (ms)
 */
export const DEFAULT_RECONNECT_INTERVAL = 3000;

/**
 * 기본 Heartbeat 간격 (ms)
 */
export const DEFAULT_HEARTBEAT_INTERVAL = 10000;

/**
 * 기본 Heartbeat 타임아웃 (ms)
 */
export const DEFAULT_HEARTBEAT_TIMEOUT = 30000;

/**
 * RelayClient 생성 옵션
 */
export interface RelayClientOptions {
  /** Relay 서버 URL (예: 'ws://localhost:8080') */
  url: string;
  /** 디바이스 ID (숫자) */
  deviceId: number;
  /** 디바이스 이름 (선택) */
  deviceName?: string;
  /** 재연결 간격 (ms, 기본: 3000) */
  reconnectInterval?: number;
  /** Heartbeat 간격 (ms, 기본: 10000) */
  heartbeatInterval?: number;
  /** Heartbeat 타임아웃 (ms, 기본: 30000) */
  heartbeatTimeout?: number;
  /** 로거 인스턴스 (선택) */
  logger?: Logger;
  /** WebSocket 어댑터 팩토리 (선택, 테스트용) */
  adapterFactory?: WebSocketAdapterFactory;
}

/**
 * RelayClient 콜백 인터페이스
 */
export interface RelayClientCallbacks {
  /**
   * 메시지 수신 콜백
   * @param data - 파싱된 메시지 데이터
   */
  onMessage: (data: unknown) => void;

  /**
   * 연결 상태 변경 콜백
   * @param isConnected - 연결 여부
   */
  onStatusChange: (isConnected: boolean) => void;
}


/**
 * RelayClient 클래스
 *
 * Relay 서버에 연결하여 메시지를 송수신하는 WebSocket 클라이언트입니다.
 * 연결이 끊어지면 자동으로 재연결을 시도합니다.
 *
 * @example
 * ```typescript
 * const client = createRelayClient({
 *   url: 'ws://localhost:8080',
 *   deviceId: 'pylon-001',
 * });
 *
 * client.onMessage((data) => {
 *   console.log('Received:', data);
 * });
 *
 * client.onStatusChange((isConnected) => {
 *   console.log('Connected:', isConnected);
 * });
 *
 * client.connect();
 * ```
 */
export class RelayClient {
  /** Relay 서버 URL */
  private readonly url: string;

  /** 디바이스 ID (숫자) */
  private readonly deviceId: number;

  /** 디바이스 이름 (선택) */
  private readonly deviceName?: string;

  /** 재연결 간격 (ms) */
  private readonly reconnectInterval: number;

  /** Heartbeat 간격 (ms) */
  private readonly heartbeatInterval: number;

  /** Heartbeat 타임아웃 (ms) */
  private readonly heartbeatTimeout: number;

  /** WebSocket 어댑터 팩토리 */
  private readonly adapterFactory: WebSocketAdapterFactory;

  /** WebSocket 어댑터 인스턴스 */
  private adapter: WebSocketAdapter | null = null;

  /** 연결 상태 */
  private connected: boolean = false;

  /** 재연결 활성화 여부 */
  private reconnectEnabled: boolean = true;

  /** 재연결 타이머 ID */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Heartbeat 타이머 ID */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /** 마지막 pong 수신 시간 */
  private lastPongTime: number = 0;

  /** 메시지 수신 콜백 */
  private messageCallback: ((data: unknown) => void) | null = null;

  /** 상태 변경 콜백 */
  private statusChangeCallback: ((isConnected: boolean) => void) | null = null;

  /** 로거 인스턴스 */
  private readonly logger?: Logger;

  /**
   * RelayClient 인스턴스 생성
   *
   * @param options - RelayClient 생성 옵션
   */
  constructor(options: RelayClientOptions) {
    this.url = options.url;
    this.deviceId = options.deviceId;
    this.deviceName = options.deviceName;
    this.reconnectInterval = options.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL;
    this.heartbeatInterval = options.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL;
    this.heartbeatTimeout = options.heartbeatTimeout ?? DEFAULT_HEARTBEAT_TIMEOUT;
    this.logger = options.logger;
    // 기본값: 실제 WebSocket 어댑터 사용
    this.adapterFactory = options.adapterFactory ?? createWsAdapterFactory(this.url);
  }

  /**
   * Relay 서버 URL 반환
   *
   * @returns 서버 URL
   */
  getUrl(): string {
    return this.url;
  }

  /**
   * 디바이스 ID 반환
   *
   * @returns 디바이스 ID (숫자)
   */
  getDeviceId(): number {
    return this.deviceId;
  }

  /**
   * 디바이스 이름 반환
   *
   * @returns 디바이스 이름 (없으면 undefined)
   */
  getDeviceName(): string | undefined {
    return this.deviceName;
  }

  /**
   * 재연결 간격 반환
   *
   * @returns 재연결 간격 (ms)
   */
  getReconnectInterval(): number {
    return this.reconnectInterval;
  }

  /**
   * 연결 상태 반환
   *
   * @returns 연결 여부
   */
  getStatus(): boolean {
    return this.connected;
  }

  /**
   * 연결 상태 반환 (getStatus의 별칭)
   *
   * @returns 연결 여부
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 재연결 허용 여부 반환
   *
   * @returns 재연결이 허용되면 true
   */
  shouldReconnect(): boolean {
    return this.reconnectEnabled;
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
   * 상태 변경 콜백 등록 여부 확인
   *
   * @returns 콜백이 등록되어 있으면 true
   */
  hasStatusChangeCallback(): boolean {
    return this.statusChangeCallback !== null;
  }

  /**
   * 메시지 수신 콜백 등록
   *
   * @param callback - 메시지 수신 시 호출될 콜백
   */
  onMessage(callback: (data: unknown) => void): void {
    this.messageCallback = callback;
  }

  /**
   * 연결 상태 변경 콜백 등록
   *
   * @param callback - 연결 상태 변경 시 호출될 콜백
   */
  onStatusChange(callback: (isConnected: boolean) => void): void {
    this.statusChangeCallback = callback;
  }

  /**
   * 식별 메시지 생성
   *
   * @returns Message<AuthPayload> 형식의 인증 메시지
   */
  createIdentifyMessage(): Message<AuthPayload> {
    const payload: AuthPayload = {
      deviceId: this.deviceId,
      deviceType: 'pylon',
    };

    // deviceName이 있으면 name 필드 추가
    if (this.deviceName !== undefined) {
      payload.name = this.deviceName;
    }

    return {
      type: 'auth',
      payload,
      timestamp: Date.now(),
    };
  }

  /**
   * Relay 서버에 연결
   *
   * 연결 성공 시 식별 메시지를 자동으로 전송합니다.
   */
  connect(): void {
    this.reconnectEnabled = true;
    this.logger?.log(`Connecting to Relay: ${this.url}`);

    this.adapter = this.adapterFactory();

    // 연결 성공 이벤트
    this.adapter.onOpen = () => {
      this.connected = true;
      this.logger?.log('Connected to Relay');

      // 상태 변경 콜백 호출
      if (this.statusChangeCallback) {
        this.statusChangeCallback(true);
      }

      // 식별 메시지 전송
      this.send(this.createIdentifyMessage());

      // Heartbeat 시작
      this.startHeartbeat();
    };

    // 메시지 수신 이벤트
    this.adapter.onMessage = (message: string) => {
      try {
        const data = JSON.parse(message) as { type?: string };

        // pong 메시지는 heartbeat용이므로 별도 처리
        if (data.type === 'pong') {
          this.lastPongTime = Date.now();
          return;
        }

        this.logger?.log('From Relay:', data);

        if (this.messageCallback) {
          this.messageCallback(data);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger?.error('Invalid message from Relay:', message, errorMessage);
      }
    };

    // 연결 해제 이벤트
    this.adapter.onClose = () => {
      this.connected = false;
      this.logger?.log('Disconnected from Relay');

      // Heartbeat 중지
      this.stopHeartbeat();

      // 상태 변경 콜백 호출
      if (this.statusChangeCallback) {
        this.statusChangeCallback(false);
      }

      // 자동 재연결
      if (this.reconnectEnabled) {
        this.logger?.log(`Reconnecting in ${this.reconnectInterval}ms...`);
        this.scheduleReconnect();
      }
    };

    // 에러 이벤트
    this.adapter.onError = (err: Error) => {
      this.logger?.error('Relay connection error:', err.message);
    };

    this.adapter.connect();
  }

  /**
   * Heartbeat 시작
   *
   * @private
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // 기존 타이머 정리
    this.lastPongTime = Date.now();

    this.heartbeatTimer = setInterval(() => {
      if (!this.connected || !this.adapter) {
        this.stopHeartbeat();
        return;
      }

      // ping 전송
      this.send({ type: 'ping' });

      // 타임아웃 체크
      const elapsed = Date.now() - this.lastPongTime;
      if (elapsed > this.heartbeatTimeout) {
        this.logger?.warn(`Heartbeat timeout (${elapsed}ms), forcing reconnect`);
        this.forceReconnect();
      }
    }, this.heartbeatInterval);
  }

  /**
   * Heartbeat 중지
   *
   * @private
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 강제 재연결 (heartbeat 실패 시)
   *
   * @private
   */
  private forceReconnect(): void {
    this.stopHeartbeat();

    // 현재 어댑터 강제 종료 (onClose 이벤트가 재연결 트리거)
    if (this.adapter) {
      this.adapter.disconnect();
      // adapter = null과 connected = false는 onClose에서 처리됨
    }
  }

  /**
   * 재연결 스케줄링
   *
   * @private
   */
  private scheduleReconnect(): void {
    // 기존 타이머가 있으면 정리
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      if (this.reconnectEnabled) {
        this.connect();
      }
    }, this.reconnectInterval);
  }

  /**
   * 연결 해제
   *
   * 자동 재연결을 비활성화하고 연결을 닫습니다.
   */
  disconnect(): void {
    this.reconnectEnabled = false;

    // Heartbeat 중지
    this.stopHeartbeat();

    // 재연결 타이머 정리
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.adapter) {
      this.adapter.disconnect();
      this.adapter = null;
    }
  }

  /**
   * 메시지 전송
   *
   * 연결되지 않은 상태에서는 경고 로그만 출력하고 무시합니다.
   *
   * @param data - 전송할 데이터 객체
   */
  send(data: unknown): void {
    if (this.adapter && this.connected) {
      this.adapter.send(JSON.stringify(data));
    } else {
      this.logger?.warn('Cannot send, not connected to Relay');
    }
  }
}

/**
 * RelayClient 인스턴스 생성 팩토리 함수
 *
 * @param options - RelayClient 생성 옵션
 * @returns RelayClient 인스턴스
 *
 * @example
 * ```typescript
 * const client = createRelayClient({
 *   url: 'ws://relay.example.com:8080',
 *   deviceId: 'pylon-001',
 *   reconnectInterval: 5000,
 *   logger: myLogger,
 * });
 * ```
 */
export function createRelayClient(options: RelayClientOptions): RelayClient {
  return new RelayClient(options);
}
