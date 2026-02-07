import { useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useSettingsStore } from '../../stores';
import { requestUsage } from '../../services/relaySender';

/**
 * Claude 사용량 카드
 *
 * ccusage 도구를 통해 Claude Code 사용량을 조회하여 표시합니다.
 * 컴포넌트 마운트 시 자동으로 usage 요청을 보냅니다.
 */
export function ClaudeUsageCard() {
  const usageSummary = useSettingsStore((s) => s.usageSummary);
  const isLoadingUsage = useSettingsStore((s) => s.isLoadingUsage);
  const usageError = useSettingsStore((s) => s.usageError);
  const setLoadingUsage = useSettingsStore((s) => s.setLoadingUsage);

  // 마운트 시 usage 요청
  useEffect(() => {
    handleRefresh();
  }, []);

  const handleRefresh = () => {
    setLoadingUsage(true);
    requestUsage();
  };

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
    return `$${cost.toFixed(2)}`;
  };

  const getGaugeColor = (efficiency: number) => {
    if (efficiency >= 70) return 'bg-green-500';
    if (efficiency >= 40) return 'bg-yellow-500';
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
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
            disabled={isLoadingUsage}
          >
            {isLoadingUsage ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoadingUsage && !usageSummary ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : usageError && !usageSummary ? (
          <div className="text-center py-3">
            <p className="text-sm text-destructive">{usageError}</p>
            <p className="text-xs text-muted-foreground mt-1">
              ccusage가 설치되어 있는지 확인해 주세요
            </p>
          </div>
        ) : !usageSummary ? (
          <p className="text-center text-muted-foreground py-3">
            No usage data yet
          </p>
        ) : (
          <div className="space-y-4">
            {/* 오늘 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Today</span>
                <span className="text-xs text-muted-foreground">
                  Cache {usageSummary.todayCacheEfficiency}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatItem
                  icon="💰"
                  value={formatCost(usageSummary.todayCost)}
                  label="Cost"
                  colorClass="text-yellow-500"
                />
                <StatItem
                  icon="🔢"
                  value={formatTokens(usageSummary.todayTokens)}
                  label="Tokens"
                  colorClass="text-primary"
                />
              </div>
              {usageSummary.todayCacheEfficiency > 0 && (
                <div className="mt-2">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getGaugeColor(usageSummary.todayCacheEfficiency)} transition-all`}
                      style={{ width: `${Math.min(usageSummary.todayCacheEfficiency, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 주간/월간 */}
            <div className="border-t pt-3">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">This Week</p>
                  <p className="text-sm font-semibold text-yellow-500">
                    {formatCost(usageSummary.weekCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTokens(usageSummary.weekTokens)} tokens
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">This Month</p>
                  <p className="text-sm font-semibold text-yellow-500">
                    {formatCost(usageSummary.monthCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTokens(usageSummary.monthTokens)} tokens
                  </p>
                </div>
              </div>
            </div>

            {/* 마지막 업데이트 */}
            <div className="text-center pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                Last updated: {new Date(usageSummary.lastUpdated).toLocaleTimeString()}
              </span>
            </div>
          </div>
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
