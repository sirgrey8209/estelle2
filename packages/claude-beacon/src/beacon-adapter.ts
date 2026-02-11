/**
 * @file beacon-adapter.ts
 * @description ClaudeBeaconAdapter - Pylon이 ClaudeBeacon을 통해 SDK를 호출하기 위한 어댑터
 *
 * ClaudeAdapter 인터페이스를 구현하여 ClaudeManager에 주입 가능.
 * TCP를 통해 ClaudeBeacon 서버와 통신.
 *
 * 통신 프로토콜:
 * - 연결 시: { "action": "register", "pylonAddress": "127.0.0.1:9876", "env": "dev" }
 * - 쿼리 요청: { "action": "query", "entityId": 2049, "options": { "prompt": "...", "cwd": "..." } }
 * - 이벤트 스트림: { "type": "event", "entityId": 2049, "message": { ... } }
 */

import { createConnection, type Socket } from 'net';

// ============================================================================
// 상수
// ============================================================================

/** 기본 호스트 */
const DEFAULT_HOST = '127.0.0.1';

/** 기본 포트 */
const DEFAULT_PORT = 9877;

/** 기본 연결 타임아웃 (5초) */
const DEFAULT_CONNECT_TIMEOUT = 5000;

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 권한 콜백 결과
 */
export interface PermissionCallbackResult {
  /** 동작: 'allow' 또는 'deny' */
  behavior: 'allow' | 'deny';

  /** 허용 시 업데이트된 입력 */
  updatedInput?: Record<string, unknown>;

  /** 거부 시 메시지 */
  message?: string;
}

/**
 * 쿼리 옵션 (ClaudeAdapter 인터페이스와 호환)
 */
export interface BeaconQueryOptions {
  /** 프롬프트 메시지 */
  prompt: string;

  /** 작업 디렉토리 */
  cwd: string;

  /** 중단용 AbortController */
  abortController: AbortController;

  /** Entity ID (세션 식별자) */
  entityId?: number;

  /** 부분 메시지 포함 여부 */
  includePartialMessages?: boolean;

  /** 설정 소스 */
  settingSources?: string[];

  /** 재개할 세션 ID */
  resume?: string;

  /** MCP 서버 설정 */
  mcpServers?: Record<string, unknown>;

  /** 환경변수 */
  env?: Record<string, string>;

  /** 도구 사용 가능 여부 콜백 */
  canUseTool?: (
    toolName: string,
    input: Record<string, unknown>
  ) => Promise<PermissionCallbackResult>;
}

/**
 * BeaconAdapter 옵션
 */
export interface BeaconAdapterOptions {
  /** Beacon 서버 호스트 */
  host?: string;

  /** Beacon 서버 포트 */
  port?: number;

  /** Pylon 주소 (등록용) */
  pylonAddress?: string;

  /** 환경 (dev/stage/release) */
  env?: string;

  /** Entity ID (쿼리용) */
  entityId?: number;

  /** 연결 타임아웃 (밀리초) */
  connectTimeout?: number;

  /** 연결 해제 콜백 */
  onDisconnect?: () => void;

  /** 자동 재연결 활성화 (기본: false) */
  reconnect?: boolean;

  /** 재연결 간격 (밀리초, 기본: 5000) */
  reconnectInterval?: number;

  /** 최대 재연결 시도 횟수 (기본: Infinity) */
  maxReconnectAttempts?: number;

  /** 재연결 성공 콜백 */
  onReconnect?: () => void;

  /** 재연결 실패 콜백 (최대 시도 횟수 초과 시) */
  onReconnectFailed?: (attempts: number) => void;
}

/**
 * Claude 메시지 (Beacon에서 수신)
 */
export interface ClaudeMessage {
  /** 메시지 타입 */
  type: string;

  /** 서브타입 */
  subtype?: string;

  /** 추가 데이터 */
  [key: string]: unknown;
}

/**
 * Beacon 이벤트
 */
interface BeaconEvent {
  type: string;
  entityId?: number;
  message?: ClaudeMessage;
  error?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  toolUseId?: string;
}

// ============================================================================
// ClaudeBeaconAdapter 클래스
// ============================================================================

/**
 * ClaudeBeaconAdapter - ClaudeBeacon 서버와 TCP 통신하는 어댑터
 *
 * Pylon이 이 어댑터를 사용하여 ClaudeBeacon에 쿼리를 보내고
 * 이벤트 스트림을 수신합니다.
 */
export class ClaudeBeaconAdapter {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /** Beacon 서버 호스트 */
  private readonly _host: string;

  /** Beacon 서버 포트 */
  private readonly _port: number;

