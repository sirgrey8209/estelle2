import React from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { semanticColors } from '../../theme';

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
  cacheReadTokens,
}: ResultInfoProps) {
  const theme = useTheme();

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <View
      style={{
        marginVertical: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: theme.colors.surfaceVariant,
        borderRadius: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
      }}
    >
      {durationMs !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="labelSmall" style={{ opacity: 0.6 }}>시간:</Text>
          <Text variant="labelSmall" style={{ marginLeft: 4, opacity: 0.8 }}>
            {formatDuration(durationMs)}
          </Text>
        </View>
      )}

      {inputTokens !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="labelSmall" style={{ opacity: 0.6 }}>입력:</Text>
          <Text variant="labelSmall" style={{ marginLeft: 4, opacity: 0.8 }}>
            {inputTokens.toLocaleString()}
          </Text>
        </View>
      )}

      {outputTokens !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="labelSmall" style={{ opacity: 0.6 }}>출력:</Text>
          <Text variant="labelSmall" style={{ marginLeft: 4, opacity: 0.8 }}>
            {outputTokens.toLocaleString()}
          </Text>
        </View>
      )}

      {cacheReadTokens !== undefined && cacheReadTokens > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="labelSmall" style={{ opacity: 0.6 }}>캐시:</Text>
          <Text variant="labelSmall" style={{ marginLeft: 4, color: semanticColors.success }}>
            {cacheReadTokens.toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  );
}
