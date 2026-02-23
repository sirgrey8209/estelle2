import { MessageType, WebSocketAdapter, WebSocketAdapterFactory } from '@estelle/core';

/** 기본 재연결 간격 (ms) */
const DEFAULT_RECONNECT_INTERVAL = 3000;

/** 기본 Heartbeat 간격 (ms) */
const DEFAULT_HEARTBEAT_INTERVAL = 10000;

/** 기본 Heartbeat 타임아웃 (ms) */
const DEFAULT_HEARTBEAT_TIMEOUT = 30000;

/**
 * Relay 서비스 설정
 */
export interface RelayConfig {
  url: string;
  authToken: string;
  deviceType: 'app' | 'pylon';
  /** Google ID 토큰 (Google OAuth 인증용) */
  idToken?: string;
  /** 재연결 간격 (ms, 기본: 3000) */
  reconnectInterval?: number;
  /** Heartbeat 간격 (ms, 기본: 10000) */
  heartbeatInterval?: number;
  /** Heartbeat 타임아웃 (ms, 기본: 30000) */
  heartbeatTimeout?: number;
}

/**
 * 메시지 타입
 */
export interface RelayMessage {
  type: string;
  payload: Record<string, unknown>;
  from?: string;
  /** 전송 대상 deviceId 배열 (숫자) */
  to?: number[];
  /** 브로드캐스트 옵션 */
  broadcast?: 'all' | 'clients' | 'pylons';
}

/**
 * 이벤트 타입
 */
export type RelayEventType =
  | 'connected'
  | 'disconnected'
  | 'authenticated'
  | 'message'
  | 'error';

/**
 * 이벤트 리스너 타입
 */
type EventListener<T = unknown> = (data: T) => void;

/**
 * Relay 서비스
 *
 * Relay 서버와의 WebSocket 연결을 관리합니다.
 */
export class RelayService {
  private config: RelayConfig;
  private adapter: WebSocketAdapter | null = null;
  private adapterFactory: WebSocketAdapterFactory;
  private listeners: Map<RelayEventType, Set<EventListener>>;
  private _isConnected = false;
  private _isAuthenticated = false;
  private _deviceId: string | null = null;

  /** Google ID 토큰 */
  private _idToken: string | null = null;

  /** 재연결 활성화 여부 */
  private reconnectEnabled = true;

  /** 재연결 타이머 ID */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Heartbeat 타이머 ID */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /** 마지막 pong 수신 시간 */
  private lastPongTime = 0;

  constructor(config: RelayConfig, adapterFactory: WebSocketAdapterFactory) {
    this.config = config;
    this.adapterFactory = adapterFactory;
    this.listeners = new Map();
    this._idToken = config.idToken ?? null;
  }

  /**
   * 연결 상태
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * 인증 상태
   */
  get isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  /**
   * 디바이스 ID
   */
  get deviceId(): string | null {
    return this._deviceId;
  }

