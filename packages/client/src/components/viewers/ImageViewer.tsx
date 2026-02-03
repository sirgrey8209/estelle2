import React from 'react';
import { View, Image, ScrollView } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface ImageViewerProps {
  /** Base64 인코딩된 이미지 데이터 또는 URI */
  data: string;
  /** 파일명 */
  filename: string;
}

/**
 * 이미지 뷰어 (확대/축소 지원)
 */
export function ImageViewer({ data, filename }: ImageViewerProps) {
  const theme = useTheme();
  // data가 base64인지 uri인지 판단
  const imageSource = data.startsWith('data:') || data.startsWith('file:') || data.startsWith('http')
    ? { uri: data }
    : { uri: `data:image/png;base64,${data}` };

  const [error, setError] = React.useState(false);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.colors.error, fontSize: 40, marginBottom: 12 }}>🖼️</Text>
        <Text variant="bodyMedium" style={{ opacity: 0.6 }}>이미지를 표시할 수 없습니다</Text>
        <Text variant="labelSmall" style={{ marginTop: 4, opacity: 0.4 }}>{filename}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
      maximumZoomScale={4}
      minimumZoomScale={0.5}
      bouncesZoom
    >
      <Image
        source={imageSource}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
        onError={() => setError(true)}
      />
    </ScrollView>
  );
}
