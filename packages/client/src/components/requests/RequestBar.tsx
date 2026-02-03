import React from 'react';
import { View } from 'react-native';
import { Divider, useTheme } from 'react-native-paper';
import { useClaudeStore } from '../../stores';
import { PermissionRequest } from './PermissionRequest';
import { QuestionRequest } from './QuestionRequest';

/**
 * 요청 바
 */
export function RequestBar() {
  const theme = useTheme();
  const { pendingRequests } = useClaudeStore();

  if (pendingRequests.length === 0) return null;

  const currentRequest = pendingRequests[0];

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.outlineVariant }}>
      {currentRequest.type === 'permission' ? (
        <PermissionRequest request={currentRequest} />
      ) : (
        <QuestionRequest request={currentRequest} />
      )}
    </View>
  );
}
