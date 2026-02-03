/**
 * @file device-icons.ts
 * @description deviceType 기반 아이콘 매핑 유틸리티
 */

import type { DeviceType } from '@estelle/core';

/**
 * DeviceType별 아이콘 매핑 상수
 *
 * @description
 * 각 디바이스 타입에 해당하는 이모지 아이콘을 정의합니다.
 *
 * - pylon: 서버 아이콘 (🖥️)
 * - desktop: 노트북 아이콘 (💻)
 */
export const DEVICE_ICONS: Record<DeviceType, string> = {
  pylon: '🖥️',
  desktop: '💻',
};

/**
 * 디바이스 타입에 해당하는 아이콘을 반환합니다.
 *
 * @param deviceType - 디바이스 타입
 * @returns 해당 타입의 아이콘 문자열, 알 수 없는 타입인 경우 fallback 아이콘(❓) 반환
 *
 * @example
 * ```typescript
 * getDeviceIcon('pylon');   // '🖥️'
 * getDeviceIcon('desktop'); // '💻'
 * getDeviceIcon('unknown' as DeviceType); // '❓'
 * ```
 */
export function getDeviceIcon(deviceType: DeviceType): string {
  return DEVICE_ICONS[deviceType] ?? '❓';
}
