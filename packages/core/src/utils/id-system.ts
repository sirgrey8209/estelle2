/**
 * @file id-system.ts
 * @description 24비트 통합 ID 체계 구현
 *
 * 비트 레이아웃 (24비트):
 * ┌─────────┬─────┬─────────────┬───────────────┬──────────────────┐
 * │ envId   │ DT  │ deviceIndex │ workspaceIndex│ conversationIndex│
 * │ 2비트   │1bit │ 4비트       │ 7비트         │ 10비트           │
 * └─────────┴─────┴─────────────┴───────────────┴──────────────────┘
 *
 * 계층:
 * - DeviceId (7비트) = envId(2) + deviceType(1) + deviceIndex(4)
 *   - PylonId: deviceType=0, deviceIndex=1~15
 *   - ClientId: deviceType=1, deviceIndex=0~15
 * - WorkspaceId (14비트) = pylonId(7) + workspaceIndex(7)
 * - ConversationId (24비트) = workspaceId(14) + conversationIndex(10)
 */

// ============================================================================
// 타입 정의
// ============================================================================

/** 환경 ID (0=release, 1=stage, 2=dev) */
export type EnvId = 0 | 1 | 2;

/** 디바이스 타입 (0=Pylon, 1=Client) */
export type DeviceType = 0 | 1;

/** Pylon ID (7비트) */
export type PylonId = number & { readonly __brand: 'PylonId' };

/** Client ID (7비트) */
export type ClientId = number & { readonly __brand: 'ClientId' };

/** Device ID (PylonId 또는 ClientId) */
export type DeviceId = PylonId | ClientId;

/** Workspace ID (14비트) */
export type WorkspaceId = number & { readonly __brand: 'WorkspaceId' };

/** Conversation ID (24비트) */
export type ConversationId = number & { readonly __brand: 'ConversationId' };

// ============================================================================
// 비트 상수
// ============================================================================

/** 환경 ID 비트 수 */
export const ENV_ID_BITS = 2;

/** 디바이스 타입 비트 수 */
export const DEVICE_TYPE_BITS = 1;

/** 디바이스 인덱스 비트 수 */
export const DEVICE_INDEX_BITS = 4;

/** 워크스페이스 인덱스 비트 수 */
export const WORKSPACE_INDEX_BITS = 7;

/** 대화 인덱스 비트 수 */
export const CONVERSATION_INDEX_BITS = 10;

// ============================================================================
// 최대값 상수
// ============================================================================

/** 환경 ID 최대값 (0=release, 1=stage, 2=dev) */
export const MAX_ENV_ID = 2;

/** 디바이스 인덱스 최대값 (4비트 = 0~15) */
export const MAX_DEVICE_INDEX = 15;

/** 워크스페이스 인덱스 최대값 (7비트 = 0~127, 사용 범위 1~127) */
export const MAX_WORKSPACE_INDEX = 127;

/** 대화 인덱스 최대값 (10비트 = 0~1023, 사용 범위 1~1023) */
export const MAX_CONVERSATION_INDEX = 1023;

// ============================================================================
// 내부 상수
// ============================================================================

const DEVICE_ID_BITS = ENV_ID_BITS + DEVICE_TYPE_BITS + DEVICE_INDEX_BITS; // 7비트
const WORKSPACE_ID_BITS = DEVICE_ID_BITS + WORKSPACE_INDEX_BITS; // 14비트

// ============================================================================
// 인코딩 함수
// ============================================================================

/**
 * Pylon ID 인코딩
 * @param envId 환경 ID (0~2)
 * @param deviceIndex 디바이스 인덱스 (1~15, Pylon은 0 불가)
 * @returns 7비트 PylonId
 */
export function encodePylonId(envId: EnvId, deviceIndex: number): PylonId {
  // 환경 ID 검증
  if (envId < 0 || envId > MAX_ENV_ID) {
    throw new Error(`envId must be 0~${MAX_ENV_ID}, got ${envId}`);
  }

  // Pylon deviceIndex는 1~15 (0 불가)
  if (deviceIndex < 1 || deviceIndex > MAX_DEVICE_INDEX) {
    throw new Error(`Pylon deviceIndex must be 1~${MAX_DEVICE_INDEX}, got ${deviceIndex}`);
  }

  // envId(2비트) + deviceType(1비트, 0) + deviceIndex(4비트)
  const id = (envId << (DEVICE_TYPE_BITS + DEVICE_INDEX_BITS)) | (0 << DEVICE_INDEX_BITS) | deviceIndex;
  return id as PylonId;
}

