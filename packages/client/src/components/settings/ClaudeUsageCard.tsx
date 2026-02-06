import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useSettingsStore } from '../../stores';

/**
 * Claude 사용량 카드
 */
export function ClaudeUsageCard() {
  const claudeUsage = useSettingsStore((s) => s.claudeUsage);

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const calculateCacheEfficiency = () => {
    if (!claudeUsage) return 0;
    const total = claudeUsage.inputTokens;
    if (total === 0) return 0;
    return ((claudeUsage.cacheReadTokens || 0) / total) * 100;
  };

  const totalTokens =
    claudeUsage
      ? claudeUsage.inputTokens + claudeUsage.outputTokens
      : 0;

  const cacheEfficiency = calculateCacheEfficiency();

  const getGaugeColor = () => {
    if (cacheEfficiency >= 70) return 'bg-green-500';
    if (cacheEfficiency >= 40) return 'bg-yellow-500';
    return 'bg-destructive';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span>📊</span>
            Claude Usage
          </span>
          {claudeUsage && claudeUsage.sessionCount > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              {claudeUsage.sessionCount} sessions
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!claudeUsage ? (
          <p className="text-center text-muted-foreground py-3">
            No usage data yet
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <StatItem
                icon="💰"
                value={formatCost(claudeUsage.totalCostUsd || 0)}
                label="Cost"
                colorClass="text-yellow-500"
              />
              <StatItem
                icon="🔢"
                value={formatTokens(totalTokens)}
                label="Tokens"
                colorClass="text-primary"
              />
              <StatItem
                icon="💾"
                value={`${cacheEfficiency.toFixed(0)}%`}
                label="Cache"
                colorClass="text-green-500"
              />
            </div>

            {cacheEfficiency > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">
                    Cache Efficiency
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {cacheEfficiency.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getGaugeColor()} transition-all`}
                    style={{ width: `${Math.min(cacheEfficiency, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface StatItemProps {
  icon: string;
  value: string;
  label: string;
  colorClass: string;
}

function StatItem({ icon, value, label, colorClass }: StatItemProps) {
  return (
    <div className="text-center">
      <span className="text-base">{icon}</span>
      <p className={`text-lg font-bold ${colorClass} mt-1`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
