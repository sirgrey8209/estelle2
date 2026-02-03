import React from 'react';
import { View, Pressable } from 'react-native';
import { Surface, Text, ActivityIndicator, useTheme } from 'react-native-paper';
import { type FileInfo, formatFileSize, useDownloadStore } from '../../stores';
import { semanticColors } from '../../theme';

interface FileAttachmentCardProps {
  file: FileInfo;
  onDownload?: () => void;
  onOpen?: () => void;
}

/**
 * 파일 첨부 카드
 */
export function FileAttachmentCard({ file, onDownload, onOpen }: FileAttachmentCardProps) {
  const theme = useTheme();
  const downloadStatus = useDownloadStore((s) => s.getStatus(file.filename));
  const isDownloading = downloadStatus === 'downloading';
  const isDownloaded = downloadStatus === 'downloaded';
  const isFailed = downloadStatus === 'failed';

  const getFileIcon = (): string => {
    switch (file.fileType) {
      case 'image':
        return '🖼️';
      case 'markdown':
        return '📝';
      case 'text':
        return '📄';
      default:
        return '📁';
    }
  };

  const getStatusIcon = (): React.ReactNode => {
    if (isDownloading) {
      return <ActivityIndicator size="small" color={theme.colors.primary} />;
    }
    if (isDownloaded) {
      return <Text style={{ color: semanticColors.success, fontSize: 14 }}>✓</Text>;
    }
    if (isFailed) {
      return <Text style={{ color: theme.colors.error, fontSize: 14 }}>!</Text>;
    }
    return <Text style={{ color: theme.colors.primary, fontSize: 14 }}>⬇</Text>;
  };

  const handlePress = () => {
    if (isDownloaded) {
      onOpen?.();
    } else if (!isDownloading) {
      onDownload?.();
    }
  };

  return (
    <Pressable onPress={handlePress}>
      <Surface
        style={{
          marginVertical: 2,
          maxWidth: '90%',
          borderLeftWidth: 2,
          borderLeftColor: theme.colors.primary,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 4,
        }}
        elevation={0}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, marginRight: 12 }}>{getFileIcon()}</Text>

          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" numberOfLines={1}>
              {file.filename}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text variant="labelSmall" style={{ opacity: 0.6 }}>
                {formatFileSize(file.size)}
              </Text>
              {file.description && (
                <>
                  <Text variant="labelSmall" style={{ opacity: 0.4, marginHorizontal: 4 }}>|</Text>
                  <Text variant="labelSmall" style={{ opacity: 0.6, flex: 1 }} numberOfLines={1}>
                    {file.description}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={{ marginLeft: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
            {getStatusIcon()}
          </View>
        </View>

        {isFailed && (
          <Text variant="labelSmall" style={{ color: theme.colors.error, marginTop: 8 }}>
            다운로드 실패. 탭하여 재시도
          </Text>
        )}

        {!isDownloaded && !isDownloading && !isFailed && (
          <Text variant="labelSmall" style={{ opacity: 0.5, marginTop: 4 }}>
            탭하여 다운로드
          </Text>
        )}
      </Surface>
    </Pressable>
  );
}
