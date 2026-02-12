/**
 * @file message-handler.ts
 * @description 메시지 핸들러 (순수 함수)
 *
 * 클라이언트로부터 수신한 메시지를 처리하고 수행할 액션을 반환합니다.
 * 실제 상태 변경이나 WebSocket 전송은 하지 않고, 액션 객체만 반환합니다.
 * 이를 통해 테스트가 용이하고 부작용이 없는 순수 함수를 유지합니다.
 */

import type { AuthPayload } from '@estelle/core';
import { encodePylonId, encodeClientId, type EnvId } from '@estelle/core';
import type {
  Client,
  RelayMessage,
  RelayAction,
  AuthResultPayload,
  DeviceListItem,
  DeviceConfig,
  RelayDeviceType,
} from './types.js';
import { isAuthenticatedClient } from './types.js';
import { authenticateDevice } from './auth.js';
import { routeMessage, broadcastAll, broadcastToType } from './router.js';
import { getDeviceList, createDeviceStatusMessage, createClientDisconnectMessage } from './device-status.js';
import { getDeviceInfo, parseDeviceId, log } from './utils.js';
import { DEVICES } from './constants.js';
import { ClientIndexAllocator } from './device-id-validation.js';

// ============================================================================
// 핸들러 결과 타입
// ============================================================================

/**
 * 메시지 핸들러 결과
 *
 * @description
 * handleMessage 함수의 반환 타입입니다.
 * 수행할 액션 목록을 포함합니다.
 *
 * @property actions - 수행할 액션 목록
 */
export interface HandleResult {
  /** 수행할 액션 목록 */
  actions: RelayAction[];
}

// ============================================================================
// 인증 헬퍼 함수
// ============================================================================

/**
 * 인증 실패 응답을 생성합니다.
 *
 * @param clientId - 클라이언트 ID
 * @param error - 오류 메시지
 * @returns 실패 응답 액션을 포함한 HandleResult
 */
function createAuthFailureResult(clientId: string, error: string): HandleResult {
  return {
    actions: [
      {
        type: 'send',
        clientId,
        message: {
          type: 'auth_result',
          payload: { success: false, error } as AuthResultPayload,
        },
      },
    ],
  };
}

// ============================================================================
// 인증 핸들러
// ============================================================================

/**
 * 인증 요청을 처리합니다.
 *
 * @description
 * auth 타입 메시지를 처리하여 클라이언트를 인증합니다.
 *
 * 인증 규칙:
 * - pylon: deviceIndex 필수 (1~15), IP 기반 인증
 * - app: deviceIndex 자동 발급 (0~15), 인증 항상 성공
 *
 * deviceId 인코딩:
 * - pylonId = envId(2비트) + deviceType(0, 1비트) + deviceIndex(4비트)
 * - clientId = envId(2비트) + deviceType(1, 1비트) + deviceIndex(4비트)
 *
 * @param clientId - 요청한 클라이언트 ID (WebSocket 연결 ID)
 * @param client - 클라이언트 정보
 * @param payload - 인증 요청 페이로드
 * @param envId - 환경 ID (0=release, 1=stage, 2=dev)
 * @param nextClientIndex - 다음 앱 클라이언트에 할당할 deviceIndex (0~15)
 * @param clients - 전체 클라이언트 맵 (브로드캐스트용)
 * @param devices - 디바이스 설정 맵
 * @returns 핸들러 결과
 *
 * @example
 * ```typescript
 * const result = handleAuth(
 *   'client-123',
 *   client,
 *   { deviceId: 1, deviceType: 'pylon' },
 *   1,  // envId: stage
 *   0,  // nextClientIndex
 *   clients,
 *   DEVICES
 * );
 * // 결과 액션들을 실행
 * ```
 */
