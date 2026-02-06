import { cn } from '../../lib/utils';

/**
 * 상태 타입
 */
type StatusType =
  | 'idle'
  | 'working'
  | 'permission'
  | 'offline'
  | 'error'
  | 'waiting'
  | 'unread'
  | 'done';

interface StatusDotProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * 상태별 색상 클래스
 */
function getStatusColorClass(status: StatusType): string {
  switch (status) {
    case 'error':
    case 'permission':
    case 'waiting':
      return 'bg-destructive';
    case 'working':
      return 'bg-yellow-500';
    case 'unread':
    case 'done':
      return 'bg-green-500';
    case 'idle':
    case 'offline':
    default:
      return 'bg-muted-foreground';
  }
}

/**
 * 점멸 여부
 */
function shouldBlink(status: StatusType): boolean {
  return status === 'working' || status === 'waiting' || status === 'permission';
}

const sizeClasses = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-3 w-3',
};

/**
 * 상태 표시점
 */
export function StatusDot({ status, size = 'md', className }: StatusDotProps) {
  const colorClass = getStatusColorClass(status);
  const blink = shouldBlink(status);

  return (
    <span
      className={cn(
        'inline-block rounded-full',
        sizeClasses[size],
        colorClass,
        blink && 'animate-pulse',
        className
      )}
    />
  );
}
