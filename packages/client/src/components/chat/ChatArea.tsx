import { useCallback, useEffect, useRef } from 'react';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { RequestBar } from '../requests/RequestBar';
import { ChatHeader } from './ChatHeader';
import { useClaudeStore, useWorkspaceStore } from '../../stores';
import { useImageUploadStore } from '../../stores/imageUploadStore';
import { sendClaudeMessage, sendClaudeControl } from '../../services/relaySender';
import { blobService } from '../../services/blobService';
import type { AttachedImage } from '../../stores/imageUploadStore';
import type { UserTextMessage } from '@estelle/core';

/**
 * 채팅 영역
 *
 * 메시지 목록, 입력바, 작업 표시기를 포함합니다.
 */
export function ChatArea() {
  const { status, hasPendingRequests } = useClaudeStore();
  const { selectedConversation, connectedPylons } = useWorkspaceStore();
  const { queueMessage, dequeueMessage, clearAttachedImages } = useImageUploadStore();

  // 업로드 완료 후 메시지 전송을 위한 ref
  const pendingMessageRef = useRef<{
    text: string;
    workspaceId: string;
    conversationId: string;
    pylonPaths: string[];
    attachments: AttachedImage[];
  } | null>(null);

  // blobService 업로드 완료 리스너
  useEffect(() => {
    const unsubscribe = blobService.onUploadComplete((event) => {
      const pending = pendingMessageRef.current;
      if (!pending) return;

      // pylonPath 추가
      pending.pylonPaths.push(event.pylonPath);

      // 모든 업로드 완료 확인
      if (pending.pylonPaths.length >= pending.attachments.length) {
        // 사용자 메시지를 store에 추가 (optimistic update)
        const userMessage: UserTextMessage = {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'user',
          type: 'text',
          content: pending.text,
          timestamp: Date.now(),
          attachments: pending.attachments.map((a, i) => ({
            filename: a.fileName,
            path: pending.pylonPaths[i] || a.uri,
          })),
        };
        useClaudeStore.getState().addMessage(userMessage);

        // Relay로 메시지 전송 (pylonPath 사용)
        sendClaudeMessage(
          pending.workspaceId,
          pending.conversationId,
          pending.text,
          pending.pylonPaths
        );

        // 상태 정리
        pendingMessageRef.current = null;
        clearAttachedImages();
      }
    });

    return unsubscribe;
  }, [clearAttachedImages]);

  // 메시지 전송 핸들러
  const handleSend = useCallback(async (text: string, attachments?: AttachedImage[]) => {
    if (!selectedConversation) return;

    const workspaceId = selectedConversation.workspaceId;
    const conversationId = selectedConversation.conversationId;

    // 첨부파일이 있고 File 객체가 있으면 업로드 플로우 실행
    const attachmentsWithFile = attachments?.filter((a) => a.file);
    if (attachmentsWithFile && attachmentsWithFile.length > 0) {
      // 타겟 Pylon 찾기
      const targetPylon = connectedPylons[0];
      if (!targetPylon) {
        console.error('[ChatArea] No connected Pylon');
        return;
      }

      // 메시지 큐잉 (업로드 완료 후 전송)
      queueMessage(text);

      // pending 상태 설정
      pendingMessageRef.current = {
        text,
        workspaceId,
        conversationId,
        pylonPaths: [],
        attachments: attachmentsWithFile,
      };

      // 각 첨부파일 업로드
      for (const attachment of attachmentsWithFile) {
        if (!attachment.file) continue;

        try {
          const bytes = new Uint8Array(await attachment.file.arrayBuffer());
          await blobService.uploadImageBytes({
            bytes,
            filename: attachment.fileName,
            targetDeviceId: targetPylon.deviceId,
            workspaceId,
            conversationId,
            message: text,
            mimeType: attachment.mimeType,
          });
        } catch (e) {
          console.error('[ChatArea] Upload error:', e);
          // 에러 시 pending 상태 정리
          pendingMessageRef.current = null;
          dequeueMessage();
        }
      }

      return;
    }

    // 첨부파일 없이 메시지만 전송
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
  }, [selectedConversation, connectedPylons, queueMessage, dequeueMessage]);

  // 중지 핸들러
  const handleStop = useCallback(() => {
    if (!selectedConversation) return;

    const conversationId = selectedConversation.conversationId;
    sendClaudeControl(conversationId, 'stop');
  }, [selectedConversation]);

  const isWorking = status === 'working';
  const showRequestBar = hasPendingRequests;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* 채팅 헤더 */}
      <ChatHeader />

      {/* 메시지 목록 (WorkingIndicator 포함) */}
      <MessageList />

      {/* 권한/질문 요청 바 */}
      {showRequestBar ? (
        <RequestBar />
      ) : (
        /* 입력 바 - 권한 요청 중에는 숨김 */
        <InputBar
          disabled={isWorking}
          onSend={handleSend}
          onStop={handleStop}
        />
      )}
    </div>
  );
}
