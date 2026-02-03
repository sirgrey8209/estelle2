import React from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';

interface LoadingOverlayProps {
  message?: string;
}

/**
 * 로딩 오버레이
 */
export function LoadingOverlay({ message = '로딩 중...' }: LoadingOverlayProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={{ marginTop: 16 }}>{message}</Text>
    </View>
  );
}
