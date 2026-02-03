/**
 * @file types.ts
 * @description Relay 서버 전용 타입 정의
 *
 * Relay 서버 내부에서 사용하는 타입들입니다.
 * 클라이언트 연결 정보, 디바이스 설정, 상태 관리 등을 위한 타입을 정의합니다.
 */

import type { DeviceType, Message } from '@estelle/core';

// ============================================================================
// 디바이스 설정 타입
// ============================================================================

/**
 * 디바이스 역할을 나타내는 타입
 *
 * @description
 * 원본 estelle에서 사용하던 디바이스 역할입니다.
 * - office: 사무실 디바이스
 * - home: 집 디바이스
 * - client: 동적으로 연결된 클라이언트
 * - unknown: 알 수 없는 역할
 */
export type DeviceRole = 'office' | 'home' | 'client' | 'unknown';

/**
 * 등록된 디바이스의 설정 정보
 *
 * @description
 * DEVICES 상수에 정의된 고정 디바이스의 설정입니다.
 * IP 기반 인증을 위한 allowedIps 목록을 포함합니다.
 *
 * @property name - 디바이스 표시 이름
 * @property icon - 디바이스 아이콘 (이모지)
 * @property role - 디바이스 역할 (office, home 등)
 * @property allowedIps - 허용된 IP 주소 목록 ('*'는 모든 IP 허용)
 *
 * @example
 * ```typescript
 * const device: DeviceConfig = {
 *   name: 'Device 1',
 *   icon: '🏢',
 *   role: 'office',
 *   allowedIps: ['*']
 * };
 * ```
 */
export interface DeviceConfig {
  /** 디바이스 표시 이름 */
  name: string;

  /** 디바이스 아이콘 (이모지) */
  icon: string;

  /** 디바이스 역할 */
  role: DeviceRole;

  /** 허용된 IP 주소 목록 ('*'는 모든 IP 허용) */
  allowedIps: string[];
}

/**
 * 디바이스 정보 (조회용)
 *
 * @description
 * getDeviceInfo 함수가 반환하는 디바이스 정보입니다.
 * allowedIps는 포함하지 않습니다 (보안상 외부에 노출하지 않음).
 *
 * @property name - 디바이스 표시 이름
 * @property icon - 디바이스 아이콘
 * @property role - 디바이스 역할
 */
export interface DeviceInfo {
  /** 디바이스 표시 이름 */
  name: string;

  /** 디바이스 아이콘 */
  icon: string;

  /** 디바이스 역할 */
  role: DeviceRole;
}

// ============================================================================
// 클라이언트 연결 타입
// ============================================================================

/**
 * 디바이스 타입 (Relay 전용 확장)
 *
 * @description
 * Relay에서 사용하는 디바이스 타입입니다.
 * core의 DeviceType보다 단순하게 pylon과 app으로만 구분합니다.
 */
export type RelayDeviceType = 'pylon' | 'app';

/**
 * WebSocket 연결 클라이언트의 정보
 *
 * @description
 * Relay 서버에 연결된 클라이언트의 상태 정보입니다.
 * 인증 전/후 상태를 모두 표현할 수 있도록 설계되었습니다.
 *
 * @property ws - WebSocket 연결 객체 (서버에서만 사용)
 * @property deviceId - 디바이스 ID (인증 후 할당)
 * @property deviceType - 디바이스 타입 (pylon 또는 app)
 * @property ip - 클라이언트 IP 주소
 * @property connectedAt - 연결 시각
 * @property authenticated - 인증 완료 여부
 *
 * @example
 * ```typescript
 * // 인증 전 클라이언트
 * const pendingClient: Client = {
 *   deviceId: null,
 *   deviceType: null,
 *   ip: '192.168.1.100',
 *   connectedAt: new Date(),
 *   authenticated: false
 * };
 *
 * // 인증 후 클라이언트
 * const authClient: Client = {
 *   deviceId: 1,
 *   deviceType: 'pylon',
 *   ip: '192.168.1.100',
 *   connectedAt: new Date(),
 *   authenticated: true
 * };
 * ```
 */
