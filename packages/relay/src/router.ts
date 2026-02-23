/**
 * @file router.ts
 * @description Relay 서버 라우팅 함수
 *
 * 메시지 라우팅을 위한 순수 함수들입니다.
 * 특정 클라이언트, 디바이스, 또는 브로드캐스트 전송을 처리합니다.
 * WebSocket 직접 전송 대신 대상 clientId 목록을 반환합니다.
 */

import type {
  Client,
  RelayDeviceType,
  RelayMessage,
  RouteTarget,
  BroadcastOption,
  AuthenticatedClient,
} from './types.js';
import { isAuthenticatedClient } from './types.js';
import { parseDeviceId } from './utils.js';
import { decodeDeviceId } from '@estelle/core';

// ============================================================================
// 라우팅 결과 타입
// ============================================================================

/**
 * 라우팅 결과
 *
 * @description
 * 라우팅 함수들의 반환 타입입니다.
 * 전송 대상 clientId 목록과 성공/실패 정보를 포함합니다.
 *
 * @property targetClientIds - 전송 대상 clientId 목록
 * @property success - 하나 이상의 대상을 찾았는지 여부
 */
export interface RouteResult {
  /** 전송 대상 clientId 목록 */
  targetClientIds: string[];

  /** 하나 이상의 대상을 찾았는지 여부 */
  success: boolean;
}

// ============================================================================
// 단일 대상 라우팅
// ============================================================================

/**
 * 특정 clientId로 라우팅합니다.
 *
 * @description
 * clientId가 존재하고 인증된 상태인지 확인합니다.
 *
 * @param clientId - 전송 대상 clientId
 * @param clients - 클라이언트 맵
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * const result = routeToClient('client-123', clients);
 * if (result.success) {
 *   // client-123에게 전송
 * }
 * ```
 */
export function routeToClient(
  clientId: string,
  clients: Map<string, Client>
): RouteResult {
  const client = clients.get(clientId);

  if (client && isAuthenticatedClient(client)) {
    return {
      targetClientIds: [clientId],
      success: true,
    };
  }

  return {
    targetClientIds: [],
    success: false,
  };
}

/**
 * 특정 deviceId로 라우팅합니다.
 *
 * @description
 * deviceId가 일치하는 인증된 클라이언트를 찾습니다.
 * deviceType이 지정되면 추가로 타입도 일치해야 합니다.
 *
 * @param deviceId - 전송 대상 deviceId
 * @param deviceType - (선택) 전송 대상 deviceType
 * @param clients - 클라이언트 맵
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * // deviceId만 지정
 * const result1 = routeToDevice(1, null, clients);
 *
 * // deviceId + deviceType 지정
 * const result2 = routeToDevice(1, 'pylon', clients);
 * ```
 */
export function routeToDevice(
  deviceId: number,
  deviceType: RelayDeviceType | null,
  clients: Map<string, Client>
): RouteResult {
  const targetClientIds: string[] = [];

  // 인코딩된 deviceId를 디코딩하여 deviceIndex 추출
  // deviceId가 7비트 인코딩 값(예: 80)이면 디코딩, 아니면 그대로 사용
  const decoded = decodeDeviceId(deviceId as import('@estelle/core').NumericDeviceId);
  const targetDeviceIndex = decoded.deviceIndex;

  for (const [clientId, client] of clients) {
    if (!isAuthenticatedClient(client)) {
      continue;
    }

    // client.deviceId는 내부 deviceIndex (0~15)
    if (client.deviceId !== targetDeviceIndex) {
      continue;
    }

    // deviceType이 지정되면 추가 확인
    if (deviceType !== null && client.deviceType !== deviceType) {
      continue;
    }

    targetClientIds.push(clientId);
  }

  return {
    targetClientIds,
    success: targetClientIds.length > 0,
  };
}

// ============================================================================
// to 필드 라우팅 (숫자 배열만 허용)
// ============================================================================

