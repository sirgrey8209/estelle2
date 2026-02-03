import { MessageType, WebSocketAdapter, WebSocketAdapterFactory } from '@estelle/core';

/**
 * Relay 서비스 설정
 */
export interface RelayConfig {
  url: string;
  authToken: string;
  deviceType: 'app' | 'pylon';
}

/**
 * 메시지 타입
 */
export interface RelayMessage {
  type: string;
  payload: Record<string, unknown>;
  from?: string;
  to?: string;
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

  constructor(config: RelayConfig, adapterFactory: WebSocketAdapterFactory) {
    this.config = config;
    this.adapterFactory = adapterFactory;
    this.listeners = new Map();
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

    this.adapter = this.adapterFactory();

    this.adapter.onOpen = () => {
      this._isConnected = true;
      this.emit('connected', undefined);
      this.sendAuth();
    };

    this.adapter.onClose = () => {
      this._isConnected = false;
      this._isAuthenticated = false;
      this.emit('disconnected', undefined);
    };

    this.adapter.onMessage = (data: string) => {
      try {
        const message = JSON.parse(data) as RelayMessage;
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
   * 인증 메시지 전송
   */
  private sendAuth(): void {
    this.send({
      type: MessageType.AUTH,
      payload: {
        token: this.config.authToken,
        deviceType: this.config.deviceType,
      },
    });
  }

  /**
   * 메시지 처리
   */
  private handleMessage(message: RelayMessage): void {
    if (message.type === MessageType.AUTH_RESULT) {
      const payload = message.payload as { success: boolean; deviceId?: string };
      if (payload.success && payload.deviceId) {
        this._isAuthenticated = true;
        this._deviceId = payload.deviceId;
        this.emit('authenticated', payload.deviceId);
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
  sendClaude(conversationId: string, content: string, attachments?: string[]): void {
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
  sendClaudeControl(conversationId: string, action: 'stop' | 'restart'): void {
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
    conversationId: string,
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
    conversationId: string,
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
