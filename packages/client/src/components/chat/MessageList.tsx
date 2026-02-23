import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useUploadStore, useWorkspaceStore, useCurrentConversationState } from '../../stores';
import { MessageBubble } from './MessageBubble';
import { StreamingBubble } from './StreamingBubble';
import { UploadingBubble } from './UploadingBubble';
import { ResultInfo } from './ResultInfo';
import { ClaudeAbortedDivider } from './SystemDivider';
import { FileAttachmentCard } from './FileAttachmentCard';
import { WorkingIndicator } from './WorkingIndicator';
import { FileViewer } from '../viewers';
import { blobService } from '../../services/blobService';
import type { StoreMessage, ResultMessage, AbortedMessage, FileAttachmentMessage, ToolStartMessage, ToolCompleteMessage, Attachment } from '@estelle/core';
import type { ChildToolInfo, McpFileInfo } from './ToolCard';

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
  // conversationStore에서 현재 대화의 상태 가져오기
  const currentState = useCurrentConversationState();
  const messages = currentState?.messages ?? [];
  const textBuffer = currentState?.textBuffer ?? '';
  const workStartTime = currentState?.workStartTime ?? null;
  const status = currentState?.status ?? 'idle';

  const { uploads } = useUploadStore();
  const { selectedConversation } = useWorkspaceStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // FileViewer 상태
  const [viewerFile, setViewerFile] = useState<{
    filename: string;
    size: number;
    mimeType?: string;
    description?: string;
    content: string | null;
  } | null>(null);

  const uploadingItems = Object.values(uploads).filter(
    (u) => u.status === 'uploading'
  );

  // 하위 툴 매핑: parentToolUseId → ChildToolInfo[]
  const { childToolsMap, parentToolIds } = useMemo(() => {
    const map = new Map<string, ChildToolInfo[]>();
    const parentIds = new Set<string>();

    messages.forEach((msg) => {
      if (msg.type === 'tool_start' || msg.type === 'tool_complete') {
        const toolMsg = msg as ToolStartMessage | ToolCompleteMessage;
        const parentId = toolMsg.parentToolUseId;

        if (parentId) {
          parentIds.add(msg.id);

          const childInfo: ChildToolInfo = {
            id: msg.id,
            toolName: toolMsg.toolName,
            toolInput: toolMsg.toolInput,
            toolOutput: msg.type === 'tool_complete'
              ? (msg as ToolCompleteMessage).output || (msg as ToolCompleteMessage).error
              : undefined,
            isComplete: msg.type === 'tool_complete',
            success: msg.type === 'tool_complete' ? (msg as ToolCompleteMessage).success : undefined,
            timestamp: msg.timestamp,
          };

          const existing = map.get(parentId) || [];
          // 같은 id의 메시지가 있으면 업데이트 (tool_start → tool_complete)
          const existingIdx = existing.findIndex(e => e.id === childInfo.id);
          if (existingIdx >= 0) {
            existing[existingIdx] = childInfo;
          } else {
            existing.push(childInfo);
          }
          map.set(parentId, existing);
        }
      }
    });

    return { childToolsMap: map, parentToolIds: parentIds };
  }, [messages]);

  // 첨부파일 클릭 → 다운로드 → FileViewer 열기
  const handleAttachmentPress = useCallback((attachment: Attachment) => {
    const { filename, path: filePath } = attachment;
    const pylonId = selectedConversation?.pylonId;
    const conversationId = selectedConversation?.conversationId;
    if (!pylonId || !conversationId) return;

    // 캐시에 있으면 바로 표시
    const cached = blobService.getCachedImage(filename);
    if (cached) {
      openFileViewer(filename, cached, attachment);
      return;
    }

    // 뷰어를 먼저 열고 로딩 표시
    setViewerFile({
      filename,
      size: 0,
      mimeType: attachment.thumbnail ? 'image/' : undefined,
      description: (attachment as { description?: string }).description,
      content: null,
    });

    // 다운로드 요청
    const unsubscribe = blobService.onDownloadComplete((event) => {
      if (event.filename === filename) {
        unsubscribe();
        openFileViewer(filename, event.bytes, attachment);
      }
    });

    blobService.requestFile({
      targetDeviceId: pylonId,
      conversationId,
      filename,
      filePath,
    });
  }, [selectedConversation]);

  const openFileViewer = useCallback((filename: string, bytes: Uint8Array, attachment: Attachment & { description?: string }) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const isImage = /^(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(ext);
    const isText = /^(txt|md|markdown|json|js|ts|tsx|jsx|css|html|xml|yaml|yml|toml|ini|cfg|log|csv|sh|bat|ps1|py|rb|go|rs|java|c|cpp|h|hpp)$/.test(ext);

    let content: string;
    if (isImage) {
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
      };
      const mime = mimeMap[ext] || 'image/png';
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      content = `data:${mime};base64,${btoa(binary)}`;
    } else if (isText) {
      content = new TextDecoder('utf-8').decode(bytes);
    } else {
      content = `바이너리 파일 (${bytes.length} bytes)`;
    }

    setViewerFile({
      filename,
      size: bytes.length,
      mimeType: attachment.thumbnail ? 'image/' + ext : undefined,
      description: attachment.description,
      content,
    });
  }, []);

  // MCP send_file 파일 클릭 → 다운로드 → FileViewer 열기
  const handleMcpFileClick = useCallback((fileInfo: McpFileInfo) => {
    const pylonId = selectedConversation?.pylonId;
    const conversationId = selectedConversation?.conversationId;
    if (!pylonId || !conversationId) return;

    const { filename, path: filePath, mimeType, size, description } = fileInfo;

    // 캐시에 있으면 바로 표시
    const cached = blobService.getCachedImage(filename);
    if (cached) {
      openFileViewer(filename, cached, { filename, path: filePath, description: description ?? undefined });
      return;
    }

    // 뷰어를 먼저 열고 로딩 표시
    setViewerFile({
      filename,
      size,
      mimeType,
      description: description ?? undefined,
      content: null,
    });

    // 다운로드 요청
    const unsubscribe = blobService.onDownloadComplete((event) => {
      if (event.filename === filename) {
        unsubscribe();
        openFileViewer(filename, event.bytes, { filename, path: filePath, description: description ?? undefined });
      }
    });

    console.log('[MCP File Click] Requesting file download:', { pylonId, conversationId, filename, filePath });
    blobService.requestFile({
      targetDeviceId: pylonId,
      conversationId,
      filename,
      filePath,
    });
  }, [selectedConversation, openFileViewer]);

  const buildDisplayItems = useCallback(() => {
    const items: Array<{ type: string; data: unknown; key: string }> = [];

    // 가장 위 (최신)
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

    // 메시지는 역순 (최신이 위)
    // parentToolUseId가 있는 메시지는 Task 카드 내부에서 렌더링되므로 제외
    const reversedMessages = [...messages].reverse();
    reversedMessages.forEach((msg, index) => {
      // 하위 툴 메시지는 건너뛰기
      if (parentToolIds.has(msg.id)) {
        return;
      }

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
  }, [messages, textBuffer, workStartTime, uploadingItems, isLoadingHistory, hasMoreHistory, parentToolIds]);

  const displayItems = buildDisplayItems();

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // flex-col-reverse를 사용하므로 스크롤 로직이 반전됨
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollTop < -100;

    // 더 많은 히스토리 로드
    const distanceFromTop = scrollHeight + scrollTop - clientHeight;
    if (distanceFromTop < 100 && hasMoreHistory && !isLoadingHistory) {
      onLoadMoreHistory?.();
    }

    setShowScrollButton(scrollTop < -200);
  }, [hasMoreHistory, isLoadingHistory, onLoadMoreHistory]);

  const scrollToBottom = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!showScrollButton && messages.length > 0) {
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length, textBuffer, showScrollButton]);

  const renderItem = (item: { type: string; data: unknown; key: string }) => {
    switch (item.type) {
      case 'working':
        return (
          <div key={item.key} className="mb-1">
            <WorkingIndicator startTime={item.data as number} />
          </div>
        );

      case 'streaming':
        return (
          <div key={item.key} className="mb-1">
            <StreamingBubble text={item.data as string} />
          </div>
        );

      case 'uploading':
        const upload = item.data as { blobId: string };
        return (
          <div key={item.key} className="mb-1">
            <UploadingBubble blobId={upload.blobId} />
          </div>
        );

      case 'message':
        const message = item.data as StoreMessage;
        return (
          <div key={item.key} className="mb-1">
            {renderMessage(message)}
          </div>
        );

      case 'loading':
        const loading = item.data as boolean;
        return (
          <div key={item.key} className="py-3 flex justify-center">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <span className="text-xs text-muted-foreground">
                스크롤하여 이전 메시지 로드
              </span>
            )}
          </div>
        );

      default:
        return null;
    }
  };

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
        const fileAsAttachment = {
          filename: fileMsg.file.filename,
          path: fileMsg.file.path,
          description: fileMsg.file.description,
        };
        return (
          <FileAttachmentCard
            file={fileMsg.file}
            onDownload={() => handleAttachmentPress(fileAsAttachment)}
            onOpen={() => handleAttachmentPress(fileAsAttachment)}
          />
        );
      }

      default: {
        // Task 메시지인 경우 하위 툴 정보 전달
        const childTools = (message.type === 'tool_start' || message.type === 'tool_complete')
          ? childToolsMap.get(message.id)
          : undefined;
        // 사용자 메시지의 첨부파일에서 attachment 정보를 전달
        const userMsg = message as { attachments?: Attachment[] };
        return (
          <MessageBubble
            message={message}
            childTools={childTools}
            onImagePress={(uri) => {
              // uri = attachment.path, 해당 attachment 찾기
              const att = userMsg.attachments?.find(a => a.path === uri);
              if (att) handleAttachmentPress(att);
            }}
            onMcpFileClick={handleMcpFileClick}
          />
        );
      }
    }
  };

  if (displayItems.length === 0) {
    if (status === 'working') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="mt-4 text-muted-foreground">
            대화를 시작하는 중...
          </span>
        </div>
      );
    }

    if (isLoadingHistory) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="mt-4 text-muted-foreground">
            대화 내역을 불러오는 중...
          </span>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <span className="text-lg text-muted-foreground">세션이 없습니다.</span>
        <span className="mt-2 text-sm text-muted-foreground">
          메시지를 입력하시면 자동으로 새 세션이 시작됩니다.
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 relative bg-background overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto flex flex-col-reverse p-4"
        onScroll={handleScroll}
      >
        {displayItems.map(renderItem)}
      </div>

      {showScrollButton && (
        <Button
          variant="secondary"
          size="icon"
          onClick={scrollToBottom}
          className="absolute right-4 bottom-4 rounded-full shadow-lg"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}

      {viewerFile && (
        <FileViewer
          open={true}
          onClose={() => setViewerFile(null)}
          file={viewerFile}
          content={viewerFile.content}
        />
      )}
    </div>
  );
}
