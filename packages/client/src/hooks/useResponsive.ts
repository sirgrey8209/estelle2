import { useWindowDimensions } from 'react-native';

/**
 * 브레이크포인트
 */
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
} as const;

/**
 * 디바이스 타입
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * 반응형 훅 반환값
 */
export interface ResponsiveInfo {
  width: number;
  height: number;
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

/**
 * 반응형 훅
 *
 * 화면 크기에 따른 디바이스 타입을 반환합니다.
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  let deviceType: DeviceType = 'mobile';
  if (width >= BREAKPOINTS.desktop) {
    deviceType = 'desktop';
  } else if (width >= BREAKPOINTS.tablet) {
    deviceType = 'tablet';
  }

  return {
    width,
    height,
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
  };
}
