import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FlatList, View, Pressable } from 'react-native';
import { Text, ActivityIndicator, IconButton, useTheme } from 'react-native-paper';
import { useClaudeStore, useUploadStore } from '../../stores';
import { MessageBubble } from './MessageBubble';
import { StreamingBubble } from './StreamingBubble';
import { UploadingBubble } from './UploadingBubble';
import { ResultInfo } from './ResultInfo';
import { ClaudeAbortedDivider } from './SystemDivider';
import { FileAttachmentCard } from './FileAttachmentCard';
import { WorkingIndicator } from './WorkingIndicator';
import type { StoreMessage } from '../../stores/claudeStore';
import type { ResultMessage, AbortedMessage, FileAttachmentMessage } from '@estelle/core';

interface MessageListProps {
  isLoadingHistory?: boolean;
  hasMoreHistory?: boolean;
  onLoadMoreHistory?: () => void;
}

/**
 * 메시지 목록
 */
export function MessageList({
  isLoadingHistory = false,
  hasMoreHistory = false,
  onLoadMoreHistory,
}: MessageListProps) {
  const theme = useTheme();
  const { messages, textBuffer, workStartTime, status } = useClaudeStore();
  const { uploads } = useUploadStore();
  const flatListRef = useRef<FlatList>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const uploadingItems = Object.values(uploads).filter(
    (u) => u.status === 'uploading'
  );

  const buildDisplayItems = useCallback(() => {
    const items: Array<{ type: string; data: unknown; key: string }> = [];

    if (workStartTime) {
      items.push({
        type: 'working',
        data: workStartTime,
        key: 'working-indicator',
      });
    }

    if (textBuffer) {
      items.push({
        type: 'streaming',
        data: textBuffer,
        key: 'streaming-bubble',
      });
    }

    uploadingItems.forEach((upload) => {
      items.push({
        type: 'uploading',
        data: upload,
        key: `upload-${upload.blobId}`,
      });
    });

    const reversedMessages = [...messages].reverse();
    reversedMessages.forEach((msg, index) => {
      items.push({
        type: 'message',
        data: msg,
        key: msg.id || `msg-${index}`,
      });
    });

    if (isLoadingHistory || hasMoreHistory) {
      items.push({
        type: 'loading',
        data: isLoadingHistory,
        key: 'loading-indicator',
      });
    }

    return items;
  }, [messages, textBuffer, workStartTime, uploadingItems, isLoadingHistory, hasMoreHistory]);

  const displayItems = buildDisplayItems();

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const isNearTop = contentOffset.y > contentSize.height - layoutMeasurement.height - 100;

      if (isNearTop && hasMoreHistory && !isLoadingHistory) {
        onLoadMoreHistory?.();
      }

      setShowScrollButton(contentOffset.y > 200);
    },
    [hasMoreHistory, isLoadingHistory, onLoadMoreHistory]
  );

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  useEffect(() => {
    if (!showScrollButton && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    }
  }, [messages.length, textBuffer, showScrollButton]);

  const renderItem = useCallback(({ item }: { item: { type: string; data: unknown; key: string } }) => {
    switch (item.type) {
      case 'working':
        return (
          <View style={{ marginBottom: 4 }}>
            <WorkingIndicator startTime={item.data as number} />
          </View>
        );

      case 'streaming':
        return (
          <View style={{ marginBottom: 4 }}>
            <StreamingBubble text={item.data as string} />
          </View>
        );

      case 'uploading':
        const upload = item.data as { blobId: string };
        return (
          <View style={{ marginBottom: 4 }}>
            <UploadingBubble blobId={upload.blobId} />
          </View>
        );

      case 'message':
        const message = item.data as StoreMessage;
        return (
          <View style={{ marginBottom: 4 }}>
            {renderMessage(message)}
          </View>
        );

      case 'loading':
        const loading = item.data as boolean;
        return (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.outline} />
            ) : (
              <Text variant="labelSmall" style={{ opacity: 0.5 }}>
                스크롤하여 이전 메시지 로드
              </Text>
            )}
          </View>
        );

      default:
        return null;
    }
  }, [theme]);

  const renderMessage = (message: StoreMessage) => {
    switch (message.type) {
      case 'result': {
        const resultMsg = message as ResultMessage;
        return (
          <ResultInfo
            durationMs={resultMsg.resultInfo.durationMs}
            inputTokens={resultMsg.resultInfo.inputTokens}
            outputTokens={resultMsg.resultInfo.outputTokens}
            cacheReadTokens={resultMsg.resultInfo.cacheReadTokens}
          />
        );
      }

      case 'aborted': {
        const abortedMsg = message as AbortedMessage;
        return <ClaudeAbortedDivider reason={abortedMsg.reason} />;
      }

      case 'file_attachment': {
        const fileMsg = message as FileAttachmentMessage;
        return (
          <FileAttachmentCard
            file={fileMsg.file}
            onDownload={() => {
              console.log('Download:', fileMsg.file.filename);
            }}
            onOpen={() => {
              console.log('Open:', fileMsg.file.filename);
            }}
          />
        );
      }

      default:
        return <MessageBubble message={message} />;
    }
  };

  const keyExtractor = (item: { key: string }) => item.key;

  if (displayItems.length === 0) {
    if (status === 'working') {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="bodyMedium" style={{ marginTop: 16, opacity: 0.6 }}>
            대화를 시작하는 중...
          </Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <Text variant="bodyLarge" style={{ opacity: 0.6 }}>세션이 없습니다.</Text>
        <Text variant="bodySmall" style={{ marginTop: 8, opacity: 0.5 }}>
          메시지를 입력하시면 자동으로 새 세션이 시작됩니다.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        ref={flatListRef}
        data={displayItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        inverted
        contentContainerStyle={{ padding: 16 }}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={20}
      />

      {showScrollButton && (
        <IconButton
          icon="chevron-down"
          mode="contained"
          size={20}
          onPress={scrollToBottom}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
          }}
        />
      )}
    </View>
  );
}