/**
 * to 필드를 기반으로 라우팅합니다.
 *
 * @description
 * to 필드는 **무조건 숫자 배열**입니다. (인코딩된 deviceId 배열)
 *
 * @param to - 라우팅 대상 (숫자 배열)
 * @param clients - 클라이언트 맵
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * // 단일 대상
 * routeByTo([80], clients);
 *
 * // 다중 대상
 * routeByTo([80, 81, 82], clients);
 * ```
 */
export function routeByTo(
  to: RouteTarget,
  clients: Map<string, Client>
): RouteResult {
  const allTargetIds = new Set<string>();

  for (const encodedDeviceId of to) {
    const result = routeToDevice(encodedDeviceId, null, clients);
    for (const clientId of result.targetClientIds) {
      allTargetIds.add(clientId);
    }
  }

  return {
    targetClientIds: Array.from(allTargetIds),
    success: allTargetIds.size > 0,
  };
}

// ============================================================================
// 브로드캐스트 라우팅
// ============================================================================

/**
 * 모든 인증된 클라이언트에게 브로드캐스트합니다.
 *
 * @description
 * 발신자를 제외한 모든 인증된 클라이언트를 대상으로 합니다.
 *
 * @param clients - 클라이언트 맵
 * @param excludeClientId - 제외할 clientId (보통 발신자)
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * const result = broadcastAll(clients, 'sender-client-id');
 * // 발신자를 제외한 모든 인증된 클라이언트
 * ```
 */
export function broadcastAll(
  clients: Map<string, Client>,
  excludeClientId: string | null = null
): RouteResult {
  const targetClientIds: string[] = [];

  for (const [clientId, client] of clients) {
    // 발신자 제외
    if (clientId === excludeClientId) {
      continue;
    }

    // 인증된 클라이언트만
    if (!isAuthenticatedClient(client)) {
      continue;
    }

    targetClientIds.push(clientId);
  }

  return {
    targetClientIds,
    success: targetClientIds.length > 0,
  };
}

/**
 * 특정 deviceType에만 브로드캐스트합니다.
 *
 * @description
 * 지정된 deviceType을 가진 인증된 클라이언트만 대상으로 합니다.
 *
 * @param deviceType - 전송 대상 deviceType
 * @param clients - 클라이언트 맵
 * @param excludeClientId - 제외할 clientId
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * // 모든 pylon에게 전송
 * const result = broadcastToType('pylon', clients, 'sender-id');
 * ```
 */
export function broadcastToType(
  deviceType: RelayDeviceType,
  clients: Map<string, Client>,
  excludeClientId: string | null = null
): RouteResult {
  const targetClientIds: string[] = [];

  for (const [clientId, client] of clients) {
    if (clientId === excludeClientId) {
      continue;
    }

    if (!isAuthenticatedClient(client)) {
      continue;
    }

    if (client.deviceType !== deviceType) {
      continue;
    }

    targetClientIds.push(clientId);
  }

  return {
    targetClientIds,
    success: targetClientIds.length > 0,
  };
}

/**
 * viewer 타입 클라이언트에게만 브로드캐스트합니다.
 *
 * @description
 * viewer 타입을 가진 인증된 클라이언트만 대상으로 합니다.
 *
 * @param clients - 클라이언트 맵
 * @param excludeClientId - 제외할 clientId
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * const result = broadcastToViewers(clients, 'sender-id');
 * ```
 */
export function broadcastToViewers(
  clients: Map<string, Client>,
  excludeClientId: string | null = null
): RouteResult {
  return broadcastToType('viewer', clients, excludeClientId);
}

/**
 * 특정 conversationId를 가진 viewer만 필터링합니다.
 *
 * @description
 * 특정 대화에 관심 있는 viewer들만 선택합니다.
 *
 * @param conversationId - 대화 ID
 * @param clients - 클라이언트 맵
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * const result = filterByConversationId(42, clients);
 * // conversationId=42인 viewer만 포함
 * ```
 */
