import { MD3DarkTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

/**
 * Material Design 3 Dark Theme
 * - roundness: 2 (MD3 기본값 4의 절반)
 */
export const theme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 2,
};

/**
 * 시맨틱 색상 (MD3 테마 보완)
 * - MD3에는 success/warning이 없어서 별도 정의
 */
export const semanticColors = {
  success: '#4CAF50',
  warning: '#FF9800',
  info: '#2196F3',

  onSuccess: '#FFFFFF',
  onWarning: '#000000',
  onInfo: '#FFFFFF',

  successContainer: 'rgba(76, 175, 80, 0.2)',
  warningContainer: 'rgba(255, 152, 0, 0.2)',
  infoContainer: 'rgba(33, 150, 243, 0.2)',
} as const;

/**
 * 상태 표시 색상 (StatusDot 등)
 */
export const statusColors = {
  idle: theme.colors.outline,
  working: semanticColors.warning,
  waiting: semanticColors.warning,
  permission: theme.colors.error,
  ready: semanticColors.success,
  error: theme.colors.error,
} as const;
