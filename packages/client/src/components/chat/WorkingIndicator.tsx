import { useEffect, useState } from 'react';
import { useClaudeStore } from '../../stores';

interface WorkingIndicatorProps {
  startTime?: number | null;
}

/**
 * 작업 표시기 (펄스 점 + 경과 시간 + 토큰 정보)
 */
export function WorkingIndicator({ startTime }: WorkingIndicatorProps = {}) {
  const storeStartTime = useClaudeStore((s) => s.workStartTime);
  const realtimeUsage = useClaudeStore((s) => s.realtimeUsage);
  const workStartTime = startTime ?? storeStartTime;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!workStartTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - workStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [workStartTime]);

  const formatTokens = (n: number) => {
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}k`;
    }
    return n.toString();
  };

  const formatTime = (seconds: number) => {
    if (seconds >= 60) {
      const min = Math.floor(seconds / 60);
      const sec = seconds % 60;
      return `${min}m ${sec}s`;
    }
    return `${seconds}s`;
  };

  // 마지막 업데이트 타입에 따라 표시할 토큰 결정
  const getTokenDisplay = () => {
    if (!realtimeUsage) return null;

    const { lastUpdateType, inputTokens, outputTokens } = realtimeUsage;

    if (lastUpdateType === 'output' && outputTokens > 0) {
      return `${formatTokens(outputTokens)}↑`;
    } else if (inputTokens > 0) {
      return `${formatTokens(inputTokens)}↓`;
    }
    return null;
  };

  const tokenDisplay = getTokenDisplay();

  return (
    <div className="px-2 py-1 flex items-center justify-start">
      <div className="px-3 py-1 bg-muted rounded-full flex items-center">
        {/* 펄스 점 */}
        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />

        <span className="ml-2 text-xs text-muted-foreground">
          {formatTime(elapsed)}
        </span>

        {tokenDisplay && (
          <>
            <span className="ml-2 text-xs text-muted-foreground/40">|</span>
            <span className="ml-2 text-xs text-muted-foreground/60">
              {tokenDisplay}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
