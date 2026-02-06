import { useState, useEffect } from 'react';

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
 * 디바이스 타입 계산
 */
function getDeviceType(width: number): DeviceType {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

/**
 * 반응형 훅 (웹 버전)
 *
 * 화면 크기에 따른 디바이스 타입을 반환합니다.
 */
export function useResponsive(): ResponsiveInfo {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { width, height } = dimensions;
  const deviceType = getDeviceType(width);

  return {
    width,
    height,
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
  };
}
