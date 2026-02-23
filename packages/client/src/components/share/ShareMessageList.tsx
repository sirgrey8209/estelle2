/**
 * @file ShareMessageList.tsx
 * @description 공유 페이지용 메시지 목록 - 읽기 전용
 *
 * shareStore의 메시지를 표시합니다.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useShareStore } from '../../stores';
import { MessageBubble } from '../chat/MessageBubble';
import { StreamingBubble } from '../chat/StreamingBubble';
import { ResultInfo } from '../chat/ResultInfo';
import { ClaudeAbortedDivider } from '../chat/SystemDivider';
import { FileAttachmentCard } from '../chat/FileAttachmentCard';
import type {
  StoreMessage,
  ResultMessage,
  AbortedMessage,
  FileAttachmentMessage,
  ToolStartMessage,
  ToolCompleteMessage,
} from '@estelle/core';
import type { ChildToolInfo } from '../chat/ToolCard';

/**
 * 공유 메시지 목록 컴포넌트
 *
 * shareStore의 메시지를 읽기 전용으로 표시합니다.
 */
export function ShareMessageList() {
  const messages = useShareStore((s) => s.messages);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // 하위 툴 매핑: parentToolUseId -> ChildToolInfo[]
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
            toolOutput:
              msg.type === 'tool_complete'
                ? (msg as ToolCompleteMessage).output ||
                  (msg as ToolCompleteMessage).error
                : undefined,
            isComplete: msg.type === 'tool_complete',
            success:
              msg.type === 'tool_complete'
                ? (msg as ToolCompleteMessage).success
                : undefined,
            timestamp: msg.timestamp,
          };

          const existing = map.get(parentId) || [];
          const existingIdx = existing.findIndex((e) => e.id === childInfo.id);
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

    // 공유 페이지: 시간순 (오래된 것부터) - reverse 없이 원본 순서 유지
    messages.forEach((msg, index) => {
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

    return items;
  }, [messages, parentToolIds]);

  const displayItems = buildDisplayItems();

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 일반 flex-col에서는 scrollTop이 양수
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight > 200;
    setShowScrollButton(isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  const renderItem = (item: { type: string; data: unknown; key: string }) => {
    if (item.type === 'message') {
      const message = item.data as StoreMessage;
      return (
        <div key={item.key} className="mb-1">
          {renderMessage(message)}
        </div>
      );
    }
    return null;
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
            onDownload={() => {}}
            onOpen={() => {}}
          />
        );
      }

      default: {
        const childTools =
          message.type === 'tool_start' || message.type === 'tool_complete'
            ? childToolsMap.get(message.id)
            : undefined;

        return (
          <MessageBubble
            message={message}
            childTools={childTools}
            onImagePress={() => {}}
            onMcpFileClick={() => {}}
          />
        );
      }
    }
  };

  if (displayItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <span className="text-muted-foreground">메시지를 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="h-full relative overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto flex flex-col p-4"
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
