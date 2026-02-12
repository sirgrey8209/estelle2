/**
 * @file constants.ts
 * @description Relay 서버 상수 정의
 *
 * 고정 디바이스 설정을 정의합니다.
 */

import type { DeviceConfig } from './types.js';

// ============================================================================
// 디바이스 설정
// ============================================================================

/**
 * 등록된 고정 디바이스 목록
 *
 * @description
 * Pylon으로 연결할 수 있는 고정 디바이스들의 설정입니다.
 * deviceId(숫자)를 키로 사용하며, IP 기반 인증을 위한 정보를 포함합니다.
 *
 * @remarks
 * - allowedIps에 '*'를 지정하면 모든 IP에서 접근 가능
 * - 실제 운영 환경에서는 특정 IP만 허용하도록 설정 권장
 *
 * @example
 * ```typescript
 * const device1Config = DEVICES[1];
 * // { name: 'Device 1', icon: '🏢', role: 'office', allowedIps: ['*'] }
 *
 * if (DEVICES[deviceId]) {
 *   // 등록된 고정 디바이스
 * }
 * ```
 */
export const DEVICES: Record<number, DeviceConfig> = {
  1: { name: 'Device 1', icon: '🏢', role: 'office', allowedIps: ['*'] },
  2: { name: 'Device 2', icon: '🏠', role: 'home', allowedIps: ['*'] },
};

// ============================================================================
// 기본 포트
// ============================================================================

/**
 * 기본 WebSocket 서버 포트
 *
 * @description
 * 환경 변수 PORT가 설정되지 않았을 때 사용하는 기본 포트입니다.
 * 테스트에서는 DEFAULT_PORT 환경변수로 오버라이드 가능합니다.
 */
export const DEFAULT_PORT = parseInt(process.env['DEFAULT_PORT'] || '8080', 10);
