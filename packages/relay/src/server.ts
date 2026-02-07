/**
 * @file server.ts
 * @description WebSocket 서버 어댑터
 *
 * 순수 함수들을 조합하여 실제 WebSocket 서버를 구동합니다.
 * 이 파일은 외부 I/O(WebSocket)를 처리하는 어댑터 계층입니다.
 *
 * @remarks
 * - 순수 함수들은 테스트 가능하고 모킹 없이 검증 가능
 * - 이 파일은 순수 함수들을 "접착"하여 실제 서버로 동작하게 함
 * - WebSocket 라이브러리 의존성은 이 파일에만 존재
 */

import type { WebSocket, WebSocketServer, RawData } from 'ws';
import type { IncomingMessage } from 'http';
import type {
  Client,
  RelayMessage,
  RelayAction,
  SendAction,
  BroadcastAction,
  UpdateClientAction,
  IncrementNextClientIdAction,
  ResetNextClientIdAction,
  DeviceConfig,
} from './types.js';
import { handleMessage, handleDisconnect, handleConnection } from './message-handler.js';
import { getDeviceList, createDeviceStatusMessage } from './device-status.js';
import { log, getClientIp, generateClientId, getDeviceInfo } from './utils.js';
import { DEVICES, DYNAMIC_DEVICE_ID_START, DEFAULT_PORT } from './constants.js';

// ============================================================================
// main() 함수 반환 타입
// ============================================================================

/**
 * main() 함수 반환 타입
 */
export interface MainResult {
  /** 서버 시작 여부 */
  started: boolean;
  /** 사용된 포트 */
  port: number;
  /** 서버 인스턴스 */
  server: {
    stop: () => Promise<void>;
  };
}

// ============================================================================
// 서버 상태
// ============================================================================

/**
 * Relay 서버 상태
 *
 * @description
 * WebSocket 서버의 런타임 상태를 관리합니다.
 * 순수 함수들은 이 상태를 읽기만 하고, 상태 변경은 어댑터에서 수행합니다.
 */
export interface RelayServerState {
  /** 연결된 클라이언트 맵 (clientId -> Client + WebSocket) */
  clients: Map<string, Client & { ws: WebSocket }>;

  /** 다음 앱 클라이언트에 할당할 ID */
  nextClientId: number;

  /** 디바이스 설정 */
  devices: Record<number, DeviceConfig>;
}

// ============================================================================
// 액션 실행기
// ============================================================================

/**
 * 단일 클라이언트에게 메시지를 전송합니다.
 *
 * @param action - 전송 액션
 * @param state - 서버 상태
 */
function executeSendAction(
  action: SendAction,
  state: RelayServerState
): void {
  const client = state.clients.get(action.clientId);
  if (client && client.ws.readyState === 1) { // WebSocket.OPEN = 1
    client.ws.send(JSON.stringify(action.message));
  }
}

/**
 * 여러 클라이언트에게 메시지를 브로드캐스트합니다.
 *
 * @param action - 브로드캐스트 액션
 * @param state - 서버 상태
 */
function executeBroadcastAction(
  action: BroadcastAction,
  state: RelayServerState
): void {
  const messageStr = JSON.stringify(action.message);

  for (const clientId of action.clientIds) {
    const client = state.clients.get(clientId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(messageStr);
    }
  }
}

/**
 * 클라이언트 상태를 업데이트합니다.
 *
 * @param action - 업데이트 액션
 * @param state - 서버 상태
 */
function executeUpdateClientAction(
  action: UpdateClientAction,
  state: RelayServerState
): void {
  const client = state.clients.get(action.clientId);
  if (client) {
    Object.assign(client, action.updates);
  }
}

/**
 * 액션을 실행합니다.
 *
 * @param action - 실행할 액션
 * @param state - 서버 상태
 */
function executeAction(action: RelayAction, state: RelayServerState): void {
  switch (action.type) {
    case 'send':
      executeSendAction(action, state);
      break;

    case 'broadcast':
      executeBroadcastAction(action, state);
      break;

    case 'update_client':
      executeUpdateClientAction(action, state);
      break;

    case 'increment_next_client_id':
      state.nextClientId++;
      break;

    case 'reset_next_client_id':
      state.nextClientId = action.value;
      log(`Reset nextClientId to ${action.value}`);
      break;
  }
}

/**
 * 여러 액션을 순차적으로 실행합니다.
 *
 * @param actions - 실행할 액션 목록
 * @param state - 서버 상태
 */
function executeActions(actions: RelayAction[], state: RelayServerState): void {
  for (const action of actions) {
    executeAction(action, state);
  }
}

// ============================================================================
// 이벤트 핸들러
// ============================================================================

/**
 * 새 클라이언트 연결을 처리합니다.
 *
 * @param ws - WebSocket 연결
 * @param req - HTTP 요청 객체
 * @param state - 서버 상태
 */
