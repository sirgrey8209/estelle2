/**
 * @file beacon-adapter.ts
 * @description ClaudeBeaconAdapter - Pylon이 ClaudeBeacon을 통해 SDK를 호출하기 위한 어댑터
 *
 * ClaudeAdapter 인터페이스를 구현하여 ClaudeManager에 주입 가능.
 * TCP를 통해 ClaudeBeacon 서버와 통신.
 *
 * 통신 프로토콜:
 * - 연결 시: { "action": "register", "pylonId": 65, "mcpHost": "127.0.0.1", "mcpPort": 9878, "env": "dev" }
 * - 쿼리 요청: { "action": "query", "conversationId": 2049, "options": { "prompt": "...", "cwd": "..." } }
 * - 이벤트 스트림: { "type": "event", "conversationId": 2049, "message": { ... } }
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

/** 기본 Ping 간격 (10초) */
const DEFAULT_PING_INTERVAL = 10000;

/** 기본 Ping 타임아웃 (20초) */
const DEFAULT_PING_TIMEOUT = 20000;

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

  /** 대화 ID (세션 식별자) */
  conversationId?: number;

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

/** 기본 재연결 간격 (3초) */
const DEFAULT_RECONNECT_INTERVAL = 3000;

/**
 * BeaconAdapter 옵션
 */
export interface BeaconAdapterOptions {
  /** Beacon 서버 호스트 */
  host?: string;

  /** Beacon 서버 포트 */
  port?: number;

  /** Pylon ID (등록용) - pylonId = (envId << 5) | (0 << 4) | deviceIndex */
  pylonId?: number;

  /** MCP 서버 호스트 (등록용) */
  mcpHost?: string;

  /** MCP 서버 포트 (등록용) */
  mcpPort?: number;

  /** 환경 (dev/stage/release) */
  env?: string;

  /** 대화 ID (쿼리용) */
  conversationId?: number;

  /** 연결 타임아웃 (밀리초) */
  connectTimeout?: number;

  /** 연결 해제 콜백 */
  onDisconnect?: () => void;

  /** 재연결 성공 콜백 */
  onReconnect?: () => void;

  /** Ping 간격 (밀리초, 기본: 10000) */
  pingInterval?: number;

  /** Ping 타임아웃 (밀리초, 기본: 20000) */
  pingTimeout?: number;
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
  conversationId?: number;
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

  /** Pylon ID */
  private readonly _pylonId?: number;

  /** MCP 서버 호스트 */
  private readonly _mcpHost?: string;

  /** MCP 서버 포트 */
  private readonly _mcpPort?: number;

  /** 환경 */
  private readonly _env?: string;

  /** 대화 ID */
  private readonly _conversationId?: number;

  /** 연결 타임아웃 */
  private readonly _connectTimeout: number;

  /** 연결 해제 콜백 */
  private readonly _onDisconnect?: () => void;

  /** 재연결 성공 콜백 */
  private readonly _onReconnect?: () => void;

  /** 재연결 간격 (밀리초) */
  private readonly _reconnectInterval: number;

  /** 재연결 중 여부 */
  private _reconnecting: boolean = false;

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

  /** 대기 중인 이벤트 큐 (conversationId별) */
  private _eventQueues: Map<number, BeaconEvent[]> = new Map();

  /** 이벤트 대기 Promise resolver (conversationId별) */
  private _eventWaiters: Map<number, (event: BeaconEvent | null) => void> = new Map();

  /** 현재 쿼리 중인 conversationId */
  private _currentConversationId: number | null = null;

  /** 현재 canUseTool 콜백 */
  private _currentCanUseTool?: (
    toolName: string,
    input: Record<string, unknown>
  ) => Promise<PermissionCallbackResult>;

  /** Ping 간격 (밀리초) */
  private readonly _pingInterval: number;

  /** Ping 타임아웃 (밀리초) */
  private readonly _pingTimeout: number;

  /** Ping 타이머 */
  private _pingTimer: ReturnType<typeof setInterval> | null = null;

  /** 마지막 pong 수신 시간 */
  private _lastPongTime: number = 0;

