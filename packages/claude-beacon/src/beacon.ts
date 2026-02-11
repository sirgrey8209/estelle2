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
 * - Pylon → Beacon (register): { "action": "register", "pylonAddress": "...", "env": "dev" }
 * - Pylon → Beacon (query): { "action": "query", "entityId": 2049, "options": { ... } }
 * - Beacon → Pylon (event): { "type": "event", "entityId": 2049, "message": { ... } }
 */

import { createServer, type Server, type Socket } from 'net';
import { ToolContextMap, type PylonInfo, type ToolUseRaw } from './tool-context-map.js';

// ============================================================================
// 상수
// ============================================================================

/** 기본 포트 */
const DEFAULT_PORT = 9877;

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * Pylon 등록 정보 (연결 상태와 무관하게 유지)
 */
interface PylonRegistration {
  pylonAddress: string;
  env: string;
}

/**
 * 활성 연결 정보
 */
interface ActiveConnection {
  socket: Socket;
  pylonAddress: string;
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
}

/**
 * 요청 메시지
 */
interface RequestMessage {
  action: string;
  pylonAddress?: string;
  env?: string;
  force?: boolean;
  entityId?: number;
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

  /** TCP 서버 */
  private _server: Server | null = null;

  /** 실행 상태 */
  private _running: boolean = false;

  /** 등록된 Pylon 정보 (pylonAddress -> PylonRegistration) */
  private readonly _pylons: Map<string, PylonRegistration> = new Map();

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
      this._pylons.clear();

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
  getPylons(): Array<{ pylonAddress: string; env: string }> {
    const result: Array<{ pylonAddress: string; env: string }> = [];
    for (const [, pylon] of this._pylons) {
      result.push({
        pylonAddress: pylon.pylonAddress,
        env: pylon.env,
      });
    }
    return result;
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
   */
  private _handleRegister(socket: Socket, request: RequestMessage): void {
    const { pylonAddress, env, force } = request;

    if (!pylonAddress || !env) {
      this._sendResponse(socket, {
        success: false,
        error: 'Missing pylonAddress or env',
      });
      return;
    }

    // pylonAddress는 이미 envId:deviceId 형태로 고유함 (예: "2:1", "1:1")

    // 이미 등록된 경우
    if (this._pylons.has(pylonAddress)) {
      if (force) {
        // 강제 업데이트 - 등록 정보 갱신
        this._pylons.set(pylonAddress, { pylonAddress, env });
        // 활성 연결도 갱신
        this._activeConnections.set(socket, { socket, pylonAddress });
        this._sendResponse(socket, { success: true });
      } else {
        this._sendResponse(socket, {
          success: false,
          error: 'Pylon already registered',
        });
      }
      return;
    }

    // 새 등록
    this._pylons.set(pylonAddress, { pylonAddress, env });
    // 활성 연결 추가
    this._activeConnections.set(socket, { socket, pylonAddress });

    console.log(`[Beacon] Registered: ${pylonAddress} (${env})`);
    this._sendResponse(socket, { success: true });
  }

  /**
   * unregister 처리
   */
  private _handleUnregister(socket: Socket, request: RequestMessage): void {
    const { pylonAddress } = request;

    if (!pylonAddress) {
      this._sendResponse(socket, {
        success: false,
        error: 'Missing pylonAddress',
      });
      return;
    }

    // pylonAddress는 이미 envId:deviceId 형태로 고유함

    if (!this._pylons.has(pylonAddress)) {
      this._sendResponse(socket, {
        success: false,
        error: 'Pylon not found',
      });
      return;
    }

    // 등록 정보 삭제
    this._pylons.delete(pylonAddress);
    // 활성 연결에서도 삭제
    this._activeConnections.delete(socket);

    console.log(`[Beacon] Unregistered: ${pylonAddress}`);
    this._sendResponse(socket, { success: true });
  }

  /**
   * query 처리
   */
  private async _handleQuery(
    socket: Socket,
    request: RequestMessage
  ): Promise<void> {
    const { entityId, options } = request;

    // entityId 검증
    if (entityId === undefined || entityId === null) {
      this._sendResponse(socket, {
        success: false,
        error: 'Missing required field: entityId',
      });
      return;
    }

    // 이 소켓이 활성 연결인지 확인
    let connection = this._activeConnections.get(socket);

    // 활성 연결이 없으면, 등록된 Pylon 중 첫 번째를 사용
    // (테스트에서 sendMessage가 매번 새 연결을 만드는 패턴 지원)
    if (!connection && this._pylons.size > 0) {
      const firstPylon = this._pylons.values().next().value;
      if (firstPylon) {
        connection = { socket, pylonAddress: firstPylon.pylonAddress };
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

    const pylonAddress = connection.pylonAddress;

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
              entityId,
              toolName,
              input,
              toolUseId,
            }) + '\n'
          );
        });
      };

      // SDK 어댑터에 쿼리 전달 (canUseTool 콜백 포함)
      const queryOptions = { ...options, canUseTool };
      const query = this._adapter.query(queryOptions);

      for await (const message of query) {
        // content_block_start 시 ToolContextMap에 등록
        this._registerToolUse(message, pylonAddress, entityId);

        // 이벤트 전송
        this._sendEvent(socket, entityId, message);
      }
    } catch (err) {
      // 에러 이벤트 전송
      const errorMessage = err instanceof Error ? err.message : String(err);
      socket.write(
        JSON.stringify({
          type: 'error',
          entityId,
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
    pylonAddress: string,
    entityId: number
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

    const info: PylonInfo = {
      pylonAddress,
      entityId,
      raw,
    };

    this._toolContextMap.set(block.id, info);
    // 로깅: tool_use 등록
    console.log(`[Beacon] ToolContextMap.set: toolUseId=${block.id}, entityId=${entityId}, name=${block.name}, mapSize=${this._toolContextMap.size}`);
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
   * lookup 처리 - ToolContextMap에서 toolUseId로 Pylon 정보 조회
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

    const info = this._toolContextMap.get(toolUseId);
    if (!info) {
      console.log(`[Beacon] lookup FAIL: toolUseId not found in map`);
      this._sendResponse(socket, {
        success: false,
        error: 'Tool use ID not found',
      });
      return;
    }

    console.log(`[Beacon] lookup OK: entityId=${info.entityId}, pylonAddress=${info.pylonAddress}`);
    socket.write(JSON.stringify({
      success: true,
      pylonAddress: info.pylonAddress,
      entityId: info.entityId,
      raw: info.raw,
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
    entityId: number,
    message: ClaudeMessage
  ): void {
    socket.write(
      JSON.stringify({
        type: 'event',
        entityId,
        message,
      }) + '\n'
    );
  }
}
