import React, { useCallback } from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { RequestBar } from '../requests/RequestBar';
import { ChatHeader } from './ChatHeader';
import { useClaudeStore, useWorkspaceStore } from '../../stores';
import { useResponsive } from '../../hooks/useResponsive';
import { sendClaudeMessage, sendClaudeControl } from '../../services/relaySender';
import type { AttachedImage } from '../../stores/imageUploadStore';
import type { UserTextMessage } from '@estelle/core';

/**
 * 채팅 영역
 *
 * 메시지 목록, 입력바, 작업 표시기를 포함합니다.
 */
export function ChatArea() {
  const theme = useTheme();
  const { status, hasPendingRequests } = useClaudeStore();
  const { selectedConversation } = useWorkspaceStore();
  const { isDesktop } = useResponsive();

  // 메시지 전송 핸들러
  const handleSend = useCallback((text: string, attachments?: AttachedImage[]) => {
    if (!selectedConversation) return;

    const workspaceId = selectedConversation.workspaceId;
    const conversationId = selectedConversation.conversationId;

    // 사용자 메시지를 store에 직접 추가 (optimistic update)
    const userMessage: UserTextMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      type: 'text',
      content: text,
      timestamp: Date.now(),
      attachments: attachments?.map((a) => ({
        filename: a.fileName,
        path: a.uri,
      })),
    };
    useClaudeStore.getState().addMessage(userMessage);

    // Relay로 메시지 전송
    sendClaudeMessage(workspaceId, conversationId, text, attachments?.map(a => a.uri));
  }, [selectedConversation]);

  // 중지 핸들러
  const handleStop = useCallback(() => {
    if (!selectedConversation) return;

    const conversationId = selectedConversation.conversationId;
    sendClaudeControl(conversationId, 'stop');
  }, [selectedConversation]);

  const isWorking = status === 'working';
  const showRequestBar = hasPendingRequests;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* 채팅 헤더 */}
      <ChatHeader />

      {/* 메시지 목록 (WorkingIndicator 포함) */}
      <MessageList />

      {/* 권한/질문 요청 바 */}
      {showRequestBar && <RequestBar />}

      {/* 입력 바 */}
      <InputBar
        disabled={isWorking || showRequestBar}
        onSend={handleSend}
        onStop={handleStop}
      />
    </KeyboardAvoidingView>
  );
}