export interface Client {
  /** 디바이스 ID (인증 후 할당, null이면 미인증) */
  deviceId: number | null;

  /** 디바이스 타입 (pylon 또는 app) */
  deviceType: RelayDeviceType | null;

  /** 클라이언트 IP 주소 */
  ip: string;

  /** 연결 시각 */
  connectedAt: Date;

  /** 인증 완료 여부 */
  authenticated: boolean;
}

/**
 * 인증된 클라이언트 (타입 가드용)
 *
 * @description
 * 인증이 완료된 클라이언트를 나타내는 타입입니다.
 * deviceId와 deviceType이 null이 아님이 보장됩니다.
 */
export interface AuthenticatedClient extends Client {
  deviceId: number;
  deviceType: RelayDeviceType;
  authenticated: true;
}

// ============================================================================
// 메시지 타입
// ============================================================================

/**
 * Relay에서 사용하는 메시지 라우팅 대상
 *
 * @description
 * 메시지의 to 필드에 사용되는 타입입니다.
 * 숫자(deviceId), 객체(deviceId + deviceType), 또는 배열 형태를 지원합니다.
 *
 * @example
 * ```typescript
 * // deviceId만 지정
 * const target1: RouteTarget = 1;
 *
 * // deviceId + deviceType 지정
 * const target2: RouteTarget = { deviceId: 1, deviceType: 'pylon' };
 *
 * // 다중 대상
 * const target3: RouteTarget = [1, 2, { deviceId: 3, deviceType: 'app' }];
 * ```
 */
export type RouteTarget =
  | number
  | { deviceId: number; deviceType?: RelayDeviceType }
  | Array<number | { deviceId: number; deviceType?: RelayDeviceType }>;

/**
 * 브로드캐스트 옵션
 *
 * @description
 * 메시지의 broadcast 필드에 사용되는 타입입니다.
 *
 * - 'all': 모든 클라이언트에게 전송
 * - 'pylons': pylon 타입에만 전송
 * - 'clients': pylon을 제외한 클라이언트에만 전송
 * - string: 특정 deviceType에만 전송
 */
export type BroadcastOption = 'all' | 'pylons' | 'clients' | string;

/**
 * Relay에서 처리하는 메시지의 기본 구조
 *
 * @description
 * Relay가 수신하고 처리하는 메시지의 형태입니다.
 * 원본 메시지 구조를 유지하면서 타입 안전성을 제공합니다.
 *
 * @typeParam T - payload의 타입
 *
 * @property type - 메시지 타입
 * @property payload - 메시지 데이터
 * @property to - 라우팅 대상 (선택)
 * @property broadcast - 브로드캐스트 옵션 (선택)
 * @property from - 발신자 정보 (Relay가 주입)
 */
export interface RelayMessage<T = unknown> {
  /** 메시지 타입 */
  type: string;

  /** 메시지 데이터 */
  payload?: T;

  /** 라우팅 대상 */
  to?: RouteTarget;

  /** 브로드캐스트 옵션 */
  broadcast?: BroadcastOption | boolean;

  /** 발신자 정보 (Relay가 주입) */
  from?: {
    deviceId: number;
    deviceType: RelayDeviceType;
    name: string;
    icon: string;
  };
}

// AuthRequestPayload는 @estelle/core의 AuthPayload를 사용합니다.
// relay/src/index.ts에서 re-export 됩니다.

/**
 * 인증 결과 페이로드
 *
 * @property success - 인증 성공 여부
 * @property error - 실패 시 오류 메시지
 * @property device - 성공 시 디바이스 정보
 */
export interface AuthResultPayload {
  /** 인증 성공 여부 */
  success: boolean;

  /** 실패 시 오류 메시지 */
  error?: string;