export function filterByConversationId(
  conversationId: number,
  clients: Map<string, Client>
): RouteResult {
  const targetClientIds: string[] = [];

  for (const [clientId, client] of clients) {
    if (!isAuthenticatedClient(client)) {
      continue;
    }

    // viewer 타입만 대상
    if (client.deviceType !== 'viewer') {
      continue;
    }

    // conversationId 일치 확인
    if ((client as Client).conversationId === conversationId) {
      targetClientIds.push(clientId);
    }
  }

  return {
    targetClientIds,
    success: targetClientIds.length > 0,
  };
}

/**
 * 특정 deviceType을 제외하고 브로드캐스트합니다.
 *
 * @description
 * 지정된 deviceType을 제외한 인증된 클라이언트를 대상으로 합니다.
 *
 * @param excludeDeviceType - 제외할 deviceType
 * @param clients - 클라이언트 맵
 * @param excludeClientId - 추가로 제외할 clientId
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * // pylon을 제외한 모든 클라이언트 (= app들만)
 * const result = broadcastExceptType('pylon', clients, 'sender-id');
 * ```
 */
export function broadcastExceptType(
  excludeDeviceType: RelayDeviceType,
  clients: Map<string, Client>,
  excludeClientId: string | null = null
): RouteResult {
  const targetClientIds: string[] = [];

  for (const [clientId, client] of clients) {
    if (clientId === excludeClientId) {
      continue;
    }

    if (!isAuthenticatedClient(client)) {
      continue;
    }

    if (client.deviceType === excludeDeviceType) {
      continue;
    }

    targetClientIds.push(clientId);
  }

  return {
    targetClientIds,
    success: targetClientIds.length > 0,
  };
}

// ============================================================================
// broadcast 옵션 처리
// ============================================================================

/**
 * broadcast 옵션을 기반으로 라우팅합니다.
 *
 * @description
 * broadcast 필드의 다양한 형태를 처리합니다:
 * - true 또는 'all': 모든 인증된 클라이언트
 * - 'pylons': pylon 타입만
 * - 'clients': pylon을 제외한 클라이언트만
 * - 문자열: 해당 deviceType만
 *
 * @param broadcast - 브로드캐스트 옵션
 * @param clients - 클라이언트 맵
 * @param excludeClientId - 제외할 clientId
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * routeByBroadcast('all', clients, 'sender-id');
 * routeByBroadcast('pylons', clients, 'sender-id');
 * routeByBroadcast('clients', clients, 'sender-id');
 * routeByBroadcast(true, clients, 'sender-id');
 * ```
 */
export function routeByBroadcast(
  broadcast: BroadcastOption | boolean,
  clients: Map<string, Client>,
  excludeClientId: string | null = null
): RouteResult {
  // true 또는 'all': 모든 클라이언트
  if (broadcast === true || broadcast === 'all') {
    return broadcastAll(clients, excludeClientId);
  }

  // 'pylons': pylon만
  if (broadcast === 'pylons') {
    return broadcastToType('pylon', clients, excludeClientId);
  }

  // 'clients': pylon 제외 (= app만)
  if (broadcast === 'clients') {
    return broadcastExceptType('pylon', clients, excludeClientId);
  }

  // 문자열: 해당 deviceType만
  if (typeof broadcast === 'string') {
    return broadcastToType(broadcast as RelayDeviceType, clients, excludeClientId);
  }

  // 그 외: 빈 결과
  return {
    targetClientIds: [],
    success: false,
  };
}

// ============================================================================
// 기본 라우팅 규칙
// ============================================================================

/**
 * 기본 라우팅 규칙을 적용합니다.
 *
 * @description
 * to나 broadcast가 지정되지 않은 경우의 기본 라우팅:
 * - pylon이 보낸 메시지: app들에게 전달 (pylon 제외)
 * - app이 보낸 메시지: pylon들에게 전달
 *
 * @param senderDeviceType - 발신자의 deviceType
 * @param clients - 클라이언트 맵
 * @param excludeClientId - 제외할 clientId (발신자)
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * // pylon이 보낸 메시지 -> app들에게
 * routeByDefault('pylon', clients, 'pylon-client-id');
 *
 * // app이 보낸 메시지 -> pylon들에게
 * routeByDefault('app', clients, 'app-client-id');
 * ```
 */
