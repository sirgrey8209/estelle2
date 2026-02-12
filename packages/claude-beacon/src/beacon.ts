/**
 * @file beacon.ts
 * @description ClaudeBeacon - 단일 SDK 인스턴스로 여러 Pylon을 서비스하는 메인 클래스
 *
 * 아키텍처:
 * - TCP 서버로 Pylon 연결 관리
 * - ToolContextMap: toolUseId -> PylonInfo 매핑
 * - ClaudeAdapter: SDK 어댑터 (주입 가능)
 *
 * 통신 프로토콜:
 * - Pylon → Beacon (register): { "action": "register", "pylonId": 65, "mcpHost": "127.0.0.1", "mcpPort": 9878, "env": "dev" }
 * - Pylon → Beacon (query): { "action": "query", "conversationId": 2049, "options": { ... } }
 * - Beacon → Pylon (event): { "type": "event", "conversationId": 2049, "message": { ... } }
 */

import { createServer, type Server, type Socket } from 'net';
import { ToolContextMap, type ToolContext, type ToolUseRaw } from './tool-context-map.js';
import { PylonRegistry, extractPylonId, getEnvName } from './pylon-registry.js';

// ============================================================================
// 상수
// ============================================================================

/** 기본 포트 */
const DEFAULT_PORT = 9877;

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 활성 연결 정보
 */
interface ActiveConnection {
  socket: Socket;
  pylonId: number;
}

/**
 * Claude 메시지 (어댑터에서 반환)
 */
interface ClaudeMessage {
  type: string;
  subtype?: string;
  event?: {
    type: string;
    content_block?: {
      type: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    };
  };
  [key: string]: unknown;
}

/**
 * Claude 어댑터 인터페이스
 */
interface ClaudeAdapter {
  query(options: unknown): AsyncIterable<ClaudeMessage>;
}

/**
 * ClaudeBeacon 옵션
 */
export interface ClaudeBeaconOptions {
  /** SDK 어댑터 */
  adapter: ClaudeAdapter;

  /** TCP 서버 포트 */
  port?: number;

  /** ToolContextMap (외부 주입 가능) */
  toolContextMap?: ToolContextMap;

  /** PylonRegistry (외부 주입 가능) */
  pylonRegistry?: PylonRegistry;
}

/**
 * 요청 메시지
 */
interface RequestMessage {
  action: string;
  // register 전용 필드
  pylonId?: number;
  mcpHost?: string;
  mcpPort?: number;
  env?: string;
  force?: boolean;
  // query 전용 필드
  conversationId?: number;
  options?: Record<string, unknown>;
  // permission_response 전용 필드
  toolUseId?: string;
  behavior?: 'allow' | 'deny';
  message?: string;
  updatedInput?: Record<string, unknown>;
}

/**
 * 응답 메시지
 */
interface ResponseMessage {
  success: boolean;
  error?: string;
}

// ============================================================================
// ClaudeBeacon 클래스
// ============================================================================

/**
 * ClaudeBeacon - 단일 SDK로 여러 Pylon을 서비스하는 메인 클래스
 */
export class ClaudeBeacon {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /** SDK 어댑터 */
  private readonly _adapter: ClaudeAdapter;

  /** TCP 서버 포트 */
  private readonly _port: number;

  /** ToolContextMap */
  private readonly _toolContextMap: ToolContextMap;

  /** PylonRegistry */
  private readonly _pylonRegistry: PylonRegistry;

  /** TCP 서버 */
  private _server: Server | null = null;

  /** 실행 상태 */
  private _running: boolean = false;

  /** 활성 연결 (소켓 -> ActiveConnection) */
  private readonly _activeConnections: Map<Socket, ActiveConnection> = new Map();

  /** 대기 중인 권한 요청 (toolUseId -> { resolve, reject }) */
  private readonly _pendingPermissions: Map<
    string,
    {
      resolve: (result:
        | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
        | { behavior: 'deny'; message: string }
      ) => void;
      reject: (error: Error) => void;
    }
  > = new Map();

  // ============================================================================
  // 생성자
  // ============================================================================

  constructor(options: ClaudeBeaconOptions) {
    this._adapter = options.adapter;
    this._port = options.port ?? DEFAULT_PORT;
    this._toolContextMap = options.toolContextMap ?? new ToolContextMap();
    this._pylonRegistry = options.pylonRegistry ?? new PylonRegistry();
  }

  // ============================================================================
  // 공개 속성
  // ============================================================================

  /** 포트 */
  get port(): number {
    return this._port;
  }

  /** ToolContextMap */
  get toolContextMap(): ToolContextMap {
    return this._toolContextMap;
  }

  /** PylonRegistry */
  get pylonRegistry(): PylonRegistry {
    return this._pylonRegistry;
  }