  /**
   * Relay 서버에 연결
   */
  connect(): void {
    if (this.adapter) {
      return;
    }

    this.reconnectEnabled = true;
    this.adapter = this.adapterFactory();

    this.adapter.onOpen = () => {
      this._isConnected = true;
      this.emit('connected', undefined);
      this.sendAuth();
      this.startHeartbeat();
    };

    this.adapter.onClose = () => {
      this._isConnected = false;
      this._isAuthenticated = false;
      this.adapter = null;
      this.stopHeartbeat();
      this.emit('disconnected', undefined);

      // 자동 재연결
      if (this.reconnectEnabled) {
        this.scheduleReconnect();
      }
    };

    this.adapter.onMessage = (data: string) => {
      try {
        const message = JSON.parse(data) as RelayMessage;

        // pong 메시지는 heartbeat용이므로 별도 처리
        if (message.type === 'pong') {
          this.lastPongTime = Date.now();
          return;
        }

        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    this.adapter.onError = (error: Error) => {
      this.emit('error', error);
    };

    this.adapter.connect();
  }

  /**
   * Relay 서버 연결 해제
   */
  disconnect(): void {
    this.reconnectEnabled = false;
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
   */
  send(message: RelayMessage): void {
    if (!this.adapter || !this._isConnected) {
      throw new Error('Not connected');
    }

    this.adapter.send(JSON.stringify(message));
  }

  /**
   * 이벤트 리스너 등록
   */
  on<T = unknown>(event: RelayEventType, listener: EventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener);

    return () => {
      this.listeners.get(event)?.delete(listener as EventListener);
    };
  }

  /**
   * Google ID 토큰 설정
   */
  setIdToken(idToken: string | null): void {
    this._idToken = idToken;
  }

  /**
   * 인증 메시지 전송
   */
  sendAuth(): void {
    const payload: Record<string, unknown> = {
      token: this.config.authToken,
      deviceType: this.config.deviceType,
    };

    if (this._idToken) {
      payload.idToken = this._idToken;
    }

    this.send({
      type: MessageType.AUTH,
      payload,
    });
  }

  /**
   * 메시지 처리
   */
  private handleMessage(message: RelayMessage): void {
    if (message.type === MessageType.AUTH_RESULT) {
      // Relay는 payload.device.deviceId로 인코딩된 deviceId를 전송
      const payload = message.payload as {
        success: boolean;
        device?: { deviceId?: number; deviceIndex?: number };
      };
      if (payload.success && payload.device?.deviceId !== undefined) {
        this._isAuthenticated = true;
        // deviceId는 숫자로 오므로 문자열로 변환
        this._deviceId = String(payload.device.deviceId);
        this.emit('authenticated', this._deviceId);
      }
    }

    this.emit('message', message);
  }

  /**
   * 이벤트 발생
   */
  private emit<T>(event: RelayEventType, data: T): void {
    this.listeners.get(event)?.forEach((listener) => listener(data));
  }

  /**
   * Heartbeat 시작
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();

    const interval = this.config.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL;
    const timeout = this.config.heartbeatTimeout ?? DEFAULT_HEARTBEAT_TIMEOUT;

    this.heartbeatTimer = setInterval(() => {
      if (!this._isConnected || !this.adapter) {
        this.stopHeartbeat();
        return;
      }

      // ping 전송
      try {
        this.send({ type: 'ping', payload: {} });
      } catch {
        // 전송 실패 무시 (연결 끊긴 상태)
      }

      // 타임아웃 체크
      const elapsed = Date.now() - this.lastPongTime;
      if (elapsed > timeout) {
        console.warn(`[RelayService] Heartbeat timeout (${elapsed}ms), forcing reconnect`);
        this.forceReconnect();
      }
    }, interval);
  }

  /**
   * Heartbeat 중지
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 강제 재연결 (heartbeat 실패 시)
   */
  private forceReconnect(): void {
    this.stopHeartbeat();

    if (this.adapter) {
      this.adapter.disconnect();
      // adapter = null과 _isConnected = false는 onClose에서 처리됨
    }
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const interval = this.config.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL;

    this.reconnectTimer = setTimeout(() => {
      if (this.reconnectEnabled) {
        console.log(`[RelayService] Reconnecting...`);
        this.connect();
      }
    }, interval);
  }

  // ============================================================================
  // 편의 메서드
  // ============================================================================

  /**
   * 워크스페이스 목록 요청
   */
  requestWorkspaceList(): void {
    this.send({
      type: MessageType.WORKSPACE_LIST,
      payload: {},
    });
  }

  /**
   * Claude에 메시지 전송
   */
  sendClaude(conversationId: number, content: string, attachments?: string[]): void {
    this.send({
      type: MessageType.CLAUDE_SEND,
      payload: {
        conversationId,
        content,
        attachments,
      },
    });
  }

  /**
   * Claude 제어 (중단/재시작)
   */
  sendClaudeControl(conversationId: number, action: 'stop' | 'restart'): void {
    this.send({
      type: MessageType.CLAUDE_CONTROL,
      payload: {
        conversationId,
        action,
      },
    });
  }

  /**
   * Claude 권한 응답
   */
  sendPermissionResponse(
    conversationId: number,
    toolUseId: string,
    allowed: boolean
  ): void {
    this.send({
      type: MessageType.CLAUDE_PERMISSION,
      payload: {
        conversationId,
        toolUseId,
        allowed,
      },
    });
  }

  /**
   * Claude 질문 응답
   */
  sendQuestionResponse(
    conversationId: number,
    toolUseId: string,
    answer: string
  ): void {
    this.send({
      type: MessageType.CLAUDE_ANSWER,
      payload: {
        conversationId,
        toolUseId,
        answer,
      },
    });
  }
}
