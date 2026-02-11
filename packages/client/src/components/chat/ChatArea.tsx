import { useCallback, useEffect, useRef } from 'react';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { RequestBar } from '../requests/RequestBar';
import { ChatHeader } from './ChatHeader';
import { useWorkspaceStore, useUploadStore, useConversationStore, useCurrentConversationState, useSyncStore } from '../../stores';
import { useImageUploadStore } from '../../stores/imageUploadStore';
import { sendClaudeMessage, sendClaudeControl, requestMoreHistory } from '../../services/relaySender';
import { blobService } from '../../services/blobService';
import type { AttachedImage } from '../../stores/imageUploadStore';
import type { UserTextMessage } from '@estelle/core';

/**
 * 채팅 영역
 *
 * 메시지 목록, 입력바, 작업 표시기를 포함합니다.
 */
export function ChatArea() {
  // conversationStore에서 현재 대화의 상태 가져오기
  const currentEntityId = useConversationStore((s) => s.currentEntityId);
  const currentState = useCurrentConversationState();
  const status = currentState?.status ?? 'idle';
  const hasPendingRequests = (currentState?.pendingRequests?.length ?? 0) > 0;

  const { selectedConversation, connectedPylons } = useWorkspaceStore();
  const { queueMessage, dequeueMessage, clearAttachedImages } = useImageUploadStore();
  const { startUpload, updateProgress, completeUpload, failUpload } = useUploadStore();

  // 업로드 완료 후 메시지 전송을 위한 ref
  const pendingMessageRef = useRef<{
    text: string;
    entityId: number;
    workspaceId: string;
    pylonPaths: string[];
    thumbnails: (string | undefined)[];
    attachments: AttachedImage[];
  } | null>(null);

  // blobService 진행률 리스너
  useEffect(() => {
    const unsubscribe = blobService.onProgress((blobId, processed, total) => {
      // 업로드만 처리 (다운로드는 무시)
      const transfer = blobService.getTransfer(blobId);
      if (!transfer || !transfer.isUpload) return;

      // 첫 번째 진행률 이벤트에서 upload 시작 처리
      const { uploads } = useUploadStore.getState();
      if (!uploads[blobId]) {
        startUpload({
          blobId,
          filename: transfer.filename ?? 'unknown',
          totalChunks: total,
        });
      }
      updateProgress(blobId, processed);
    });
    return unsubscribe;
  }, [startUpload, updateProgress]);

  // blobService 업로드 완료 리스너
  useEffect(() => {
    const unsubscribe = blobService.onUploadComplete((event) => {
      // uploadStore 상태 업데이트
      completeUpload(event.blobId, event.pylonPath);

      const pending = pendingMessageRef.current;
      if (!pending) return;

      // pylonPath 및 thumbnail 추가
      pending.pylonPaths.push(event.pylonPath);
      pending.thumbnails.push(event.thumbnailBase64);

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
            thumbnail: pending.thumbnails[i],
          })),
        };
        // conversationStore에 메시지 추가
        if (pending.entityId) {
          useConversationStore.getState().addMessage(pending.entityId, userMessage);
        }

        // Relay로 메시지 전송 (entityId + pylonPath 사용)
        sendClaudeMessage(
          pending.entityId,
          pending.text,
          pending.pylonPaths
        );

        // 상태 정리
        pendingMessageRef.current = null;
        clearAttachedImages();
      }
    });

    return unsubscribe;
  }, [clearAttachedImages, completeUpload]);

  // 메시지 전송 핸들러
  const handleSend = useCallback(async (text: string, attachments?: AttachedImage[]) => {
    if (!selectedConversation) return;

    const entityId = selectedConversation.entityId;
    const workspaceId = selectedConversation.workspaceId;

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
        entityId,
        workspaceId,
        pylonPaths: [],
        thumbnails: [],
        attachments: attachmentsWithFile,
      };

      // 각 첨부파일 업로드 (startUpload는 onProgress 콜백에서 자동 호출됨)
      for (const attachment of attachmentsWithFile) {
        if (!attachment.file) continue;

        try {
          const bytes = new Uint8Array(await attachment.file.arrayBuffer());
          await blobService.uploadImageBytes({
            bytes,
            filename: attachment.fileName,
            targetDeviceId: targetPylon.deviceId,
            workspaceId,
            entityId,
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
    // conversationStore에 메시지 추가
    useConversationStore.getState().addMessage(entityId, userMessage);

    // Relay로 메시지 전송
    sendClaudeMessage(entityId, text, attachments?.map(a => a.uri));
  }, [selectedConversation, connectedPylons, queueMessage, dequeueMessage]);

  // 중지 핸들러
  const handleStop = useCallback(() => {
    if (!selectedConversation) return;

    sendClaudeControl(selectedConversation.entityId, 'stop');
  }, [selectedConversation]);

  const isWorking = status === 'working';
  const showRequestBar = hasPendingRequests;

  // 페이징 상태 (syncStore에서 가져옴)
  const syncInfo = useSyncStore((s) => currentEntityId ? s.getConversationSync(currentEntityId) : null);
  const hasMoreBefore = useSyncStore((s) => currentEntityId ? s.hasMoreBefore(currentEntityId) : false);
  const isLoadingMore = useSyncStore((s) => currentEntityId ? s.isLoadingMore(currentEntityId) : false);

  // 추가 히스토리 로드 핸들러
  const handleLoadMoreHistory = useCallback(() => {
    if (!selectedConversation || isLoadingMore || !hasMoreBefore) return;

    const entityId = selectedConversation.entityId;

    // 로딩 상태 설정
    useSyncStore.getState().setLoadingMore(entityId, true);

    // loadBefore = syncedFrom (이 인덱스 이전의 메시지를 로드)
    const currentSyncInfo = useSyncStore.getState().getConversationSync(entityId);
    const loadBefore = currentSyncInfo?.syncedFrom ?? 0;
    requestMoreHistory(entityId, loadBefore);
  }, [selectedConversation, isLoadingMore, hasMoreBefore]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* 채팅 헤더 */}
      <ChatHeader />

      {/* 메시지 목록 (WorkingIndicator 포함) */}
      <MessageList
        hasMoreHistory={hasMoreBefore}
        isLoadingHistory={isLoadingMore}
        onLoadMoreHistory={handleLoadMoreHistory}
      />

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