  /** 실행 상태 */
  get isRunning(): boolean {
    return this._running;
  }

  // ============================================================================
  // 공개 메서드 - 서버 관리
  // ============================================================================

  /**
   * TCP 서버 시작
   */
  async start(): Promise<void> {
    if (this._running) {
      return;
    }

    return new Promise((resolve, reject) => {
      this._server = createServer((socket) => {
        this._handleConnection(socket);
      });

      this._server.on('error', reject);

      this._server.listen(this._port, '127.0.0.1', () => {
        this._running = true;
        resolve();
      });
    });
  }

  /**
   * TCP 서버 종료
   */
  async stop(): Promise<void> {
    if (!this._running || !this._server) {
      return;
    }

    return new Promise((resolve) => {
      // 모든 소켓 종료
      for (const [socket] of this._activeConnections) {
        socket.destroy();
      }
      this._activeConnections.clear();
      this._pylonRegistry.clear();

      this._server!.close(() => {
        this._running = false;
        this._server = null;
        resolve();
      });
    });
  }

  // ============================================================================
  // 공개 메서드 - Pylon 관리
  // ============================================================================

  /**
   * 등록된 Pylon 목록
   */
  getPylons(): Array<{ pylonId: number; mcpHost: string; mcpPort: number; env: string }> {
    return this._pylonRegistry.getAll().map((conn) => ({
      pylonId: conn.pylonId,
      mcpHost: conn.mcpHost,
      mcpPort: conn.mcpPort,
      env: getEnvName(conn.pylonId),
    }));
  }

  /**
   * 연결된 Pylon 수
   */
  getConnectedPylonCount(): number {
    return this._activeConnections.size;
  }

  // ============================================================================
  // Private 메서드 - 연결 관리
  // ============================================================================

