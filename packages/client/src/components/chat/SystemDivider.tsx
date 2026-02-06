import { getAbortDisplayText } from '../../stores';
import { cn } from '../../lib/utils';

interface SystemDividerProps {
  message: string;
  color?: 'default' | 'error';
}

/**
 * 시스템 구분선
 */
export function SystemDivider({ message, color = 'default' }: SystemDividerProps) {
  const isError = color === 'error';

  return (
    <div className="my-4 flex items-center">
      <div
        className={cn(
          'flex-1 h-px opacity-50',
          isError ? 'bg-destructive' : 'bg-border'
        )}
      />
      <span
        className={cn(
          'mx-3 text-xs',
          isError ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {message}
      </span>
      <div
        className={cn(
          'flex-1 h-px opacity-50',
          isError ? 'bg-destructive' : 'bg-border'
        )}
      />
    </div>
  );
}

interface ClaudeAbortedDividerProps {
  reason?: 'user' | 'session_ended';
}

/**
 * Claude 프로세스 중단 구분선 (빨간색)
 * - 사용자가 Stop 버튼을 눌렀을 때
 * - Pylon 재시작으로 세션이 끊겼을 때
 */
export function ClaudeAbortedDivider({ reason }: ClaudeAbortedDividerProps) {
  return <SystemDivider message={getAbortDisplayText(reason)} color="error" />;
}
