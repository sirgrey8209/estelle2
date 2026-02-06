import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useClaudeStore, useUploadStore } from '../../stores';
import { MessageBubble } from './MessageBubble';
import { StreamingBubble } from './StreamingBubble';
import { UploadingBubble } from './UploadingBubble';
import { ResultInfo } from './ResultInfo';
import { ClaudeAbortedDivider } from './SystemDivider';
import { FileAttachmentCard } from './FileAttachmentCard';
import { WorkingIndicator } from './WorkingIndicator';
import type { StoreMessage } from '../../stores/claudeStore';
import type { ResultMessage, AbortedMessage, FileAttachmentMessage, ToolStartMessage, ToolCompleteMessage } from '@estelle/core';
import type { ChildToolInfo } from './ToolCard';

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
  const { messages, textBuffer, workStartTime, status } = useClaudeStore();
  const { uploads } = useUploadStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

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

      default: {
        // Task 메시지인 경우 하위 툴 정보 전달
        const childTools = (message.type === 'tool_start' || message.type === 'tool_complete')
          ? childToolsMap.get(message.id)
          : undefined;
        return <MessageBubble message={message} childTools={childTools} />;
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
    </div>
  );
}