  /**
   * 새 연결 처리
   */
  private _handleConnection(socket: Socket): void {
    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();

      // 줄바꿈으로 구분된 JSON 메시지 처리
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          this._handleMessage(socket, line);
        }
      }
    });

    socket.on('close', () => {
      this._handleDisconnect(socket);
    });

    socket.on('error', () => {
      this._handleDisconnect(socket);
    });
  }

  /**
   * 연결 해제 처리
   */
  private _handleDisconnect(socket: Socket): void {
    // 활성 연결만 제거 (등록 정보는 유지)
    this._activeConnections.delete(socket);
  }

  /**
   * 메시지 처리
   */
  private _handleMessage(socket: Socket, line: string): void {
    try {
      const request = JSON.parse(line) as RequestMessage;
      // 로깅: 수신된 요청
      console.log(`[Beacon] << ${request.action}`, JSON.stringify(request).slice(0, 200));
      this._handleRequest(socket, request);
    } catch {
      this._sendResponse(socket, {
        success: false,
        error: 'Invalid JSON format',
      });
    }
  }

  /**
   * 요청 처리
   */
  private _handleRequest(socket: Socket, request: RequestMessage): void {
    switch (request.action) {
      case 'register':
        this._handleRegister(socket, request);
        break;

      case 'unregister':
        this._handleUnregister(socket, request);
        break;

      case 'query':
        this._handleQuery(socket, request);
        break;

      case 'permission_response':
        this._handlePermissionResponse(request);
        break;

      case 'lookup':
        this._handleLookup(socket, request);
        break;

      case 'ping':
        this._handlePing(socket);
        break;

      default:
        this._sendResponse(socket, {
          success: false,
          error: `Unknown action: ${request.action}`,
        });
    }
  }

  // ============================================================================
  // Private 메서드 - 액션 핸들러
  // ============================================================================

  /**
   * register 처리
   *
   * 요청 필드:
   * - pylonId: Pylon ID (envId << 5 | 0 << 4 | deviceIndex)
   * - mcpHost: MCP 서버 호스트
   * - mcpPort: MCP 서버 포트
   * - env: 환경 (dev/stage/release)
   * - force: 강제 등록 여부
   */
  private _handleRegister(socket: Socket, request: RequestMessage): void {
    const { pylonId, mcpHost, mcpPort, env, force } = request;

    if (pylonId === undefined || !mcpHost || !mcpPort || !env) {
      this._sendResponse(socket, {
        success: false,
        error: 'Missing pylonId, mcpHost, mcpPort, or env',
      });
      return;
    }

    // 이미 등록된 경우
    if (this._pylonRegistry.has(pylonId)) {
      if (force) {
        // 강제 업데이트 - PylonRegistry 갱신
        this._pylonRegistry.set(pylonId, { pylonId, mcpHost, mcpPort });
        // 활성 연결도 갱신
        this._activeConnections.set(socket, { socket, pylonId });
        this._sendResponse(socket, { success: true });
      } else {
        this._sendResponse(socket, {
          success: false,
          error: 'Pylon already registered',
        });
      }
      return;
    }

    // 새 등록 - PylonRegistry에 저장
    this._pylonRegistry.set(pylonId, { pylonId, mcpHost, mcpPort });
    // 활성 연결 추가
    this._activeConnections.set(socket, { socket, pylonId });

    console.log(`[Beacon] Registered: pylonId=${pylonId}, mcpHost=${mcpHost}, mcpPort=${mcpPort}, env=${env}`);
    this._sendResponse(socket, { success: true });
  }

  /**
   * unregister 처리
   */
  private _handleUnregister(socket: Socket, request: RequestMessage): void {
    const { pylonId } = request;

    if (pylonId === undefined) {
      this._sendResponse(socket, {
        success: false,
        error: 'Missing pylonId',
      });
      return;
    }

    if (!this._pylonRegistry.has(pylonId)) {
      this._sendResponse(socket, {
        success: false,
        error: 'Pylon not found',
      });
      return;
    }

    // PylonRegistry에서 삭제
    this._pylonRegistry.delete(pylonId);
    // 활성 연결에서도 삭제
    this._activeConnections.delete(socket);

    console.log(`[Beacon] Unregistered: pylonId=${pylonId}`);
    this._sendResponse(socket, { success: true });
  }

  /**
   * query 처리
   */
  private async _handleQuery(
    socket: Socket,
    request: RequestMessage
  ): Promise<void> {
    const { conversationId, options } = request;

    // conversationId 검증
    if (conversationId === undefined || conversationId === null) {
      this._sendResponse(socket, {
        success: false,
        error: 'Missing required field: conversationId',
      });
      return;
    }

    // 이 소켓이 활성 연결인지 확인
    let connection = this._activeConnections.get(socket);

    // 활성 연결이 없으면, 등록된 Pylon 중 첫 번째를 사용
    // (테스트에서 sendMessage가 매번 새 연결을 만드는 패턴 지원)
    if (!connection && this._pylonRegistry.size > 0) {
      const firstPylon = this._pylonRegistry.getAll()[0];
      if (firstPylon) {
        connection = { socket, pylonId: firstPylon.pylonId };
        this._activeConnections.set(socket, connection);
      }
    }

    if (!connection) {
      this._sendResponse(socket, {
        success: false,
        error: 'Pylon not registered',
      });
      return;
    }

    try {
      // canUseTool 콜백 생성 - Pylon에 권한 요청을 보내고 응답을 기다림
      // SDK CanUseTool 시그니처: (toolName, input, options) => Promise<PermissionResult>
      const canUseTool = async (
        toolName: string,
        input: Record<string, unknown>,
        permOptions: { signal: AbortSignal; toolUseID: string; [key: string]: unknown }
      ): Promise<
        | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
        | { behavior: 'deny'; message: string }
      > => {
        const toolUseId = permOptions.toolUseID;
        return new Promise((resolve, reject) => {
          // 대기 목록에 등록 (toolUseId로 구분)
          this._pendingPermissions.set(toolUseId, { resolve, reject });

          // Pylon에 권한 요청 전송
          socket.write(
            JSON.stringify({
              type: 'permission_request',
              conversationId,
              toolName,
              input,
              toolUseId,
            }) + '\n'
          );
        });
      };

      // SDK 어댑터에 쿼리 전달 (canUseTool 콜백 포함)
      const queryOptions = { ...options, canUseTool };
      const opts = options as Record<string, unknown>;
      console.log(`[Beacon] SDK query options:`, JSON.stringify({
        cwd: opts.cwd,
        env: opts.env,
        settingSources: opts.settingSources,
        resume: opts.resume ? '(set)' : '(none)',
        CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
      }));
      const query = this._adapter.query(queryOptions);

      for await (const message of query) {
        // content_block_start 시 ToolContextMap에 등록
        this._registerToolUse(message, conversationId);

        // 이벤트 전송
        this._sendEvent(socket, conversationId, message);
      }
    } catch (err) {
      // 에러 로깅 (상세)
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Beacon] Query error (conversationId=${conversationId}): ${errorMessage}`);
      if (err instanceof Error && err.stack) {
        console.error(`[Beacon] Stack: ${err.stack}`);
      }
      // err 객체의 추가 속성 출력
      const extras = Object.getOwnPropertyNames(err || {}).filter(k => k !== 'message' && k !== 'stack');
      if (extras.length > 0) {
        const obj: Record<string, unknown> = {};
        for (const k of extras) { obj[k] = (err as Record<string, unknown>)[k]; }
        console.error(`[Beacon] Error details:`, JSON.stringify(obj));
      }

      // 에러 이벤트 전송
      socket.write(
        JSON.stringify({
          type: 'error',
          conversationId,
          error: errorMessage,
        }) + '\n'
      );
    }
  }

  /**
   * tool_use를 ToolContextMap에 등록
   */
  private _registerToolUse(
    message: ClaudeMessage,
    conversationId: number
  ): void {
    if (message.type !== 'stream_event' || !message.event) {
      return;
    }

    const event = message.event;
    if (event.type !== 'content_block_start') {
      return;
    }

    const block = event.content_block;
    if (!block || block.type !== 'tool_use' || !block.id) {
      return;
    }

    // ToolContextMap에 등록
    const raw: ToolUseRaw = {
      type: 'tool_use',
      id: block.id,
      name: block.name || '',
      input: block.input || {},
    };

    const context: ToolContext = {
      conversationId,
      raw,
    };

    this._toolContextMap.set(block.id, context);
    // 로깅: tool_use 등록
    console.log(`[Beacon] ToolContextMap.set: toolUseId=${block.id}, conversationId=${conversationId}, name=${block.name}, mapSize=${this._toolContextMap.size}`);
  }

  /**
   * permission_response 처리
   *
   * Pylon에서 권한 응답이 오면 대기 중인 Promise를 resolve
   */
  private _handlePermissionResponse(request: RequestMessage): void {
    const { toolUseId, behavior, message, updatedInput } = request;

    if (!toolUseId) {
      console.error('[Beacon] permission_response missing toolUseId');
      return;
    }

    const pending = this._pendingPermissions.get(toolUseId);
    if (!pending) {
      console.error(`[Beacon] No pending permission for toolUseId: ${toolUseId}`);
      return;
    }

    // 대기 목록에서 제거
    this._pendingPermissions.delete(toolUseId);

    // Promise resolve - SDK PermissionResult 형식에 맞게
    if (behavior === 'allow') {
      pending.resolve({
        behavior: 'allow',
        updatedInput,
      });
    } else {
      pending.resolve({
        behavior: 'deny',
        message: message || 'Permission denied',
      });
    }
  }

  /**
   * ping 처리 - pong 응답
   */
  private _handlePing(socket: Socket): void {
    socket.write(JSON.stringify({ type: 'pong' }) + '\n');
  }

  /**
   * lookup 처리 - ToolContextMap에서 toolUseId로 Pylon 정보 조회
   *
   * 응답:
   * - conversationId: 대화 ID
   * - mcpHost, mcpPort: PylonRegistry에서 조회한 MCP 서버 정보
   * - raw: 도구 호출 원본 데이터
   */
  private _handleLookup(socket: Socket, request: RequestMessage): void {
    const { toolUseId } = request;

    // 로깅: lookup 요청
    console.log(`[Beacon] lookup: toolUseId=${toolUseId}, mapSize=${this._toolContextMap.size}`);

    if (!toolUseId || toolUseId === '') {
      console.log(`[Beacon] lookup FAIL: empty toolUseId`);
      this._sendResponse(socket, {
        success: false,
        error: 'Missing or empty toolUseId field',
      });
      return;
    }

    const context = this._toolContextMap.get(toolUseId);
    if (!context) {
      console.log(`[Beacon] lookup FAIL: toolUseId not found in map`);
      this._sendResponse(socket, {
        success: false,
        error: 'Tool use ID not found',
      });
      return;
    }

    // conversationId에서 pylonId 추출하여 PylonRegistry에서 연결 정보 조회
    const pylonId = extractPylonId(context.conversationId);
    const connection = this._pylonRegistry.get(pylonId);

    if (!connection) {
      console.log(`[Beacon] lookup FAIL: pylonId=${pylonId} not found in registry`);
      this._sendResponse(socket, {
        success: false,
        error: `Pylon not registered: pylonId=${pylonId}`,
      });
      return;
    }

    console.log(`[Beacon] lookup OK: conversationId=${context.conversationId}, pylonId=${pylonId}, mcpHost=${connection.mcpHost}, mcpPort=${connection.mcpPort}`);
    socket.write(JSON.stringify({
      success: true,
      conversationId: context.conversationId,
      mcpHost: connection.mcpHost,
      mcpPort: connection.mcpPort,
      raw: context.raw,
    }) + '\n');
  }

  // ============================================================================
  // Private 메서드 - 응답 전송
  // ============================================================================

  /**
   * 응답 전송
   */
  private _sendResponse(socket: Socket, response: ResponseMessage): void {
    socket.write(JSON.stringify(response) + '\n');
  }

  /**
   * 이벤트 전송
   */
  private _sendEvent(
    socket: Socket,
    conversationId: number,
    message: ClaudeMessage
  ): void {
    socket.write(
      JSON.stringify({
        type: 'event',
        conversationId,
        message,
      }) + '\n'
    );
  }
}
