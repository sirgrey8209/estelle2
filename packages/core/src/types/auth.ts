/**
 * @file auth.ts
 * @description 인증 관련 타입 정의
 *
 * Estelle 시스템에서 디바이스 인증에 사용되는 Payload 타입들입니다.
 * 클라이언트가 Relay에 연결할 때 인증 요청/응답에 사용됩니다.
 */

import type { DeviceType } from './device.js';

/**
 * 디바이스의 역할을 나타내는 타입
 *
 * @description
 * 인증된 디바이스가 시스템에서 수행할 수 있는 역할을 정의합니다.
 *
 * - `controller`: 명령을 보내고 시스템을 제어할 수 있는 역할
 * - `viewer`: 상태를 조회만 할 수 있는 읽기 전용 역할
 *
 * @example
 * ```typescript
 * const role: DeviceRole = 'controller';
 *
 * if (role === 'controller') {
 *   // 명령 전송 가능
 * }
 * ```
 */
export type DeviceRole = 'controller' | 'viewer';

/**
 * 인증 요청 시 클라이언트가 보내는 Payload
 *
 * @description
 * 디바이스가 Relay 서버에 연결하여 인증을 요청할 때 전송하는 데이터입니다.
 * deviceType은 필수이며, deviceId, name, mac 주소는 선택적으로 제공할 수 있습니다.
 *
 * deviceId는 숫자만 허용합니다:
 * - Pylon: 1-9 범위의 숫자 ID
 * - Desktop: 100 이상의 숫자 ID (서버에서 자동 발급 가능)
 * - App 클라이언트: deviceId 없이 요청 시 서버에서 자동 발급
 *
 * @property deviceId - (선택) 디바이스를 식별하는 고유 숫자 ID, 없으면 서버에서 자동 발급
 * @property deviceType - 연결하는 디바이스의 유형
 * @property name - (선택) 디바이스의 표시 이름
 * @property mac - (선택) 네트워크 인터페이스의 MAC 주소
 *
 * @example
 * ```typescript
 * // Pylon 인증 요청 (숫자 ID)
 * const pylonPayload: AuthPayload = {
 *   deviceId: 1,
 *   deviceType: 'pylon',
 *   name: 'Main Pylon'
 * };
 *
 * // Desktop 인증 요청 (숫자 ID)
 * const desktopPayload: AuthPayload = {
 *   deviceId: 100,
 *   deviceType: 'desktop',
 *   name: 'My Desktop'
 * };
 *
 * // App 클라이언트 인증 요청 (deviceId 없이 - 서버에서 자동 발급)
 * const appPayload: AuthPayload = {
 *   deviceType: 'desktop'
 * };
 *
 * // MAC 주소 포함 인증 요청
 * const authPayloadWithMac: AuthPayload = {
 *   deviceId: 100,
 *   deviceType: 'desktop',
 *   mac: '00:1A:2B:3C:4D:5E'
 * };
 * ```
 */
export interface AuthPayload {
  /** (선택) 디바이스를 식별하는 고유 숫자 ID, 없으면 서버에서 자동 발급 */
  deviceId?: number;

  /** 연결하는 디바이스의 유형 */
  deviceType: DeviceType;

  /** (선택) 디바이스의 표시 이름 */
  name?: string;

  /** (선택) 네트워크 인터페이스의 MAC 주소 */
  mac?: string;
}

/**
 * 인증 성공 시 반환되는 디바이스 정보
 *
 * @description
 * 인증이 성공했을 때 Relay 서버가 클라이언트에게 반환하는
 * 완전한 디바이스 정보입니다. 디바이스 식별 정보와 함께
 * 표시 이름, 아이콘, 역할 등의 메타데이터를 포함합니다.
 *
 * @property deviceId - 디바이스를 고유하게 식별하는 숫자 ID
 * @property deviceType - 디바이스의 유형
 * @property name - UI에 표시할 디바이스 이름
 * @property icon - 디바이스 아이콘의 URL 또는 경로
 * @property role - 디바이스의 시스템 내 역할
 *
 * @example
 * ```typescript
 * const authenticatedDevice: AuthenticatedDevice = {
 *   deviceId: 1,
 *   deviceType: 'pylon',
 *   name: 'Main Pylon Server',
 *   icon: 'server-icon.png',
 *   role: 'controller'
 * };
 * ```
 */
export interface AuthenticatedDevice {
  /** 디바이스를 고유하게 식별하는 숫자 ID */
  deviceId: number;

  /** 디바이스의 유형 */
  deviceType: DeviceType;

  /** UI에 표시할 디바이스 이름 */
  name: string;

  /** 디바이스 아이콘의 URL 또는 경로 */
  icon: string;

  /** 디바이스의 시스템 내 역할 */
  role: DeviceRole;
}

/**
 * 인증 결과 응답 Payload
 *
 * @description
 * Relay 서버가 인증 요청에 대한 응답으로 반환하는 데이터입니다.
 *
 * **성공 시:**
 * - `success: true`
 * - `device`: 인증된 디바이스의 전체 정보 (권장)
 * - `deviceId`: 디바이스 숫자 ID만 (하위 호환성)
 *
 * **실패 시:**
 * - `success: false`
 * - `error`: 실패 원인을 설명하는 메시지
 *
 * @property success - 인증 성공 여부
 * @property error - (실패 시) 오류 메시지
 * @property deviceId - (성공 시, 선택) 인증된 디바이스 숫자 ID
 * @property device - (성공 시, 선택) 인증된 디바이스의 전체 정보
 *
 * @example
 * ```typescript
 * // 성공 응답 (전체 디바이스 정보 포함)
 * const successResult: AuthResultPayload = {
 *   success: true,
 *   device: {
 *     deviceId: 1,
 *     deviceType: 'pylon',
 *     name: 'Main Pylon',
 *     icon: 'pylon.png',
 *     role: 'controller'
 *   }
 * };
 *
 * // 실패 응답
 * const failResult: AuthResultPayload = {
 *   success: false,
 *   error: 'Authentication failed: unknown device'
 * };
 * ```
 */
export interface AuthResultPayload {
  /** 인증 성공 여부 */
  success: boolean;

  /** (실패 시) 오류 메시지 */
  error?: string;

  /** (성공 시, 선택) 인증된 디바이스 숫자 ID */
  deviceId?: number;

  /** (성공 시, 선택) 인증된 디바이스의 전체 정보 */
  device?: AuthenticatedDevice;
}
