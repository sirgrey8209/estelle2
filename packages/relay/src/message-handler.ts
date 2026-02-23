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

    // IP 기반 인증 (deviceIndex로 인증 - DEVICES 키는 deviceIndex)
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

  // Viewer는 handleViewerRouting에서 처리됨 (handleMessage에서 분기)
  // 만약 여기까지 도달했다면 잘못된 호출이므로 빈 액션 반환
  if (client.deviceType === 'viewer') {
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
    const payload = data.payload as AuthPayload & { shareId?: string };

    // Viewer 인증: deviceType이 'viewer'이면 별도 처리
    if (payload.deviceType === 'viewer') {
      return handleViewerAuth(
        clientId,
        client,
        payload,
        envId,
        nextClientIndex,
        clients,
        devices
      );
    }

    // Pylon/App 인증
    return handleAuth(
      clientId,
      client,
      payload,
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

  // ===== Viewer 라우팅 (별도 처리) =====
  if (client.deviceType === 'viewer') {
    return handleViewerRouting(clientId, client, data, envId, clients, devices);
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

  // 비-pylon 클라이언트 연결 해제 시 clientIndex 해제
  if (client.deviceType !== 'pylon') {
    // viewer가 아닌 경우에만 pylon에게 알림 (viewer는 pylon에게 알리지 않음)
    if (client.deviceType !== 'viewer') {
      const pylonResult = broadcastToType('pylon', clients);
      if (pylonResult.success) {
        actions.push({
          type: 'broadcast',
          clientIds: pylonResult.targetClientIds,
          message: createClientDisconnectMessage(client.deviceId, client.deviceType),
        });
      }
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

// ============================================================================
// Google OAuth 인증 핸들러
// ============================================================================

import type { GoogleUserInfo } from './google-auth.js';

// ============================================================================
// Viewer 인증 핸들러
// ============================================================================

/**
 * Viewer 인증에 필요한 의존성
 *
 * @description
 * Pylon과 통신하여 shareId를 검증하는 함수를 주입받습니다.
 *
 * @property validateShare - shareId 유효성 검증 함수
 */
export interface ViewerAuthDependencies {
  /** shareId 유효성 검증 및 conversationId 반환 */
  validateShare: (shareId: string) => Promise<{ valid: boolean; conversationId?: number; error?: string }>;
}

/**
 * Viewer 인증 요청을 처리합니다.
 *
 * @description
 * shareId 기반으로 Viewer를 인증합니다.
 * Viewer는 읽기 전용으로 특정 대화만 조회할 수 있습니다.
 *
 * 인증 흐름:
 * 1. shareId 존재 확인
 * 2. validateShare로 shareId 검증 및 conversationId 획득
 * 3. 인증 성공 시 viewer 타입으로 클라이언트 등록
 *
 * @param clientId - 요청한 클라이언트 ID (WebSocket 연결 ID)
 * @param client - 클라이언트 정보
 * @param payload - 인증 요청 페이로드
 * @param envId - 환경 ID (0=release, 1=stage, 2=dev)
 * @param nextClientIndex - 다음 클라이언트에 할당할 deviceIndex (0~15)
 * @param clients - 전체 클라이언트 맵 (브로드캐스트용)
 * @param devices - 디바이스 설정 맵
 * @param deps - Viewer 인증 의존성
 * @returns 핸들러 결과 (Promise)
 */
export async function handleAuthViewer(
  clientId: string,
  client: Client,
  payload: { deviceType?: string; shareId?: string },
  envId: EnvId,
  nextClientIndex: number,
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig>,
  deps: ViewerAuthDependencies
): Promise<HandleResult> {
  const { shareId } = payload;

  // shareId 필수 확인
  if (!shareId || shareId.trim() === '') {
    return createAuthFailureResult(clientId, 'Missing shareId for viewer authentication');
  }

  // shareId 검증
  let validationResult: { valid: boolean; conversationId?: number; error?: string };
  try {
    validationResult = await deps.validateShare(shareId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createAuthFailureResult(clientId, `Share validation failed: ${message}`);
  }

  if (!validationResult.valid) {
    return createAuthFailureResult(clientId, validationResult.error || 'Share not found');
  }

  const conversationId = validationResult.conversationId;
  const actions: RelayAction[] = [];

  // deviceIndex 할당
  const deviceIndex = nextClientIndex;
  const encodedDeviceId = encodeClientId(envId, deviceIndex);
  actions.push({ type: 'allocate_client_index' });

  // 클라이언트 상태 업데이트 (viewer 타입 + conversationId)
  actions.push({
    type: 'update_client',
    clientId,
    updates: {
      deviceId: deviceIndex,
      deviceType: 'viewer' as RelayDeviceType,
      authenticated: true,
      conversationId,
    },
  });

  // 인증 성공 응답
  const info = getDeviceInfo(deviceIndex, devices);
  actions.push({
    type: 'send',
    clientId,
    message: {
      type: 'auth_result',
      payload: {
        success: true,
        device: {
          deviceId: encodedDeviceId,
          deviceIndex,
          deviceType: 'viewer' as RelayDeviceType,
          name: info.name,
          icon: info.icon,
          role: info.role,
          conversationId,
        },
      } as AuthResultPayload,
    },
  });

  // 디바이스 상태 브로드캐스트
  const updatedClients = new Map(clients);
  updatedClients.set(clientId, {
    ...client,
    deviceId: deviceIndex,
    deviceType: 'viewer' as RelayDeviceType,
    authenticated: true,
    conversationId,
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

/**
 * Google OAuth 인증에 필요한 의존성
 *
 * @description
 * 의존성 주입을 통해 테스트 가능한 구조를 유지합니다.
 *
 * @property verifyGoogleToken - Google ID 토큰 검증 함수
 * @property isEmailAllowed - 이메일 화이트리스트 검증 함수
 * @property googleClientId - Google OAuth 클라이언트 ID
 */
export interface GoogleAuthDependencies {
  /** Google ID 토큰 검증 함수 */
  verifyGoogleToken: (idToken: string, clientId: string) => Promise<GoogleUserInfo>;

  /** 이메일 화이트리스트 검증 함수 */
  isEmailAllowed: (email: string) => boolean;

  /** Google OAuth 클라이언트 ID */
  googleClientId: string;
}

/**
 * App 클라이언트 인증 성공 시 공통 액션을 생성합니다.
 *
 * @description
 * handleAuth와 handleAuthWithGoogle에서 공통으로 사용되는
 * App 인증 성공 로직을 추출한 헬퍼 함수입니다.
 *
 * @param clientId - 클라이언트 ID
 * @param client - 클라이언트 정보
 * @param deviceType - 디바이스 타입
 * @param envId - 환경 ID
 * @param nextClientIndex - 다음 클라이언트 인덱스
 * @param clients - 클라이언트 맵
 * @param devices - 디바이스 설정
 * @param email - (선택) Google OAuth 인증 시 이메일
 * @returns 수행할 액션 목록
 */
function createAppAuthSuccessActions(
  clientId: string,
  client: Client,
  deviceType: RelayDeviceType,
  envId: EnvId,
  nextClientIndex: number,
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig>,
  email?: string
): RelayAction[] {
  const actions: RelayAction[] = [];

  const deviceIndex = nextClientIndex;
  const encodedDeviceId = encodeClientId(envId, deviceIndex);
  actions.push({ type: 'allocate_client_index' });

  // 클라이언트 상태 업데이트
  actions.push({
    type: 'update_client',
    clientId,
    updates: {
      deviceId: deviceIndex,
      deviceType,
      authenticated: true,
    },
  });

  // 인증 성공 응답
  const info = getDeviceInfo(deviceIndex, devices);
  const devicePayload: Record<string, unknown> = {
    deviceId: encodedDeviceId,
    deviceIndex,
    deviceType,
    name: info.name,
    icon: info.icon,
    role: info.role,
  };

  if (email) {
    devicePayload.email = email;
  }

  actions.push({
    type: 'send',
    clientId,
    message: {
      type: 'auth_result',
      payload: {
        success: true,
        device: devicePayload,
      } as AuthResultPayload,
    },
  });

  // 디바이스 상태 브로드캐스트
  const updatedClients = new Map(clients);
  updatedClients.set(clientId, {
    ...client,
    deviceId: deviceIndex,
    deviceType,
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

  return actions;
}

// ============================================================================
// Viewer 분리 라우팅 핸들러
// ============================================================================

/**
 * Viewer가 보낼 수 있는 메시지 타입 목록
 *
 * @description
 * Viewer는 읽기 전용이므로 제한된 메시지만 전송할 수 있습니다.
 */
const VIEWER_ALLOWED_MESSAGE_TYPES = ['share_history'] as const;

/**
 * Viewer 인증 요청을 처리합니다 (shareId 기반 즉시 등록).
 *
 * @description
 * shareId만으로 Viewer를 즉시 등록합니다. Pylon 검증 없이 바로 인증됩니다.
 * shareId의 실제 유효성은 이후 share_history 요청 시 Pylon에서 검증합니다.
 *
 * 인증 흐름:
 * 1. shareId 존재 및 빈 문자열 여부 확인
 * 2. 즉시 viewer 타입으로 클라이언트 등록
 * 3. auth_result 성공 응답 전송
 *
 * @param clientId - 요청한 클라이언트 ID (WebSocket 연결 ID)
 * @param client - 클라이언트 정보
 * @param payload - 인증 요청 페이로드 ({ deviceType: 'viewer', shareId: string })
 * @param envId - 환경 ID (0=release, 1=stage, 2=dev)
 * @param nextClientIndex - 다음 클라이언트에 할당할 deviceIndex (0~15)
 * @param clients - 전체 클라이언트 맵 (브로드캐스트용)
 * @param devices - 디바이스 설정 맵
 * @returns 핸들러 결과
 */
export function handleViewerAuth(
  clientId: string,
  client: Client,
  payload: { deviceType?: string; shareId?: string },
  envId: EnvId,
  nextClientIndex: number,
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig>
): HandleResult {
  const { shareId } = payload;

  // shareId 필수 확인 (missing or empty)
  if (!shareId || shareId.trim() === '') {
    return createAuthFailureResult(clientId, 'Missing shareId for viewer authentication');
  }

  const actions: RelayAction[] = [];

  // deviceIndex 할당
  const deviceIndex = nextClientIndex;
  const encodedDeviceId = encodeClientId(envId, deviceIndex);
  actions.push({ type: 'allocate_client_index' });

  // 클라이언트 상태 업데이트 (viewer 타입 + shareId 저장)
  actions.push({
    type: 'update_client',
    clientId,
    updates: {
      deviceId: deviceIndex,
      deviceType: 'viewer' as RelayDeviceType,
      authenticated: true,
      shareId,  // shareId 저장
    },
  });

  // 인증 성공 응답
  const info = getDeviceInfo(deviceIndex, devices);
  actions.push({
    type: 'send',
    clientId,
    message: {
      type: 'auth_result',
      payload: {
        success: true,
        device: {
          deviceId: encodedDeviceId,
          deviceIndex,
          deviceType: 'viewer' as RelayDeviceType,
          name: info.name,
          icon: info.icon,
          role: info.role,
        },
      } as AuthResultPayload,
    },
  });

  // 디바이스 상태 브로드캐스트
  const updatedClients = new Map(clients);
  updatedClients.set(clientId, {
    ...client,
    deviceId: deviceIndex,
    deviceType: 'viewer' as RelayDeviceType,
    authenticated: true,
    shareId,
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

/**
 * Viewer가 보낸 메시지를 라우팅합니다.
 *
 * @description
 * Viewer는 읽기 전용이므로 제한된 메시지만 허용됩니다.
 * 허용 목록: share_history
 * 그 외 메시지는 무시됩니다 (빈 actions 반환).
 *
 * @param clientId - 발신자 클라이언트 ID
 * @param client - 발신자 클라이언트 정보 (viewer)
 * @param message - 전달할 메시지
 * @param envId - 환경 ID (0=release, 1=stage, 2=dev)
 * @param clients - 클라이언트 맵
 * @param devices - 디바이스 설정 맵
 * @returns 핸들러 결과
 */
export function handleViewerRouting(
  clientId: string,
  client: Client,
  message: RelayMessage,
  envId: EnvId,
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig> = DEVICES
): HandleResult {
  const actions: RelayAction[] = [];

  // 인증되지 않은 클라이언트는 무시
  if (!isAuthenticatedClient(client)) {
    return { actions };
  }

  // viewer가 아니면 무시 (이 함수는 viewer 전용)
  if (client.deviceType !== 'viewer') {
    return { actions };
  }

  // 허용된 메시지 타입인지 확인
  if (!VIEWER_ALLOWED_MESSAGE_TYPES.includes(message.type as typeof VIEWER_ALLOWED_MESSAGE_TYPES[number])) {
    // 허용되지 않은 메시지는 무시 (빈 actions)
    return { actions };
  }

  // from 정보 주입
  const info = getDeviceInfo(client.deviceId, devices);
  const encodedDeviceId = encodeClientId(envId, client.deviceId);
  const enrichedMessage: RelayMessage = {
    ...message,
    from: {
      deviceId: encodedDeviceId,
      deviceType: 'viewer',
      name: info.name,
      icon: info.icon,
    },
  };

  // Pylon으로 라우팅 (share_history는 Pylon이 처리)
  const pylonResult = broadcastToType('pylon', clients);
  if (pylonResult.success) {
    actions.push({
      type: 'broadcast',
      clientIds: pylonResult.targetClientIds,
      message: enrichedMessage,
    });
  }

  return { actions };
}

/**
 * Google OAuth를 사용한 인증 요청을 처리합니다.
 *
 * @description
 * App 클라이언트는 Google OAuth 토큰을 통해 인증합니다.
 * Pylon은 기존 IP 기반 인증을 유지합니다.
 *
 * 인증 흐름:
 * 1. App: idToken 검증 -> 이메일 화이트리스트 확인 -> 성공
 * 2. Pylon: 기존 IP 기반 인증 (idToken 불필요)
 *
 * @param clientId - 요청한 클라이언트 ID (WebSocket 연결 ID)
 * @param client - 클라이언트 정보
 * @param payload - 인증 요청 페이로드
 * @param envId - 환경 ID (0=release, 1=stage, 2=dev)
 * @param nextClientIndex - 다음 앱 클라이언트에 할당할 deviceIndex (0~15)
 * @param clients - 전체 클라이언트 맵 (브로드캐스트용)
 * @param devices - 디바이스 설정 맵
 * @param deps - Google OAuth 의존성
 * @returns 핸들러 결과 (Promise)
 *
 * @example
 * ```typescript
 * const result = await handleAuthWithGoogle(
 *   'client-123',
 *   client,
 *   { deviceType: 'app', idToken: 'google-id-token' },
 *   1,  // envId: stage
 *   0,  // nextClientIndex
 *   clients,
 *   DEVICES,
 *   deps
 * );
 * ```
 */
export async function handleAuthWithGoogle(
  clientId: string,
  client: Client,
  payload: AuthPayload,
  envId: EnvId,
  nextClientIndex: number,
  clients: Map<string, Client>,
  devices: Record<number, DeviceConfig>,
  deps: GoogleAuthDependencies
): Promise<HandleResult> {
  const { deviceType, idToken } = payload;

  // deviceType 필수 확인
  if (!deviceType) {
    return createAuthFailureResult(clientId, 'Missing deviceType');
  }

  // Pylon은 기존 IP 기반 인증 사용 (Google OAuth 불필요)
  if (deviceType === 'pylon') {
    return handleAuth(
      clientId,
      client,
      payload,
      envId,
      nextClientIndex,
      clients,
      devices
    );
  }

  // App 클라이언트: Google OAuth 필수
  if (!idToken || idToken.trim() === '') {
    return createAuthFailureResult(clientId, 'Missing idToken for app authentication');
  }

  // Google 토큰 검증
  let userInfo: GoogleUserInfo;
  try {
    userInfo = await deps.verifyGoogleToken(idToken, deps.googleClientId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createAuthFailureResult(clientId, `Invalid Google token: ${message}`);
  }

  // 이메일 화이트리스트 확인
  if (!deps.isEmailAllowed(userInfo.email)) {
    return createAuthFailureResult(clientId, `Email not allowed: ${userInfo.email}`);
  }

  // App 인증 성공 처리 (공통 헬퍼 사용)
  const actions = createAppAuthSuccessActions(
    clientId,
    client,
    deviceType as RelayDeviceType,
    envId,
    nextClientIndex,
    clients,
    devices,
    userInfo.email
  );

  return { actions };
}
