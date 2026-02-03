import React from 'react';
import { View } from 'react-native';
import { Card, Text, ProgressBar, useTheme } from 'react-native-paper';
import { useSettingsStore } from '../../stores';
import { semanticColors } from '../../theme';

/**
 * Claude 사용량 카드
 */
export function ClaudeUsageCard() {
  const theme = useTheme();
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
    if (cacheEfficiency >= 70) return semanticColors.success;
    if (cacheEfficiency >= 40) return semanticColors.warning;
    return theme.colors.error;
  };

  return (
    <Card mode="outlined" style={{ marginBottom: 8 }}>
      <Card.Title
        title="Claude Usage"
        titleVariant="titleSmall"
        left={() => <Text>📊</Text>}
        right={() =>
          claudeUsage && claudeUsage.sessionCount > 0 ? (
            <Text variant="labelSmall" style={{ marginRight: 16, opacity: 0.6 }}>
              {claudeUsage.sessionCount} sessions
            </Text>
          ) : null
        }
      />
      <Card.Content>
        {!claudeUsage ? (
          <Text style={{ textAlign: 'center', opacity: 0.6, paddingVertical: 12 }}>
            No usage data yet
          </Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <StatItem
                icon="💰"
                value={formatCost(claudeUsage.totalCostUsd || 0)}
                label="Cost"
                color={semanticColors.warning}
              />
              <StatItem
                icon="🔢"
                value={formatTokens(totalTokens)}
                label="Tokens"
                color={theme.colors.primary}
              />
              <StatItem
                icon="💾"
                value={`${cacheEfficiency.toFixed(0)}%`}
                label="Cache"
                color={semanticColors.success}
              />
            </View>

            {cacheEfficiency > 0 && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text variant="labelSmall" style={{ opacity: 0.6 }}>
                    Cache Efficiency
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Text variant="labelSmall" style={{ opacity: 0.6 }}>
                    {cacheEfficiency.toFixed(1)}%
                  </Text>
                </View>
                <ProgressBar
                  progress={Math.min(cacheEfficiency / 100, 1)}
                  color={getGaugeColor()}
                  style={{ height: 4, borderRadius: 2 }}
                />
              </View>
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );
}

interface StatItemProps {
  icon: string;
  value: string;
  label: string;
  color: string;
}

function StatItem({ icon, value, label, color }: StatItemProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text variant="titleMedium" style={{ color, fontWeight: 'bold', marginTop: 4 }}>
        {value}
      </Text>
      <Text variant="labelSmall" style={{ opacity: 0.6 }}>
        {label}
      </Text>
    </View>
  );
}
