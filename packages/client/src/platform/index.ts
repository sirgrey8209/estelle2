/**
 * @file platform/index.ts
 * @description 플랫폼 추상화 레이어 - 웹 구현
 *
 * React Native 의존성을 웹 API로 대체합니다.
 */

export * from './storage';
export * from './useImagePicker';

// hooks/useResponsive.ts는 이미 웹으로 마이그레이션됨
export { useResponsive, BREAKPOINTS } from '../hooks/useResponsive';
export type { ResponsiveInfo, DeviceType } from '../hooks/useResponsive';
