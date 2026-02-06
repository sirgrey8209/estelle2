/**
 * 시맨틱 색상
 * - 성공, 경고, 정보 색상 정의
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
 * - CSS 변수 기반 테마와 호환
 */
export const statusColors = {
  idle: 'hsl(var(--muted-foreground))',
  working: semanticColors.warning,
  waiting: semanticColors.warning,
  permission: 'hsl(var(--destructive))',
  ready: semanticColors.success,
  error: 'hsl(var(--destructive))',
} as const;
