import React from 'react';
import { View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';

interface StreamingBubbleProps {
  text: string;
}

/**
 * 스트리밍 버블
 *
 * Claude의 응답이 스트리밍될 때 표시됩니다.
 */
export function StreamingBubble({ text }: StreamingBubbleProps) {
  const theme = useTheme();

  return (
    <View style={{ marginVertical: 8, alignSelf: 'flex-start', maxWidth: '85%' }}>
      <Surface
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 16,
          borderBottomLeftRadius: 4,
        }}
        elevation={1}
      >
        <Text variant="bodyMedium" selectable>
          {text}
          <Text style={{ color: theme.colors.primary }}>▋</Text>
        </Text>
      </Surface>
    </View>
  );
}
