interface ResultInfoProps {
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
}

/**
 * 실행 결과 정보
 */
export function ResultInfo({
  durationMs,
  inputTokens,
  outputTokens,
}: ResultInfoProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds >= 60) {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min}m ${sec}s`;
    }
    return `${seconds.toFixed(1)}s`;
  };

  const formatTokens = (n: number) => {
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}k`;
    }
    return n.toString();
  };

  const hasTokens = (inputTokens !== undefined && inputTokens > 0) ||
                    (outputTokens !== undefined && outputTokens > 0);
  const hasContent = durationMs !== undefined || hasTokens;
  if (!hasContent) return null;

  return (
    <div
      className="my-0.5 mx-2 px-2 py-1 bg-muted rounded-xl flex items-center self-start"
    >
      {durationMs !== undefined && (
        <span className="text-xs text-muted-foreground/70">
          {formatDuration(durationMs)}
        </span>
      )}
      {durationMs !== undefined && hasTokens && (
        <span className="mx-2 text-xs text-muted-foreground/40">|</span>
      )}
      {inputTokens !== undefined && inputTokens > 0 && (
        <span className="text-xs text-muted-foreground/60">
          {formatTokens(inputTokens)}↓
        </span>
      )}
      {inputTokens !== undefined && inputTokens > 0 && outputTokens !== undefined && outputTokens > 0 && (
        <span className="w-1" />
      )}
      {outputTokens !== undefined && outputTokens > 0 && (
        <span className="text-xs text-muted-foreground/60">
          {formatTokens(outputTokens)}↑
        </span>
      )}
    </div>
  );
}