  /** Pylon 주소 */
  private readonly _pylonAddress?: string;

  /** 환경 */
  private readonly _env?: string;

  /** Entity ID */
  private readonly _entityId?: number;

  /** 연결 타임아웃 */
  private readonly _connectTimeout: number;

  /** 연결 해제 콜백 */
  private readonly _onDisconnect?: () => void;

  /** 자동 재연결 활성화 */
  private readonly _reconnect: boolean;

  /** 재연결 간격 (밀리초) */
  private readonly _reconnectInterval: number;

  /** 최대 재연결 시도 횟수 */
  private readonly _maxReconnectAttempts: number;

  /** 재연결 성공 콜백 */
  private readonly _onReconnect?: () => void;

  /** 재연결 실패 콜백 */
  private readonly _onReconnectFailed?: (attempts: number) => void;

  /** 재연결 중 여부 */
  private _reconnecting: boolean = false;

  /** 재연결 시도 횟수 */
  private _reconnectAttempts: number = 0;

  /** 재연결 타이머 */
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** 의도적 연결 해제 플래그 */
  private _intentionalDisconnect: boolean = false;

  /** 재연결 중인 소켓 (disconnect 시 정리용) */
  private _pendingSocket: Socket | null = null;

  /** TCP 소켓 */
  private _socket: Socket | null = null;

  /** 연결 상태 */
  private _connected: boolean = false;

  /** 수신 버퍼 */
  private _buffer: string = '';

  /** 쿼리 응답 리스너 */
  private _eventListeners: Map<
    number,
    {
      resolve: (event: BeaconEvent) => void;
      reject: (error: Error) => void;
    }
  > = new Map();

  /** 대기 중인 이벤트 큐 */
  private _eventQueue: BeaconEvent[] = [];

  /** 이벤트 대기 Promise resolver */
  private _eventWaiter: ((event: BeaconEvent | null) => void) | null = null;

  /** 현재 canUseTool 콜백 */
  private _currentCanUseTool?: (
    toolName: string,
    input: Record<string, unknown>
  ) => Promise<PermissionCallbackResult>;

  // ============================================================================
  // 생성자
  // ============================================================================

  constructor(options: BeaconAdapterOptions = {}) {
    this._host = options.host ?? DEFAULT_HOST;
    this._port = options.port ?? DEFAULT_PORT;
    this._pylonAddress = options.pylonAddress;
    this._env = options.env;
    this._entityId = options.entityId;
    this._connectTimeout = options.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
    this._onDisconnect = options.onDisconnect;
    this._reconnect = options.reconnect ?? false;
    this._reconnectInterval = options.reconnectInterval ?? 5000;
    this._maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity;
    this._onReconnect = options.onReconnect;
    this._onReconnectFailed = options.onReconnectFailed;
  }

  // ============================================================================
  // 공개 속성
  // ============================================================================

  /** 호스트 */
  get host(): string {
    return this._host;
  }

  /** 포트 */
  get port(): number {
    return this._port;
  }

  /** Pylon 주소 */
  get pylonAddress(): string | undefined {
    return this._pylonAddress;
  }

  /** 환경 */
  get env(): string | undefined {
    return this._env;
  }

  /** 연결 상태 */
  get isConnected(): boolean {
    return this._connected;
  }

  /** 재연결 중 상태 */
  get isReconnecting(): boolean {
    return this._reconnecting;
  }

  // ============================================================================
  // 공개 메서드 - 연결 관리
  // ============================================================================

  /**
   * Beacon 서버에 연결
   */
  async connect(): Promise<void> {
    if (this._connected) {
      throw new Error('Already connected');
    }

    // 의도적 연결 해제 플래그 리셋 (새 연결 시도 시)
    this._intentionalDisconnect = false;

    return new Promise((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          if (this._socket) {
            this._socket.destroy();
            this._socket = null;
          }
          reject(new Error('Connection timeout'));
        }
      }, this._connectTimeout);

      this._socket = createConnection(
        { host: this._host, port: this._port }
      );

      // 연결 전에 핸들러 설정 (close 이벤트 등을 빨리 잡기 위해)
      this._setupSocketHandlers();