export function handleAuth(
  clientId: string,
  client: Client,
  payload: AuthPayload,
  envId: EnvId,
  nextClientIndex: number,
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig> = DEVICES
): HandleResult {
  const actions: RelayAction[] = [];
  const { deviceType } = payload;
  let { deviceId } = payload;

  // deviceType 필수 확인
  if (!deviceType) {
    return createAuthFailureResult(clientId, 'Missing deviceType');
  }

  // deviceIndex와 인코딩된 deviceId를 분리해서 관리
  let deviceIndex: number;
  let encodedDeviceId: number;

  // Pylon 인증
  if (deviceType === 'pylon') {
    // deviceId를 deviceIndex로 파싱 (Pylon은 deviceIndex를 전달함)
    const parsedDeviceIndex = parseDeviceId(deviceId);

    if (parsedDeviceIndex === null) {
      return createAuthFailureResult(clientId, 'Missing deviceId for pylon');
    }

    // IP 기반 인증 (deviceIndex로 인증)
    const authResult = authenticateDevice(parsedDeviceIndex, deviceType, client.ip, devices);

    if (!authResult.success) {
      return createAuthFailureResult(clientId, authResult.error!);
    }

    deviceIndex = parsedDeviceIndex;
    // pylonId 인코딩: envId + deviceType(0) + deviceIndex
    encodedDeviceId = encodePylonId(envId, deviceIndex);
  } else {
    // App 클라이언트: deviceIndex 자동 발급 (allocator의 nextId를 전달받음)
    deviceIndex = nextClientIndex;
    // clientId 인코딩: envId + deviceType(1) + deviceIndex
    encodedDeviceId = encodeClientId(envId, deviceIndex);
    actions.push({ type: 'allocate_client_index' });
  }

  // 인증 성공 - 클라이언트 상태 업데이트
  // 내부적으로는 deviceIndex를 저장 (라우팅에 사용)
  actions.push({
    type: 'update_client',
    clientId,
    updates: {
      deviceId: deviceIndex,  // 내부 라우팅용 deviceIndex
      deviceType: deviceType as RelayDeviceType,
      authenticated: true,
    },
  });

  // 인증 성공 응답 - 클라이언트에는 인코딩된 deviceId 전달
  const info = getDeviceInfo(deviceIndex, devices);
  actions.push({
    type: 'send',
    clientId,
    message: {
      type: 'auth_result',
      payload: {
        success: true,
        device: {
          deviceId: encodedDeviceId,  // 7비트 인코딩된 deviceId
          deviceIndex,  // 로컬 인덱스도 함께 전달
          deviceType: deviceType as RelayDeviceType,
          name: info.name,
          icon: info.icon,
          role: info.role,
        },
      } as AuthResultPayload,
    },
  });

  // 디바이스 상태 브로드캐스트 (인증 완료 후 상태로)
  // 새로 인증된 클라이언트를 포함한 업데이트된 clients 맵 생성
  const updatedClients = new Map(clients);
  updatedClients.set(clientId, {
    ...client,
    deviceId: deviceIndex,  // 내부 라우팅용 deviceIndex
    deviceType: deviceType as RelayDeviceType,
    authenticated: true,
  });

  const broadcastResult = broadcastAll(updatedClients);
  if (broadcastResult.success) {
    actions.push({
      type: 'broadcast',
      clientIds: broadcastResult.targetClientIds,
      message: createDeviceStatusMessage(updatedClients, devices),
    });
  }

  return { actions };
}

// ============================================================================
// 내부 메시지 핸들러
// ============================================================================

/**
 * get_devices 요청을 처리합니다.
 *
 * @param clientId - 요청한 클라이언트 ID
 * @param clients - 클라이언트 맵
 * @param devices - 디바이스 설정 맵
 * @returns 핸들러 결과
 */
export function handleGetDevices(
  clientId: string,
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig> = DEVICES
): HandleResult {
  const deviceList = getDeviceList(clients, devices);

  return {
    actions: [
      {
        type: 'send',
        clientId,
        message: {
          type: 'device_list',
          payload: { devices: deviceList },
        },
      },
    ],
  };
}

/**
 * ping 요청을 처리합니다.
 *
 * @param clientId - 요청한 클라이언트 ID
 * @returns 핸들러 결과
 */
export function handlePing(clientId: string): HandleResult {
  return {
    actions: [
      {
        type: 'send',
        clientId,
        message: { type: 'pong', payload: {} },
      },
    ],
  };
}

// ============================================================================
// 라우팅 핸들러
// ============================================================================

/**
 * 일반 메시지를 라우팅합니다.
 *
 * @description
 * to, broadcast 필드 또는 기본 라우팅 규칙에 따라 메시지를 전달합니다.
 *
 * @param clientId - 발신자 클라이언트 ID
 * @param client - 발신자 클라이언트 정보
 * @param message - 전달할 메시지
 * @param envId - 환경 ID (0=release, 1=stage, 2=dev)
 * @param clients - 클라이언트 맵
 * @param devices - 디바이스 설정 맵
 * @returns 핸들러 결과
 */
export function handleRouting(
  clientId: string,
  client: Client,
  message: RelayMessage,
  envId: EnvId,
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig> = DEVICES
): HandleResult {
  const actions: RelayAction[] = [];

  if (!isAuthenticatedClient(client)) {
    return { actions };
  }

  // from 정보 주입 - 인코딩된 deviceId 사용
  const info = getDeviceInfo(client.deviceId, devices);
  // deviceType에 따라 인코딩 방식 결정
  const encodedDeviceId = client.deviceType === 'pylon'
    ? encodePylonId(envId, client.deviceId)
    : encodeClientId(envId, client.deviceId);
  const enrichedMessage: RelayMessage = {
    ...message,
    from: {
      deviceId: encodedDeviceId,
      deviceType: client.deviceType,
      name: info.name,
      icon: info.icon,
    },
  };

  // 라우팅 대상 결정
  const routeResult = routeMessage(
    message,
    clientId,
    client.deviceType,
    clients
  );

  if (routeResult.success) {
    actions.push({
      type: 'broadcast',
      clientIds: routeResult.targetClientIds,
      message: enrichedMessage,
    });
  }

  return { actions };
}

// ============================================================================
// 메인 핸들러
// ============================================================================