/**
 * Client ID 인코딩
 * @param envId 환경 ID (0~2)
 * @param deviceIndex 디바이스 인덱스 (0~15)
 * @returns 7비트 ClientId
 */
export function encodeClientId(envId: EnvId, deviceIndex: number): ClientId {
  // 환경 ID 검증
  if (envId < 0 || envId > MAX_ENV_ID) {
    throw new Error(`envId must be 0~${MAX_ENV_ID}, got ${envId}`);
  }

  // Client deviceIndex는 0~15
  if (deviceIndex < 0 || deviceIndex > MAX_DEVICE_INDEX) {
    throw new Error(`Client deviceIndex must be 0~${MAX_DEVICE_INDEX}, got ${deviceIndex}`);
  }

  // envId(2비트) + deviceType(1비트, 1) + deviceIndex(4비트)
  const id = (envId << (DEVICE_TYPE_BITS + DEVICE_INDEX_BITS)) | (1 << DEVICE_INDEX_BITS) | deviceIndex;
  return id as ClientId;
}

/**
 * Workspace ID 인코딩
 * @param pylonId Pylon ID
 * @param workspaceIndex 워크스페이스 인덱스 (1~127)
 * @returns 14비트 WorkspaceId
 */
export function encodeWorkspaceId(pylonId: PylonId, workspaceIndex: number): WorkspaceId {
  // workspaceIndex는 1~127 (0 불가)
  if (workspaceIndex < 1 || workspaceIndex > MAX_WORKSPACE_INDEX) {
    throw new Error(`workspaceIndex must be 1~${MAX_WORKSPACE_INDEX}, got ${workspaceIndex}`);
  }

  // pylonId(7비트) + workspaceIndex(7비트)
  const id = (pylonId << WORKSPACE_INDEX_BITS) | workspaceIndex;
  return id as WorkspaceId;
}

/**
 * Conversation ID 인코딩
 * @param workspaceId Workspace ID
 * @param conversationIndex 대화 인덱스 (1~1023)
 * @returns 24비트 ConversationId
 */
export function encodeConversationId(workspaceId: WorkspaceId, conversationIndex: number): ConversationId {
  // conversationIndex는 1~1023 (0 불가)
  if (conversationIndex < 1 || conversationIndex > MAX_CONVERSATION_INDEX) {
    throw new Error(`conversationIndex must be 1~${MAX_CONVERSATION_INDEX}, got ${conversationIndex}`);
  }

  // workspaceId(14비트) + conversationIndex(10비트)
  const id = (workspaceId << CONVERSATION_INDEX_BITS) | conversationIndex;
  return id as ConversationId;
}

// ============================================================================
// 디코딩 함수
// ============================================================================

/** Pylon ID 디코딩 결과 */
interface DecodedPylonId {
  envId: EnvId;
  deviceType: 0;
  deviceIndex: number;
}

/** Client ID 디코딩 결과 */
interface DecodedClientId {
  envId: EnvId;
  deviceType: 1;
  deviceIndex: number;
}

/** Device ID 디코딩 결과 */
interface DecodedDeviceId {
  envId: EnvId;
  deviceType: DeviceType;
  deviceIndex: number;
}

/** Workspace ID 디코딩 결과 */
interface DecodedWorkspaceId {
  pylonId: PylonId;
  workspaceIndex: number;
}

/** Conversation ID 디코딩 결과 */
interface DecodedConversationId {
  workspaceId: WorkspaceId;
  conversationIndex: number;
}

/** Conversation ID 전체 디코딩 결과 */
interface DecodedConversationIdFull {
  envId: EnvId;
  deviceType: DeviceType;
  deviceIndex: number;
  workspaceIndex: number;
  conversationIndex: number;
  pylonId: PylonId;
  workspaceId: WorkspaceId;
}

/**
 * Pylon ID 디코딩
 * @param pylonId Pylon ID
 * @returns 디코딩된 Pylon ID 정보
 */
export function decodePylonId(pylonId: PylonId): DecodedPylonId {
  const deviceIndex = pylonId & ((1 << DEVICE_INDEX_BITS) - 1);
  const deviceType = (pylonId >> DEVICE_INDEX_BITS) & ((1 << DEVICE_TYPE_BITS) - 1);
  const envId = (pylonId >> (DEVICE_INDEX_BITS + DEVICE_TYPE_BITS)) & ((1 << ENV_ID_BITS) - 1);

  return {
    envId: envId as EnvId,
    deviceType: deviceType as 0,
    deviceIndex,
  };
}

/**
 * Client ID 디코딩
 * @param clientId Client ID
 * @returns 디코딩된 Client ID 정보
 */
