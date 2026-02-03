import React, { useState, useCallback } from 'react';
import { View, Image, Platform } from 'react-native';
import { IconButton, Button, Text, useTheme, Portal, Dialog, List } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useWorkspaceStore, useClaudeStore } from '../../stores';
import { useImageUploadStore, AttachedImage } from '../../stores/imageUploadStore';
import { AutoResizeTextInput } from '../common/AutoResizeTextInput';

interface InputBarProps {
  disabled?: boolean;
  onSend?: (text: string, attachments?: AttachedImage[]) => void;
  onStop?: () => void;
}

/**
 * 입력 바
 */
export function InputBar({ disabled = false, onSend, onStop }: InputBarProps) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const { selectedConversation } = useWorkspaceStore();
  const { status } = useClaudeStore();
  const { attachedImage, setAttachedImage, hasActiveUpload } = useImageUploadStore();

  const isWorking = status === 'working';
  const canSend = (text.trim() || attachedImage) && !disabled && !isWorking;

  const handleSend = useCallback(() => {
    if (!canSend || !selectedConversation) return;

    if (hasActiveUpload) {
      return;
    }

    const attachments = attachedImage ? [attachedImage] : undefined;
    onSend?.(text.trim(), attachments);
    setText('');
    setAttachedImage(null);
  }, [canSend, selectedConversation, hasActiveUpload, attachedImage, text, onSend, setAttachedImage]);

  const handleStop = () => {
    onStop?.();
  };

  const handleKeyPress = (e: any) => {
    if (Platform.OS !== 'web') return;

    // 데스크탑: Enter = 전송, Shift+Enter 또는 Ctrl+Enter = 줄바꾸기
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey && !e.nativeEvent.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const pickImage = async (source: 'gallery' | 'camera') => {
    setShowAttachMenu(false);

    try {
      const result =
        source === 'gallery'
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
            });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setAttachedImage({
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          uri: asset.uri,
          fileName: asset.fileName || 'image.jpg',
        });
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  const removeAttachment = () => {
    setAttachedImage(null);
  };

  return (
    <View style={{ backgroundColor: theme.colors.secondaryContainer }}>
      {/* 첨부 이미지 미리보기 */}
      {attachedImage && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingTop: 8,
            backgroundColor: theme.colors.surfaceVariant,
          }}
        >
          <View style={{ position: 'relative' }}>
            <Image
              source={{ uri: attachedImage.uri }}
              style={{ width: 64, height: 64, borderRadius: 8 }}
              resizeMode="cover"
            />
            <IconButton
              icon="close-circle"
              size={16}
              onPress={removeAttachment}
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                margin: 0,
                backgroundColor: theme.colors.error,
              }}
              iconColor="#fff"
            />
          </View>
          <Text variant="labelSmall" style={{ marginLeft: 8, flex: 1, opacity: 0.7 }} numberOfLines={1}>
            {attachedImage.fileName}
          </Text>
        </View>
      )}

      {/* 입력 영역 */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 6 }}>
        {/* 첨부 버튼 */}
        <IconButton
          icon="plus"
          size={18}
          onPress={() => setShowAttachMenu(true)}
          disabled={isWorking}
          iconColor={theme.colors.onSecondaryContainer}
          style={{ margin: 0, width: 32, height: 32 }}
        />

        {/* 텍스트 입력 */}
        <AutoResizeTextInput
          placeholder={disabled ? '대기 중...' : '메시지를 입력하세요...'}
          value={text}
          onChangeText={setText}
          onKeyPress={handleKeyPress}
          editable={!(disabled || isWorking)}
          minLines={1}
          maxLines={6}
          style={{
            flex: 1,
            backgroundColor: theme.colors.surface,
            borderRadius: 8,
            marginHorizontal: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 14,
            color: theme.colors.onSurface,
          }}
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />

        {/* 버튼 영역 */}
        {isWorking ? (
          <Button
            mode="contained"
            onPress={handleStop}
            buttonColor={theme.colors.error}
            compact
          >
            Stop
          </Button>
        ) : hasActiveUpload ? (
          <IconButton
            icon="loading"
            size={18}
            disabled
            iconColor={theme.colors.onSecondaryContainer}
            style={{ margin: 0, width: 32, height: 32 }}
          />
        ) : (
          <IconButton
            icon="send"
            mode="contained"
            size={18}
            onPress={handleSend}
            disabled={!canSend}
            containerColor={theme.colors.secondary}
            iconColor={theme.colors.onSecondary}
            style={{ margin: 0, width: 32, height: 32 }}
          />
        )}
      </View>

      {/* 모바일 첨부 메뉴 */}
      <Portal>
        <Dialog visible={showAttachMenu} onDismiss={() => setShowAttachMenu(false)}>
          <Dialog.Content style={{ paddingHorizontal: 0 }}>
            <List.Item
              title="갤러리에서 선택"
              left={(props) => <List.Icon {...props} icon="image" />}
              onPress={() => pickImage('gallery')}
            />
            <List.Item
              title="카메라 촬영"
              left={(props) => <List.Icon {...props} icon="camera" />}
              onPress={() => pickImage('camera')}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAttachMenu(false)}>취소</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
