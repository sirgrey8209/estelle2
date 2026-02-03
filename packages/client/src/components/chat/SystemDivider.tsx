import React from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { getAbortDisplayText } from '../../stores';

interface SystemDividerProps {
  message: string;
  color?: 'default' | 'error';
}

/**
 * 시스템 구분선
 */
export function SystemDivider({ message, color = 'default' }: SystemDividerProps) {
  const theme = useTheme();
  const lineColor = color === 'error' ? theme.colors.error : theme.colors.outlineVariant;
  const textColor = color === 'error' ? theme.colors.error : theme.colors.outline;

  return (
    <View style={{ marginVertical: 16, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, height: 1, backgroundColor: lineColor, opacity: 0.5 }} />
      <Text variant="labelSmall" style={{ color: textColor, marginHorizontal: 12 }}>
        {message}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: lineColor, opacity: 0.5 }} />
    </View>
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
