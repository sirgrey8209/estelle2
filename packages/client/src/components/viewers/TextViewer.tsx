import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface TextViewerProps {
  /** 텍스트 내용 */
  content: string;
  /** 파일명 */
  filename: string;
}

/**
 * 텍스트 파일 뷰어
 */
export function TextViewer({ content, filename }: TextViewerProps) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Text
          variant="bodySmall"
          style={{ fontFamily: 'monospace', lineHeight: 24, opacity: 0.8 }}
          selectable
        >
          {content}
        </Text>
      </ScrollView>
    </View>
  );
}
