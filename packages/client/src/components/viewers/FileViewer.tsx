import React from 'react';
import { View, Pressable } from 'react-native';
import { Portal, Dialog, Text, IconButton, useTheme } from 'react-native-paper';
import { ImageViewer } from './ImageViewer';
import { TextViewer } from './TextViewer';
import { MarkdownViewer } from './MarkdownViewer';
import { semanticColors } from '../../theme';

interface FileInfo {
  filename: string;
  size: number;
  mimeType?: string;
}

interface FileViewerProps {
  visible: boolean;
  onClose: () => void;
  file: FileInfo;
  /** 텍스트 내용 또는 base64 이미지 데이터 */
  content: string;
}

/**
 * 파일 뷰어 다이얼로그
 */
export function FileViewer({ visible, onClose, file, content }: FileViewerProps) {
  const theme = useTheme();

  const isImage = file.mimeType?.startsWith('image/') ||
    /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.filename);

  const isMarkdown = file.mimeType === 'text/markdown' ||
    /\.(md|markdown)$/i.test(file.filename);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (): string => {
    if (isImage) return '🖼️';
    if (isMarkdown) return '📝';
    return '📄';
  };

  const getFileIconColor = (): string => {
    if (isImage) return theme.colors.tertiary;
    if (isMarkdown) return semanticColors.info;
    return theme.colors.outline;
  };

  const renderContent = () => {
    if (isImage) {
      return <ImageViewer data={content} filename={file.filename} />;
    }
    if (isMarkdown) {
      return <MarkdownViewer content={content} filename={file.filename} />;
    }
    return <TextViewer content={content} filename={file.filename} />;
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onClose}
        style={{
          maxWidth: '90%',
          maxHeight: '85%',
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Dialog.Title style={{ paddingRight: 48 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, color: getFileIconColor() }}>{getFileIcon()}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text variant="titleSmall" numberOfLines={1}>
                {file.filename}
              </Text>
              <Text variant="labelSmall" style={{ opacity: 0.6 }}>
                {formatSize(file.size)}
              </Text>
            </View>
          </View>
        </Dialog.Title>

        <IconButton
          icon="close"
          size={20}
          onPress={onClose}
          style={{ position: 'absolute', right: 8, top: 8 }}
        />

        <Dialog.Content style={{ padding: 0, flex: 1 }}>
          <View style={{ height: 1, backgroundColor: theme.colors.outlineVariant }} />
          <View style={{ flex: 1, minHeight: 300 }}>
            {renderContent()}
          </View>
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}