export function decodeClientId(clientId: ClientId): DecodedClientId {
  const deviceIndex = clientId & ((1 << DEVICE_INDEX_BITS) - 1);
  const deviceType = (clientId >> DEVICE_INDEX_BITS) & ((1 << DEVICE_TYPE_BITS) - 1);
  const envId = (clientId >> (DEVICE_INDEX_BITS + DEVICE_TYPE_BITS)) & ((1 << ENV_ID_BITS) - 1);

  return {
    envId: envId as EnvId,
    deviceType: deviceType as 1,
    deviceIndex,
  };
}

/**
 * Device ID 디코딩 (PylonId 또는 ClientId)
 * @param deviceId Device ID
 * @returns 디코딩된 Device ID 정보
 */
export function decodeDeviceId(deviceId: DeviceId): DecodedDeviceId {
  const deviceIndex = deviceId & ((1 << DEVICE_INDEX_BITS) - 1);
  const deviceType = (deviceId >> DEVICE_INDEX_BITS) & ((1 << DEVICE_TYPE_BITS) - 1);
  const envId = (deviceId >> (DEVICE_INDEX_BITS + DEVICE_TYPE_BITS)) & ((1 << ENV_ID_BITS) - 1);

  return {
    envId: envId as EnvId,
    deviceType: deviceType as DeviceType,
    deviceIndex,
  };
}

/**
 * Workspace ID 디코딩
 * @param workspaceId Workspace ID
 * @returns 디코딩된 Workspace ID 정보
 */
export function decodeWorkspaceId(workspaceId: WorkspaceId): DecodedWorkspaceId {
  const workspaceIndex = workspaceId & ((1 << WORKSPACE_INDEX_BITS) - 1);
  const pylonId = (workspaceId >> WORKSPACE_INDEX_BITS) as PylonId;

  return {
    pylonId,
    workspaceIndex,
  };
}

/**
 * Conversation ID 디코딩
 * @param conversationId Conversation ID
 * @returns 디코딩된 Conversation ID 정보
 */
export function decodeConversationId(conversationId: ConversationId): DecodedConversationId {
  const conversationIndex = conversationId & ((1 << CONVERSATION_INDEX_BITS) - 1);
  const workspaceId = (conversationId >> CONVERSATION_INDEX_BITS) as WorkspaceId;

  return {
    workspaceId,
    conversationIndex,
  };
}

/**
 * Conversation ID 전체 디코딩 (모든 구성 요소 반환)
 * @param conversationId Conversation ID
 * @returns 모든 구성 요소가 포함된 디코딩 결과
 */
export function decodeConversationIdFull(conversationId: ConversationId): DecodedConversationIdFull {
  // Conversation ID → WorkspaceId + conversationIndex
  const { workspaceId, conversationIndex } = decodeConversationId(conversationId);

  // WorkspaceId → PylonId + workspaceIndex
  const { pylonId, workspaceIndex } = decodeWorkspaceId(workspaceId);

  // PylonId → envId + deviceType + deviceIndex
  const { envId, deviceType, deviceIndex } = decodePylonId(pylonId);

  return {
    envId,
    deviceType,
    deviceIndex,
    workspaceIndex,
    conversationIndex,
    pylonId,
    workspaceId,
  };
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * Device ID가 Pylon ID인지 확인
 * @param deviceId Device ID
 * @returns Pylon ID이면 true
 */
export function isPylonId(deviceId: DeviceId): deviceId is PylonId {
  const deviceType = (deviceId >> DEVICE_INDEX_BITS) & ((1 << DEVICE_TYPE_BITS) - 1);
  return deviceType === 0;
}

/**
 * Device ID가 Client ID인지 확인
 * @param deviceId Device ID
 * @returns Client ID이면 true
 */
export function isClientId(deviceId: DeviceId): deviceId is ClientId {
  const deviceType = (deviceId >> DEVICE_INDEX_BITS) & ((1 << DEVICE_TYPE_BITS) - 1);
  return deviceType === 1;
}

/**
 * Conversation ID를 문자열로 변환
 * 형식: "envId:deviceType:deviceIndex:workspaceIndex:conversationIndex"
 * @param conversationId Conversation ID
 * @returns 콜론으로 구분된 문자열
 */
export function conversationIdToString(conversationId: ConversationId): string {
  const { envId, deviceType, deviceIndex, workspaceIndex, conversationIndex } =
    decodeConversationIdFull(conversationId);

  return `${envId}:${deviceType}:${deviceIndex}:${workspaceIndex}:${conversationIndex}`;
}