      this._socket.on('connect', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this._connected = true;

        // 연결 시 register 메시지 전송
        if (this._pylonAddress && this._env) {
          this._sendMessage({
            action: 'register',
            pylonAddress: this._pylonAddress,
            env: this._env,
          });
        }

        resolve();
      });

      this._socket.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this._connected = false;
        reject(err);
      });
    });
  }

  /**
   * 연결 해제
   */
  async disconnect(): Promise<void> {
    // 의도적 연결 해제 표시 (재연결 방지)
    this._intentionalDisconnect = true;

    // 재연결 타이머 정리
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnecting = false;
    this._reconnectAttempts = 0;

    // 대기 중인 소켓 정리
    if (this._pendingSocket) {
      this._pendingSocket.removeAllListeners();
      this._pendingSocket.destroy();
      this._pendingSocket = null;
    }

    const socket = this._socket;
    this._socket = null;
    this._connected = false;

    if (!socket) {
      return;
    }

    // 모든 이벤트 리스너 제거 후 소켓 파괴
    socket.removeAllListeners();
    socket.destroy();
  }

  // ============================================================================
  // 공개 메서드 - 쿼리
  // ============================================================================

  /**
   * Claude에 쿼리 실행
   */
  async *query(options: BeaconQueryOptions): AsyncIterable<ClaudeMessage> {
    if (!this._connected) {
      throw new Error('Not connected to Beacon server');
    }

    // canUseTool 콜백 저장
    this._currentCanUseTool = options.canUseTool;

    // entityId 결정: 옵션에서 받거나 생성자에서 받은 값 사용
    const entityId = options.entityId ?? this._entityId;

    // 쿼리 요청 전송
    const queryMessage = {
      action: 'query',
      entityId,
      options: {
        prompt: options.prompt,
        cwd: options.cwd,
        includePartialMessages: options.includePartialMessages,
        settingSources: options.settingSources,
        resume: options.resume,
        mcpServers: options.mcpServers,
        env: options.env,
      },
    };
    this._sendMessage(queryMessage);

    // 이벤트 스트림 수신
    const abortController = options.abortController;
    let done = false;

    while (!done && !abortController.signal.aborted) {
      const event = await this._waitForEvent();

      if (!event) {
        // 연결 종료 또는 중단
        break;
      }

      if (abortController.signal.aborted) {
        break;
      }

      // 에러 이벤트 처리
      if (event.type === 'error') {
        throw new Error(event.error || 'Unknown error from Beacon');
      }

      // 권한 요청 처리
      if (event.type === 'permission_request') {
        await this._handlePermissionRequest(event);
        continue;
      }

      // 일반 이벤트 처리
      if (event.type === 'event' && event.message) {
        yield event.message;

        // result 메시지면 종료
        if (event.message.type === 'result') {
          done = true;
        }
      }
    }
  }

  // ============================================================================
  // Private 메서드 - 소켓 핸들링
  // ============================================================================

  /**
   * 소켓 이벤트 핸들러 설정
   */
  private _setupSocketHandlers(): void {
    if (!this._socket) return;

    this._socket.on('data', (data) => {
      this._buffer += data.toString();
      this._processBuffer();
    });

    this._socket.on('close', () => {
      const wasConnected = this._connected;
      this._connected = false;
      this._socket = null;

      if (wasConnected) {
        this._onDisconnect?.();
        // 의도적 연결 해제가 아니고 재연결 중이 아닌 경우에만 재연결 시작
        if (!this._intentionalDisconnect && !this._reconnecting) {
          this._startReconnect();
        }
      }

      // 대기 중인 이벤트 waiter 해제
      if (this._eventWaiter) {
        this._eventWaiter(null);
        this._eventWaiter = null;
      }
    });

    this._socket.on('error', () => {
      this._connected = false;
    });
  }

  /**
   * 수신 버퍼 처리
   */
  private _processBuffer(): void {
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const event = JSON.parse(line) as BeaconEvent;
          this._handleEvent(event);
        } catch {
          // JSON 파싱 실패 무시
        }
      }
    }
  }

  /**
   * 이벤트 처리
   */
  private _handleEvent(event: BeaconEvent): void {
    // 이벤트 waiter가 있으면 바로 전달
    if (this._eventWaiter) {
      const waiter = this._eventWaiter;
      this._eventWaiter = null;
      waiter(event);
    } else {
      // 없으면 큐에 추가
      this._eventQueue.push(event);
    }
  }

  /**
   * 다음 이벤트 대기
   */
  private _waitForEvent(): Promise<BeaconEvent | null> {
    // 큐에 이벤트가 있으면 바로 반환
    if (this._eventQueue.length > 0) {
      return Promise.resolve(this._eventQueue.shift()!);
    }

    // 없으면 대기
    return new Promise((resolve) => {
      this._eventWaiter = resolve;
    });
  }

  /**
   * 메시지 전송
   */
  private _sendMessage(message: Record<string, unknown>): void {
    if (this._socket && this._connected) {
      this._socket.write(JSON.stringify(message) + '\n');
    }
  }

  /**
   * 권한 요청 처리
   */
  private async _handlePermissionRequest(event: BeaconEvent): Promise<void> {
    const { toolUseId } = event;

    if (!this._currentCanUseTool || !event.toolName) {
      // 권한 거부 응답
      this._sendMessage({
        action: 'permission_response',
        toolUseId,
        behavior: 'deny',
        message: 'No permission handler',
      });
      return;
    }

    try {
      const result = await this._currentCanUseTool(
        event.toolName,
        event.input || {}
      );

      this._sendMessage({
        action: 'permission_response',
        toolUseId,
        behavior: result.behavior,
        message: result.message,
        updatedInput: result.updatedInput,
      });
    } catch (err) {
      this._sendMessage({
        action: 'permission_response',
        toolUseId,
        behavior: 'deny',
        message: err instanceof Error ? err.message : 'Permission error',
      });
    }
  }

  // ============================================================================
  // Private 메서드 - 재연결
  // ============================================================================

  /**
   * 재연결 시작
   */
  private _startReconnect(): void {
    if (!this._reconnect || this._reconnecting) return;

    this._reconnecting = true;
    this._scheduleReconnect();
  }

  /**
   * 재연결 스케줄링
   */
  private _scheduleReconnect(): void {
    this._reconnectTimer = setTimeout(async () => {
      // 의도적 연결 해제인 경우 중단
      if (this._intentionalDisconnect) {
        this._reconnecting = false;
        return;
      }

      this._reconnectAttempts++;

      try {
        await this._doReconnect();
        // 성공 후 다시 체크 (비동기 사이에 disconnect 호출될 수 있음)
        if (this._intentionalDisconnect) {
          this._reconnecting = false;
          // 연결된 소켓 정리
          if (this._socket) {
            this._socket.destroy();
            this._socket = null;
          }
          this._connected = false;
          return;
        }
        // 성공 시
        this._reconnecting = false;
        this._reconnectAttempts = 0;
        this._onReconnect?.();
      } catch {
        // 의도적 연결 해제인 경우 중단
        if (this._intentionalDisconnect) {
          this._reconnecting = false;
          return;
        }
        // 실패 시
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
          this._reconnecting = false;
          this._onReconnectFailed?.(this._reconnectAttempts);
        } else {
          this._scheduleReconnect();
        }
      }
    }, this._reconnectInterval);
  }

  /**
   * 실제 재연결 수행 (connect와 유사하지만 이미 연결 상태 체크 스킵)
   */
  private async _doReconnect(): Promise<void> {
    // 의도적 연결 해제인 경우 즉시 중단
    if (this._intentionalDisconnect) {
      throw new Error('Disconnected intentionally');
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        this._pendingSocket = null;
      };

      // 의도적 연결 해제 체크를 위한 interval
      const checkDisconnect = setInterval(() => {
        if (this._intentionalDisconnect && !settled) {
          settled = true;
          clearTimeout(timeout);
          clearInterval(checkDisconnect);
          if (this._pendingSocket) {
            this._pendingSocket.destroy();
          }
          cleanup();
          reject(new Error('Disconnected intentionally'));
        }
      }, 10);

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          clearInterval(checkDisconnect);
          if (this._pendingSocket) {
            this._pendingSocket.destroy();
          }
          cleanup();
          reject(new Error('Connection timeout'));
        }
      }, this._connectTimeout);

      // 새 소켓 생성 및 pendingSocket에 저장
      this._pendingSocket = createConnection(
        { host: this._host, port: this._port }
      );
      const socket = this._pendingSocket;

      socket.on('connect', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearInterval(checkDisconnect);

        // 의도적 연결 해제가 요청된 경우 또는 소켓이 이미 파괴된 경우
        if (this._intentionalDisconnect || socket.destroyed) {
          if (!socket.destroyed) {
            socket.destroy();
          }
          cleanup();
          reject(new Error('Disconnected intentionally'));
          return;
        }

        // pendingSocket을 _socket으로 승격
        this._socket = socket;
        this._pendingSocket = null;
        this._connected = true;

        // 연결 전에 핸들러 설정
        this._setupSocketHandlers();

        // 연결 시 register 메시지 전송
        if (this._pylonAddress && this._env) {
          this._sendMessage({
            action: 'register',
            pylonAddress: this._pylonAddress,
            env: this._env,
          });
        }

        resolve();
      });

      socket.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearInterval(checkDisconnect);
        cleanup();
        this._connected = false;
        reject(err);
      });

      socket.on('close', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          clearInterval(checkDisconnect);
          cleanup();
          reject(new Error('Connection closed'));
        }
      });
    });
  }
}
