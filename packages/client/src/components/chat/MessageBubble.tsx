import React from 'react';
import { View, Image, Pressable } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import type { StoreMessage, Attachment } from '../../stores/claudeStore';
import type {
  UserTextMessage,
  AssistantTextMessage,
  ToolStartMessage,
  ToolCompleteMessage,
  ErrorMessage,
  UserResponseMessage,
} from '@estelle/core';
import { ToolCard } from './ToolCard';
import { semanticColors } from '../../theme';

interface MessageBubbleProps {
  message: StoreMessage;
  onImagePress?: (uri: string) => void;
}

/**
 * 메시지 버블 (컴팩트)
 */
export function MessageBubble({ message, onImagePress }: MessageBubbleProps) {
  const theme = useTheme();

  const isUser = message.role === 'user' && message.type === 'text';
  const isToolStart = message.type === 'tool_start';
  const isToolComplete = message.type === 'tool_complete';
  const isError = message.type === 'error';
  const isUserResponse = message.type === 'user_response';

  if (isToolStart || isToolComplete) {
    const toolMsg = message as ToolStartMessage | ToolCompleteMessage;
    const toolOutput = message.type === 'tool_complete'
      ? (message as ToolCompleteMessage).output || (message as ToolCompleteMessage).error
      : undefined;
    const success = message.type === 'tool_complete'
      ? (message as ToolCompleteMessage).success
      : undefined;

    return (
      <ToolCard
        toolName={toolMsg.toolName}
        toolInput={toolMsg.toolInput}
        toolOutput={toolOutput}
        isComplete={isToolComplete}
        success={success}
      />
    );
  }

  if (isError) {
    const errorMsg = message as ErrorMessage;
    return (
      <Surface
        style={{
          marginVertical: 2,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 4,
          borderLeftWidth: 2,
          borderLeftColor: theme.colors.error,
          maxWidth: '90%',
        }}
        elevation={0}
      >
        <Text variant="bodySmall" style={{ color: theme.colors.error }} selectable>
          {errorMsg.content}
        </Text>
      </Surface>
    );
  }

  if (isUserResponse) {
    const responseMsg = message as UserResponseMessage;
    const isPermission = responseMsg.responseType === 'permission';
    const icon = isPermission ? '✓' : '💬';
    const label = isPermission ? '권한 응답' : '질문 응답';

    return (
      <Surface
        style={{
          marginVertical: 2,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 4,
          borderLeftWidth: 2,
          borderLeftColor: semanticColors.success,
          maxWidth: '90%',
        }}
        elevation={0}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          <Text variant="labelSmall" style={{ color: semanticColors.success, marginRight: 4 }}>
            {icon}
          </Text>
          <Text variant="labelSmall" style={{ opacity: 0.6 }}>
            {label}
          </Text>
        </View>
        <Text variant="bodySmall" selectable>
          {responseMsg.response}
        </Text>
      </Surface>
    );
  }

  if (isUser) {
    const userMsg = message as UserTextMessage;
    return (
      <Surface
        style={{
          marginVertical: 2,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 4,
          borderLeftWidth: 2,
          borderLeftColor: theme.colors.primary,
          backgroundColor: theme.colors.surfaceVariant,
          maxWidth: '90%',
        }}
        elevation={0}
      >
        <UserContent
          content={userMsg.content}
          attachments={userMsg.attachments}
          onImagePress={onImagePress}
        />
      </Surface>
    );
  }

  if (message.role === 'assistant' && message.type === 'text') {
    const assistantMsg = message as AssistantTextMessage;
    return (
      <View style={{ marginVertical: 2, maxWidth: '90%' }}>
        <Text variant="bodySmall" style={{ opacity: 0.85, lineHeight: 20 }} selectable>
          {assistantMsg.content}
        </Text>
      </View>
    );
  }

  return null;
}

interface UserContentProps {
  content: string;
  attachments?: Attachment[];
  onImagePress?: (uri: string) => void;
}

function UserContent({ content, attachments, onImagePress }: UserContentProps) {
  const theme = useTheme();
  const hasAttachments = attachments && attachments.length > 0;
  const hasText = content.trim().length > 0;

  return (
    <View>
      {hasAttachments && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {attachments.map((attachment, index) => {
            const uri = attachment.path || '';
            return (
              <AttachmentImage
                key={index}
                uri={uri}
                filename={attachment.filename}
                onPress={() => onImagePress?.(uri)}
              />
            );
          })}
        </View>
      )}

      {hasAttachments && hasText && <View style={{ height: 4 }} />}

      {hasText && (
        <Text variant="bodySmall" selectable>
          {content}
        </Text>
      )}
    </View>
  );
}

interface AttachmentImageProps {
  uri: string;
  filename?: string;
  onPress?: () => void;
}

function AttachmentImage({ uri, filename, onPress }: AttachmentImageProps) {
  const theme = useTheme();
  const hasUri = uri && uri.length > 0;

  if (!hasUri) {
    return (
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 8,
          backgroundColor: theme.colors.surfaceVariant,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: theme.colors.outline,
        }}
      >
        <Text>📷</Text>
        {filename && (
          <Text variant="labelSmall" style={{ marginTop: 2, opacity: 0.6 }} numberOfLines={1}>
            {filename.slice(0, 8)}
          </Text>
        )}
      </View>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <Image
        source={{ uri }}
        style={{ width: 64, height: 64, borderRadius: 8 }}
        resizeMode="cover"
      />
    </Pressable>
  );
}