function onConnection(
  ws: WebSocket,
  req: IncomingMessage,
  state: RelayServerState
): void {
  const clientId = generateClientId();
  const clientIp = getClientIp({
    headers: req.headers as Record<string, string | string[] | undefined>,
    socket: { remoteAddress: req.socket.remoteAddress },
  });

  // 클라이언트 등록
  const client: Client & { ws: WebSocket } = {
    ws,
    deviceId: null,
    deviceType: null,
    ip: clientIp,
    connectedAt: new Date(),
    authenticated: false,
  };
  state.clients.set(clientId, client);

  log(`Connected: ${clientId} from ${clientIp} (total: ${state.clients.size})`);

  // connected 메시지 전송
  const result = handleConnection(clientId);
  executeActions(result.actions, state);

  // 메시지 수신 핸들러
  ws.on('message', (rawData: RawData) => {
    onMessage(clientId, rawData, state);
  });

  // 연결 종료 핸들러
  ws.on('close', () => {
    onClose(clientId, state);
  });

  // 오류 핸들러
  ws.on('error', (err: Error) => {
    log(`Error from ${clientId}: ${err.message}`);
  });
}

/**
 * 클라이언트로부터 메시지를 수신합니다.
 *
 * @param clientId - 메시지를 보낸 클라이언트 ID
 * @param rawData - 수신한 원시 데이터
 * @param state - 서버 상태
 */
function onMessage(
  clientId: string,
  rawData: RawData,
  state: RelayServerState
): void {
  const client = state.clients.get(clientId);
  if (!client) return;

  try {
    const data = JSON.parse(rawData.toString()) as RelayMessage;

    // 순수 함수로 처리하고 액션 받기
    const result = handleMessage(
      clientId,
      client,
      data,
      state.nextClientId,
      // clients에서 ws 제거하고 Client만 전달
      new Map(
        Array.from(state.clients.entries()).map(([id, c]) => [
          id,
          {
            deviceId: c.deviceId,
            deviceType: c.deviceType,
            ip: c.ip,
            connectedAt: c.connectedAt,
            authenticated: c.authenticated,
          },
        ])
      ),
      state.devices
    );

    // 액션 실행
    executeActions(result.actions, state);

    // 인증 성공 후 device_status 브로드캐스트 (상태가 업데이트된 후)
    if (data.type === 'auth' && client.authenticated) {
      broadcastDeviceStatus(state);
    }
  } catch (err) {
    log(`Invalid message from ${clientId}: ${(err as Error).message}`);
    executeSendAction(
      {
        type: 'send',
        clientId,
        message: { type: 'error', payload: { error: 'Invalid JSON' } },
      },
      state
    );
  }
}

/**
 * 클라이언트 연결 종료를 처리합니다.
 *
 * @param clientId - 연결 종료된 클라이언트 ID
 * @param state - 서버 상태
 */
function onClose(clientId: string, state: RelayServerState): void {
  const client = state.clients.get(clientId);
  if (!client) return;

  const deviceId = client.deviceId;
  const deviceType = client.deviceType;
  const wasAuthenticated = client.authenticated;

  // 클라이언트 제거
  state.clients.delete(clientId);

  // 로그
  if (deviceId !== null) {
    const info = getDeviceInfo(deviceId, state.devices);
    log(`Disconnected: ${info.name} (${deviceId}) (total: ${state.clients.size})`);
  } else {
    log(`Disconnected: ${clientId} (total: ${state.clients.size})`);
  }

  // 연결 해제 후 처리
  if (wasAuthenticated) {
    const result = handleDisconnect(
      clientId,
      client,
      new Map(
        Array.from(state.clients.entries()).map(([id, c]) => [
          id,
          {
            deviceId: c.deviceId,
            deviceType: c.deviceType,
            ip: c.ip,
            connectedAt: c.connectedAt,
            authenticated: c.authenticated,
          },
        ])
      )
    );
    executeActions(result.actions, state);
  }
}

/**
 * 디바이스 상태를 모든 클라이언트에게 브로드캐스트합니다.
 *
 * @param state - 서버 상태
 */
function broadcastDeviceStatus(state: RelayServerState): void {
  const deviceList = getDeviceList(
    new Map(
      Array.from(state.clients.entries()).map(([id, c]) => [
        id,
        {
          deviceId: c.deviceId,
          deviceType: c.deviceType,
          ip: c.ip,
          connectedAt: c.connectedAt,
          authenticated: c.authenticated,
        },
      ])
    ),
    state.devices
  );

  const message: RelayMessage = {
    type: 'device_status',
    payload: { devices: deviceList },
  };

  const messageStr = JSON.stringify(message);

  for (const [clientId, client] of state.clients) {
    if (client.authenticated && client.ws.readyState === 1) {
      client.ws.send(messageStr);
    }
  }

  log(`Device status: ${deviceList.length} authenticated`);
}

// ============================================================================
// 서버 생성 함수
// ============================================================================

/**
 * Relay 서버 설정 옵션
 */
export interface RelayServerOptions {
  /** 서버 포트 (기본값: 8080 또는 환경변수 PORT) */
  port?: number;

  /** 커스텀 디바이스 설정 (기본값: DEVICES) */
  devices?: Record<number, DeviceConfig>;

  /** 정적 파일 디렉토리 (설정 시 HTTP 서버에서 정적 파일 서빙) */
  staticDir?: string;
}