  // ============================================================================
  // 생성자
  // ============================================================================

  constructor(options: BeaconAdapterOptions = {}) {
    this._host = options.host ?? DEFAULT_HOST;
    this._port = options.port ?? DEFAULT_PORT;
    this._pylonId = options.pylonId;
    this._mcpHost = options.mcpHost;
    this._mcpPort = options.mcpPort;
    this._env = options.env;
    this._conversationId = options.conversationId;
    this._connectTimeout = options.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
    this._onDisconnect = options.onDisconnect;
    this._onReconnect = options.onReconnect;
    this._reconnectInterval = DEFAULT_RECONNECT_INTERVAL;
    this._pingInterval = options.pingInterval ?? DEFAULT_PING_INTERVAL;
    this._pingTimeout = options.pingTimeout ?? DEFAULT_PING_TIMEOUT;
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

  /** Pylon ID */
  get pylonId(): number | undefined {
    return this._pylonId;
  }

  /** MCP 서버 호스트 */
  get mcpHost(): string | undefined {
    return this._mcpHost;
  }

  /** MCP 서버 포트 */
  get mcpPort(): number | undefined {
    return this._mcpPort;
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
   *
   * @param autoRetry - 초기 연결 실패 시 자동 재시도 여부 (기본: false)
   */
  async connect(autoRetry: boolean = false): Promise<void> {
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
          const err = new Error('Connection timeout');
          if (autoRetry) {
            console.log(`[BeaconAdapter] Initial connection timeout, starting auto-retry...`);
            this._startReconnect();
            resolve(); // 재시도 시작했으므로 resolve
          } else {
            reject(err);
          }
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
        if (this._pylonId !== undefined && this._mcpHost && this._mcpPort && this._env) {
          this._sendMessage({
            action: 'register',
            pylonId: this._pylonId,
            mcpHost: this._mcpHost,
            mcpPort: this._mcpPort,
            env: this._env,
          });
        }

        // Heartbeat 시작
        this._startPing();

        resolve();
      });

      this._socket.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this._connected = false;
        if (autoRetry) {
          console.log(`[BeaconAdapter] Initial connection failed: ${err.message}, starting auto-retry...`);
          this._startReconnect();
          resolve(); // 재시도 시작했으므로 resolve
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * 연결 해제
   */
  async disconnect(): Promise<void> {
    // 의도적 연결 해제 표시 (재연결 방지)
    this._intentionalDisconnect = true;

    // Heartbeat 중지
    this._stopPing();

    // 재연결 타이머 정리
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnecting = false;

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

    // conversationId 결정: 옵션에서 받거나 생성자에서 받은 값 사용
    const conversationId = options.conversationId ?? this._conversationId;

    // conversationId 필수 확인
    if (conversationId === undefined) {
      throw new Error('conversationId is required for query');
    }

    // 쿼리 요청 전송
    const queryMessage = {
      action: 'query',
      conversationId,
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

    try {
      while (!done && !abortController.signal.aborted) {
        const event = await this._waitForEvent(conversationId);

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
    } finally {
      // 쿼리 종료 시 해당 conversationId의 큐와 waiter 정리
      this._eventQueues.delete(conversationId);
      this._eventWaiters.delete(conversationId);
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

      // 대기 중인 모든 이벤트 waiter 해제
      for (const waiter of this._eventWaiters.values()) {
        waiter(null);
      }
      this._eventWaiters.clear();
      this._eventQueues.clear();
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
    // pong 이벤트는 heartbeat용이므로 별도 처리
    if (event.type === 'pong') {
      this._handlePong();
      return;
    }

    // conversationId 추출 (이벤트, 에러, 권한 요청 모두 conversationId를 포함)
    const conversationId = event.conversationId;

    // DEBUG: 이벤트 수신 로그
    const queueSize = conversationId !== undefined ? (this._eventQueues.get(conversationId)?.length ?? 0) : 0;
    const hasWaiter = conversationId !== undefined ? this._eventWaiters.has(conversationId) : false;
    console.log(`[BeaconAdapter] _handleEvent: type=${event.type}, conversationId=${conversationId}, hasWaiter=${hasWaiter}, queueSize=${queueSize}`);

    // conversationId가 없으면 무시 (예: 응답 메시지)
    if (conversationId === undefined) {
      return;
    }

    // 해당 conversationId의 waiter가 있으면 바로 전달
    const waiter = this._eventWaiters.get(conversationId);
    if (waiter) {
      this._eventWaiters.delete(conversationId);
      waiter(event);
    } else {
      // 없으면 해당 conversationId의 큐에 추가
      let queue = this._eventQueues.get(conversationId);
      if (!queue) {
        queue = [];
        this._eventQueues.set(conversationId, queue);
      }
      queue.push(event);
    }
  }

  /**
   * 다음 이벤트 대기 (conversationId별)
   */
  private _waitForEvent(conversationId: number): Promise<BeaconEvent | null> {
    // 해당 conversationId의 큐에 이벤트가 있으면 바로 반환
    const queue = this._eventQueues.get(conversationId);
    if (queue && queue.length > 0) {
      return Promise.resolve(queue.shift()!);
    }

    // 없으면 대기
    return new Promise((resolve) => {
      this._eventWaiters.set(conversationId, resolve);
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
    const { toolUseId, conversationId } = event;

    if (!this._currentCanUseTool || !event.toolName) {
      // 권한 거부 응답
      this._sendMessage({
        action: 'permission_response',
        conversationId,
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
        conversationId,
        toolUseId,
        behavior: result.behavior,
        message: result.message,
        updatedInput: result.updatedInput,
      });
    } catch (err) {
      this._sendMessage({
        action: 'permission_response',
        conversationId,
        toolUseId,
        behavior: 'deny',
        message: err instanceof Error ? err.message : 'Permission error',
      });
    }
  }

  // ============================================================================
  // Private 메서드 - Ping/Pong
  // ============================================================================

  /**
   * Ping 시작
   */
  private _startPing(): void {
    this._stopPing(); // 기존 타이머 정리
    this._lastPongTime = Date.now();

    // 주기적 ping 전송
    this._pingTimer = setInterval(() => {
      if (!this._connected || !this._socket) {
        this._stopPing();
        return;
      }

      // ping 전송
      this._sendMessage({ action: 'ping' });

      // 타임아웃 체크 (마지막 pong 이후 시간)
      const elapsed = Date.now() - this._lastPongTime;
      if (elapsed > this._pingTimeout) {
        console.log(`[BeaconAdapter] Ping timeout (${elapsed}ms), forcing reconnect`);
        this._forceReconnect();
      }
    }, this._pingInterval);
  }

  /**
   * Ping 중지
   */
  private _stopPing(): void {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  /**
   * pong 수신 처리
   */
  private _handlePong(): void {
    this._lastPongTime = Date.now();
  }

  /**
   * 강제 재연결 (ping 타임아웃 시)
   */
  private _forceReconnect(): void {
    this._stopPing();

    // 현재 소켓 강제 종료 (close 이벤트가 재연결 트리거)
    if (this._socket) {
      this._socket.destroy();
      // _socket = null과 _connected = false는 close 이벤트에서 처리됨
    }
  }

  // ============================================================================
  // Private 메서드 - 재연결
  // ============================================================================

  /**
   * 재연결 시작
   */
  private _startReconnect(): void {
    if (this._reconnecting) return;

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
        this._onReconnect?.();
      } catch {
        // 의도적 연결 해제인 경우 중단
        if (this._intentionalDisconnect) {
          this._reconnecting = false;
          return;
        }
        // 실패 시 - 무한 재시도
        this._scheduleReconnect();
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
        if (this._pylonId !== undefined && this._mcpHost && this._mcpPort && this._env) {
          this._sendMessage({
            action: 'register',
            pylonId: this._pylonId,
            mcpHost: this._mcpHost,
            mcpPort: this._mcpPort,
            env: this._env,
          });
        }

        // Heartbeat 시작
        this._startPing();

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
