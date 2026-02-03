import React from 'react';
import { View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';
import type { Conversation } from '@estelle/core';
import { StatusDot } from '../common/StatusDot';

interface ConversationItemProps {
  workspaceName: string;
  workingDir: string;
  conversation: Conversation;
  isSelected: boolean;
  showWorkspaceName?: boolean;
  onPress: () => void;
}

/**
 * 대화 아이템 (컴팩트)
 */
export function ConversationItem({
  workspaceName,
  workingDir,
  conversation,
  isSelected,
  showWorkspaceName = true,
  onPress,
}: ConversationItemProps) {
  const theme = useTheme();

  return (
    <List.Item
      title={showWorkspaceName ? workspaceName : conversation.name}
      onPress={onPress}
      right={() => (
        <View style={{ justifyContent: 'center', paddingRight: 8 }}>
          <StatusDot status={conversation.status} />
        </View>
      )}
      style={{
        backgroundColor: isSelected
          ? theme.colors.primaryContainer
          : 'transparent',
        paddingVertical: 0,
        minHeight: 32,
        marginHorizontal: 4,
        marginVertical: 1,
        borderRadius: 8,
        paddingLeft: 12,
      }}
      titleStyle={{
        fontSize: 13,
        color: isSelected
          ? theme.colors.onPrimaryContainer
          : theme.colors.onSurface,
      }}
    />
  );
}
