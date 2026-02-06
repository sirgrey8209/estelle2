/**
 * @file device-icons.ts
 * @description 아이콘 이름 기반 Lucide 아이콘 매핑 유틸리티
 */

import type { LucideIcon } from 'lucide-react';
import { Monitor, Laptop, HelpCircle, Building2, Home } from 'lucide-react';

/**
 * 아이콘 이름 → Lucide 아이콘 매핑
 * deviceConfigStore의 icon 값과 매칭됨
 */
const ICON_MAP: Record<string, LucideIcon> = {
  // DeviceConfig 아이콘 이름
  'office-building-outline': Building2,
  'home-outline': Home,
  'monitor': Monitor,
  // DeviceType (레거시 호환)
  'pylon': Monitor,
  'desktop': Laptop,
};

/**
 * 아이콘 이름에 해당하는 Lucide 아이콘 컴포넌트를 반환합니다.
 *
 * @param iconName - 아이콘 이름 (deviceConfigStore.getIcon 반환값)
 * @returns Lucide 아이콘 컴포넌트
 *
 * @example
 * ```typescript
 * const Icon = getDeviceIcon('office-building-outline');
 * <Icon className="h-4 w-4" />
 * ```
 */
export function getDeviceIcon(iconName: string | undefined): LucideIcon {
  if (!iconName) return HelpCircle;
  return ICON_MAP[iconName] ?? HelpCircle;
}

/**
 * DeviceType별 이모지 아이콘 매핑 상수 (레거시 호환용)
 */
export const DEVICE_ICONS: Record<string, string> = {
  pylon: '🖥️',
  desktop: '💻',
};