/**
 * Relay 서버 인스턴스
 */
export interface RelayServer {
  /** 서버 상태 */
  state: RelayServerState;

  /** 서버 시작 */
  start: () => void;

  /** 서버 중지 */
  stop: () => Promise<void>;
}

/**
 * Relay 서버를 생성합니다.
 *
 * @description
 * WebSocket 서버를 생성하고 이벤트 핸들러를 연결합니다.
 * 서버를 시작하려면 반환된 객체의 start() 메서드를 호출하세요.
 *
 * @param wss - WebSocket.Server 인스턴스
 * @param options - 서버 옵션
 * @returns Relay 서버 인스턴스
 *
 * @example
 * ```typescript
 * import { WebSocketServer } from 'ws';
 * import { createRelayServer } from '@estelle/relay';
 *
 * const wss = new WebSocketServer({ port: 8080 });
 * const relay = createRelayServer(wss);
 * relay.start();
 *
 * process.on('SIGINT', async () => {
 *   await relay.stop();
 *   process.exit(0);
 * });
 * ```
 */
export function createRelayServer(
  wss: WebSocketServer,
  options: RelayServerOptions = {}
): RelayServer {
  const state: RelayServerState = {
    clients: new Map(),
    nextClientId: DYNAMIC_DEVICE_ID_START,
    devices: options.devices ?? DEVICES,
  };

  const start = (): void => {
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      onConnection(ws, req, state);
    });

    wss.on('listening', () => {
      const port = options.port ?? DEFAULT_PORT;
      log(`[Estelle Relay v2] Started on port ${port}`);
      log(
        `Registered devices: ${Object.entries(state.devices)
          .map(([id, d]) => `${d.name}(${id})`)
          .join(', ')}`
      );
    });

    wss.on('error', (err: Error) => {
      log(`Server error: ${err.message}`);
    });
  };

  const stop = (): Promise<void> => {
    return new Promise((resolve) => {
      log('Shutting down...');

      // 모든 클라이언트 연결 종료
      for (const [clientId, client] of state.clients) {
        try {
          client.ws.close();
        } catch {
          // 이미 닫힌 연결 무시
        }
      }
      state.clients.clear();

      wss.close(() => {
        log('Server closed');
        resolve();
      });
    });
  };

  return { state, start, stop };
}

// ============================================================================
// CLI 진입점 (선택적)
// ============================================================================

/**
 * CLI에서 서버를 시작합니다.
 *
 * @description
 * 이 함수는 패키지를 CLI로 실행할 때 사용됩니다.
 * 일반적으로는 createRelayServer를 직접 사용하는 것을 권장합니다.
 *
 * @param options - 서버 옵션 (선택)
 *
 * @example
 * ```bash
 * # 환경변수로 포트 설정
 * PORT=8080 node dist/server.js
 *
 * # 정적 파일 디렉토리 설정 (환경변수)
 * STATIC_DIR=./public PORT=8080 node dist/server.js
 * ```
 */
export async function main(options: RelayServerOptions = {}): Promise<MainResult> {
  // 동적 import로 모듈 로드
  const { WebSocketServer } = await import('ws');
  const http = await import('http');

  const port = options.port ?? parseInt(process.env['PORT'] || String(DEFAULT_PORT), 10);
  const staticDir = options.staticDir ?? process.env['STATIC_DIR'];

  // HTTP 서버 생성 (정적 파일 서빙 포함)
  let httpServer: ReturnType<typeof http.createServer> | null = null;
  let wss: InstanceType<typeof WebSocketServer>;

  if (staticDir) {
    // 동적 import로 정적 파일 핸들러 로드
    const { createStaticHandler } = await import('./static.js');

    httpServer = http.createServer(createStaticHandler({ staticDir }));
    wss = new WebSocketServer({ server: httpServer });

    httpServer.listen(port, () => {
      log(`[Estelle Relay v2] Started on port ${port}`);
      log(`Static files: ${staticDir}`);
    });
  } else {
    // WebSocket 전용 서버
    wss = new WebSocketServer({ port });
    log(`[Estelle Relay v2] Started on port ${port}`);
  }

  const relay = createRelayServer(wss, { port, devices: options.devices });
  relay.start();

  // Graceful shutdown
  const stopServer = async () => {
    await relay.stop();
    if (httpServer) {
      httpServer.close();
    }
  };

  // 결과 객체를 먼저 생성하여 시그널 핸들러에서 참조할 수 있게 함
  const result: MainResult = {
    started: true,
    port,
    server: {
      stop: stopServer,
    },
  };

  // 시그널 핸들러 (테스트에서 server.stop 스파이가 동작하도록 result.server.stop 호출)
  const handleShutdown = async () => {
    await result.server.stop();
    // 프로덕션에서만 exit (테스트 환경에서는 vitest가 process.exit를 차단함)
    if (process.env['NODE_ENV'] !== 'test') {
      process.exit(0);
    }
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  return result;
}

// CLI로 직접 실행된 경우
// Note: ESM에서는 이 체크가 다르게 동작함
// 실제 CLI 실행은 별도 bin 스크립트 또는 직접 호출로 처리