/**
 * 클라이언트로부터 수신한 메시지를 처리합니다.
 *
 * @description
 * 메시지 타입에 따라 적절한 핸들러를 호출하고 수행할 액션을 반환합니다.
 *
 * 처리 순서:
 * 1. auth: 인증 처리
 * 2. (인증 필요) get_devices, getDevices: 디바이스 목록 응답
 * 3. (인증 필요) ping: pong 응답
 * 4. (인증 필요) 그 외: 라우팅
 *
 * @param clientId - 메시지를 보낸 클라이언트 ID (WebSocket 연결 ID)
 * @param client - 클라이언트 정보
 * @param data - 수신한 메시지 데이터
 * @param envId - 환경 ID (0=release, 1=stage, 2=dev)
 * @param nextClientIndex - 다음 앱 클라이언트에 할당할 deviceIndex (0~15)
 * @param clients - 전체 클라이언트 맵
 * @param devices - 디바이스 설정 맵
 * @returns 핸들러 결과
 *
 * @example
 * ```typescript
 * const result = handleMessage(
 *   clientId,
 *   client,
 *   JSON.parse(rawMessage),
 *   1,  // envId: stage
 *   nextClientIndex,
 *   clients,
 *   DEVICES
 * );
 *
 * for (const action of result.actions) {
 *   executeAction(action);
 * }
 * ```
 */
export function handleMessage(
  clientId: string,
  client: Client,
  data: RelayMessage,
  envId: EnvId,
  nextClientIndex: number,
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig> = DEVICES
): HandleResult {
  const { type } = data;

  // ===== 인증 =====
  if (type === 'auth') {
    return handleAuth(
      clientId,
      client,
      data.payload as AuthPayload,
      envId,
      nextClientIndex,
      clients,
      devices
    );
  }

  // ===== 인증 필요 =====
  if (!isAuthenticatedClient(client)) {
    return {
      actions: [
        {
          type: 'send',
          clientId,
          message: { type: 'error', payload: { error: 'Not authenticated' } },
        },
      ],
    };
  }

  // ===== Relay 내부 처리 =====
  if (type === 'get_devices' || type === 'getDevices') {
    return handleGetDevices(clientId, clients, devices);
  }

  if (type === 'ping') {
    return handlePing(clientId);
  }

  // ===== 순수 라우팅 =====
  return handleRouting(clientId, client, data, envId, clients, devices);
}

// ============================================================================
// 연결 해제 핸들러
// ============================================================================

/**
 * 클라이언트 연결 해제를 처리합니다.
 *
 * @description
 * 클라이언트 연결 해제 시 수행할 액션을 반환합니다.
 *
 * 처리 사항:
 * 1. 인증된 클라이언트면 device_status 브로드캐스트
 * 2. 비-pylon 클라이언트면 pylon에게 client_disconnect 알림
 * 3. App 클라이언트면 release_client_index 액션 반환
 *
 * @param clientId - 연결 해제된 클라이언트 ID
 * @param client - 클라이언트 정보
 * @param clients - 클라이언트 맵 (해당 클라이언트 제거 후 상태)
 * @returns 핸들러 결과
 */
export function handleDisconnect(
  clientId: string,
  client: Client,
  clients: Map<string, Client>
): HandleResult {
  const actions: RelayAction[] = [];

  // 인증되지 않은 클라이언트는 별도 처리 불필요
  if (!isAuthenticatedClient(client)) {
    return { actions };
  }

  // 디바이스 상태 브로드캐스트
  const broadcastResult = broadcastAll(clients);
  if (broadcastResult.success) {
    actions.push({
      type: 'broadcast',
      clientIds: broadcastResult.targetClientIds,
      message: createDeviceStatusMessage(clients),
    });
  }

  // 비-pylon 클라이언트 연결 해제 시 pylon에게 알림 및 clientIndex 해제
  if (client.deviceType !== 'pylon') {
    const pylonResult = broadcastToType('pylon', clients);
    if (pylonResult.success) {
      actions.push({
        type: 'broadcast',
        clientIds: pylonResult.targetClientIds,
        message: createClientDisconnectMessage(client.deviceId, client.deviceType),
      });
    }

    // clientIndex 해제 (allocator가 빈 번호 재활용하므로 리셋 불필요)
    actions.push({
      type: 'release_client_index',
      deviceIndex: client.deviceId,
    });
  }

  return { actions };
}

// ============================================================================
// 연결 핸들러
// ============================================================================

/**
 * 새 클라이언트 연결을 처리합니다.
 *
 * @description
 * 새 클라이언트가 연결되면 connected 메시지를 전송합니다.
 *
 * @param clientId - 새로 연결된 클라이언트 ID
 * @returns 핸들러 결과
 */
export function handleConnection(clientId: string): HandleResult {
  return {
    actions: [
      {
        type: 'send',
        clientId,
        message: {
          type: 'connected',
          payload: { clientId, message: 'Estelle Relay v2' },
        },
      },
    ],
  };
}