export function routeByDefault(
  senderDeviceType: RelayDeviceType,
  clients: Map<string, Client>,
  excludeClientId: string | null = null
): RouteResult {
  if (senderDeviceType === 'pylon') {
    // pylon -> app들 (pylon 제외)
    return broadcastExceptType('pylon', clients, excludeClientId);
  } else {
    // app -> pylon들
    return broadcastToType('pylon', clients, excludeClientId);
  }
}

// ============================================================================
// 통합 라우팅 함수
// ============================================================================

/**
 * 메시지의 라우팅 대상을 결정합니다.
 *
 * @description
 * 메시지의 to, broadcast 필드와 발신자 정보를 기반으로
 * 최종 전송 대상을 결정합니다.
 *
 * 우선순위:
 * 1. to 필드가 있으면 해당 대상으로 전송
 * 2. broadcast 필드가 있으면 브로드캐스트
 * 3. 둘 다 없으면 기본 라우팅 규칙 적용
 *
 * @param message - 라우팅할 메시지
 * @param senderClientId - 발신자 clientId
 * @param senderDeviceType - 발신자 deviceType
 * @param clients - 클라이언트 맵
 * @returns 라우팅 결과
 *
 * @example
 * ```typescript
 * const result = routeMessage(
 *   { type: 'some_event', to: 1 },
 *   'sender-id',
 *   'app',
 *   clients
 * );
 *
 * for (const clientId of result.targetClientIds) {
 *   sendToClient(clientId, message);
 * }
 * ```
 */
export function routeMessage(
  message: RelayMessage,
  senderClientId: string,
  senderDeviceType: RelayDeviceType,
  clients: Map<string, Client>
): RouteResult {
  // 1. to가 있으면 해당 대상으로 전달 (숫자 배열)
  if (message.to !== undefined && Array.isArray(message.to)) {
    return routeByTo(message.to, clients);
  }

  // 2. broadcast 옵션 처리
  if (message.broadcast !== undefined) {
    return routeByBroadcast(message.broadcast, clients, senderClientId);
  }

  // 3. to도 broadcast도 없으면 에러 (라우팅 안 함)
  // 모든 메시지는 명시적으로 to 또는 broadcast를 지정해야 함
  console.error(`[ROUTE ERROR] No routing target for message type: ${message.type} from ${senderDeviceType}`);
  return {
    targetClientIds: [],
    success: false,
  };
}

// ============================================================================
// 유틸리티
// ============================================================================

/**
 * 특정 deviceType의 연결된 클라이언트가 있는지 확인합니다.
 *
 * @param deviceType - 확인할 deviceType
 * @param clients - 클라이언트 맵
 * @returns 해당 타입의 인증된 클라이언트 존재 여부
 *
 * @example
 * ```typescript
 * if (hasConnectedDeviceType('app', clients)) {
 *   // 앱 클라이언트가 연결되어 있음
 * }
 * ```
 */
export function hasConnectedDeviceType(
  deviceType: RelayDeviceType,
  clients: Map<string, Client>
): boolean {
  for (const client of clients.values()) {
    if (isAuthenticatedClient(client) && client.deviceType === deviceType) {
      return true;
    }
  }
  return false;
}

/**
 * app 타입 클라이언트(pylon 제외)가 있는지 확인합니다.
 *
 * @description
 * 앱 클라이언트 연결 상태를 확인합니다.
 *
 * @param clients - 클라이언트 맵
 * @returns app 클라이언트 존재 여부
 *
 * @example
 * ```typescript
 * if (!hasAppClients(clients)) {
 *   // 모든 앱 클라이언트 연결 해제됨
 * }
 * ```
 */
export function hasAppClients(clients: Map<string, Client>): boolean {
  for (const client of clients.values()) {
    if (isAuthenticatedClient(client) && client.deviceType !== 'pylon') {
      return true;
    }
  }
  return false;
}