  /** 성공 시 디바이스 정보 */
  device?: {
    deviceId: number;
    deviceType: RelayDeviceType;
    name: string;
    icon: string;
    role: DeviceRole;
  };
}

/**
 * 디바이스 목록 항목
 *
 * @description
 * getDeviceList 함수가 반환하는 디바이스 정보입니다.
 */
export interface DeviceListItem {
  /** 디바이스 ID */
  deviceId: number;

  /** 디바이스 타입 */
  deviceType: RelayDeviceType;

  /** 표시 이름 */
  name: string;

  /** 아이콘 */
  icon: string;

  /** 역할 */
  role: DeviceRole;

  /** 연결 시각 (ISO 문자열) */
  connectedAt: string;
}

// ============================================================================
// 상태 관리 타입
// ============================================================================

/**
 * Relay 서버 상태
 *
 * @description
 * Relay 서버의 전체 상태를 나타내는 타입입니다.
 * 순수 함수에서 상태를 주입받을 때 사용합니다.
 *
 * @property clients - 연결된 클라이언트 맵 (clientId -> Client)
 * @property nextClientId - 다음 앱 클라이언트에 할당할 ID
 */
export interface RelayState {
  /** 연결된 클라이언트 맵 (clientId -> Client) */
  clients: Map<string, Client>;

  /** 다음 앱 클라이언트에 할당할 ID */
  nextClientId: number;
}

// ============================================================================
// 액션 타입 (순수 함수 반환용)
// ============================================================================

/**
 * 메시지 전송 액션
 *
 * @description
 * 클라이언트에게 메시지를 전송하는 액션입니다.
 */
export interface SendAction {
  type: 'send';
  /** 전송 대상 clientId */
  clientId: string;
  /** 전송할 메시지 */
  message: RelayMessage;
}

/**
 * 브로드캐스트 액션
 *
 * @description
 * 여러 클라이언트에게 메시지를 브로드캐스트하는 액션입니다.
 */
export interface BroadcastAction {
  type: 'broadcast';
  /** 전송 대상 clientId 목록 */
  clientIds: string[];
  /** 전송할 메시지 */
  message: RelayMessage;
}

/**
 * 상태 업데이트 액션
 *
 * @description
 * 클라이언트 상태를 업데이트하는 액션입니다.
 */
export interface UpdateClientAction {
  type: 'update_client';
  /** 업데이트 대상 clientId */
  clientId: string;
  /** 업데이트할 필드들 */
  updates: Partial<Client>;
}

/**
 * nextClientId 증가 액션
 *
 * @description
 * 다음 클라이언트 ID를 증가시키는 액션입니다.
 */
export interface IncrementNextClientIdAction {
  type: 'increment_next_client_id';
}

/**
 * nextClientId 리셋 액션
 *
 * @description
 * 모든 앱 클라이언트가 연결 해제되었을 때 ID를 리셋하는 액션입니다.
 */
export interface ResetNextClientIdAction {
  type: 'reset_next_client_id';
  /** 리셋할 값 */
  value: number;
}

/**
 * 메시지 핸들러가 반환하는 액션들의 유니온 타입
 */
export type RelayAction =
  | SendAction
  | BroadcastAction
  | UpdateClientAction
  | IncrementNextClientIdAction
  | ResetNextClientIdAction;

// ============================================================================
// 타입 가드 함수
// ============================================================================

/**
 * 클라이언트가 인증되었는지 확인하는 타입 가드
 *
 * @param client - 확인할 클라이언트
 * @returns 인증된 클라이언트인지 여부
 *
 * @example
 * ```typescript
 * const client: Client = getClient(clientId);
 * if (isAuthenticatedClient(client)) {
 *   // client.deviceId와 client.deviceType이 null이 아님
 *   console.log(client.deviceId);
 * }
 * ```
 */
export function isAuthenticatedClient(
  client: Client
): client is AuthenticatedClient {
  return (
    client.authenticated &&
    client.deviceId !== null &&
    client.deviceType !== null
  );
}
