import type { StoreMessage, Attachment } from '@estelle/core';
import type {
  UserTextMessage,
  AssistantTextMessage,
  ToolStartMessage,
  ToolCompleteMessage,
  ErrorMessage,
  UserResponseMessage,
} from '@estelle/core';
import { ToolCard, type ChildToolInfo, type McpFileInfo } from './ToolCard';
import { cn } from '../../lib/utils';
import { MarkdownContent } from '../../lib/markdown';

interface MessageBubbleProps {
  message: StoreMessage;
  onImagePress?: (uri: string) => void;
  /** Task 툴의 하위 툴들 */
  childTools?: ChildToolInfo[];
  /** MCP 파일 클릭 핸들러 */
  onMcpFileClick?: (fileInfo: McpFileInfo) => void;
  /** Widget 세션 (run_widget 도구용) */
  widgetSession?: {
    toolUseId: string;
    sessionId: string;
    view: import('@estelle/core').ViewNode | null;
    status: 'pending' | 'running' | 'claimed';
  } | null;
  /** Widget v2 이벤트 핸들러 (ScriptViewNode용) */
  onWidgetEvent?: (data: unknown) => void;
  /** Widget v2 취소 핸들러 (ScriptViewNode용) */
  onWidgetCancel?: () => void;
  /** Widget claim 핸들러 (pending 상태에서 시작 버튼 클릭) */
  onWidgetClaim?: () => void;
  /** Widget v2 에셋 URL 맵 (ScriptViewNode용) */
  widgetAssets?: Record<string, string>;
  /** 파일 경로 클릭 핸들러 */
  onFilePathClick?: (path: string) => void;
}

/**
 * 메시지 버블 (컴팩트)
 */
export function MessageBubble({
  message,
  onImagePress,
  childTools,
  onMcpFileClick,
  widgetSession,
  onWidgetEvent,
  onWidgetCancel,
  onWidgetClaim,
  widgetAssets,
  onFilePathClick,
}: MessageBubbleProps) {
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
    const elapsedSeconds = message.type === 'tool_start'
      ? (message as ToolStartMessage).elapsedSeconds
      : undefined;
    const parentToolUseId = toolMsg.parentToolUseId;

    return (
      <div className={cn(parentToolUseId && 'ml-4')}>
        <ToolCard
          toolName={toolMsg.toolName}
          toolInput={toolMsg.toolInput}
          toolOutput={toolOutput}
          isComplete={isToolComplete}
          success={success}
          elapsedSeconds={elapsedSeconds}
          childTools={toolMsg.toolName === 'Task' ? childTools : undefined}
          onMcpFileClick={onMcpFileClick}
          onFilePathClick={onFilePathClick}
          toolUseId={toolMsg.id}
          widgetSession={widgetSession}
          onWidgetEvent={onWidgetEvent}
          onWidgetCancel={onWidgetCancel}
          onWidgetClaim={onWidgetClaim}
          widgetAssets={widgetAssets}
        />
      </div>
    );
  }

  if (isError) {
    const errorMsg = message as ErrorMessage;
    return (
      <div
        className="my-0.5 ml-2 pl-1.5 pr-2 py-1 rounded border-l-2 border-destructive bg-card max-w-[90%]"
      >
        <p className="text-sm text-destructive select-text">
          {errorMsg.content}
        </p>
      </div>
    );
  }

  if (isUserResponse) {
    const responseMsg = message as UserResponseMessage;
    const isPermission = responseMsg.responseType === 'permission';
    const icon = isPermission ? '✓' : '💬';
    const label = isPermission ? '권한 응답' : '질문 응답';

    return (
      <div
        className="my-0.5 ml-2 pl-1.5 pr-2 py-1 rounded border-l-2 border-green-500 bg-card max-w-[90%]"
      >
        <div className="flex items-center mb-0.5">
          <span className="text-xs text-green-500 mr-1">{icon}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-sm select-text">
          {responseMsg.response}
        </p>
      </div>
    );
  }

  if (isUser) {
    const userMsg = message as UserTextMessage;
    return (
      <div
        className="my-0.5 ml-2 pl-1.5 pr-2 py-1 rounded border-l-2 border-primary bg-muted max-w-[90%] w-fit"
      >
        <UserContent
          content={userMsg.content}
          attachments={userMsg.attachments}
          onImagePress={onImagePress}
        />
      </div>
    );
  }

  if (message.role === 'assistant' && message.type === 'text') {
    const assistantMsg = message as AssistantTextMessage;
    return (
      <div
        className="my-0.5 ml-2 pl-1.5 pr-2 border-l-2 border-transparent max-w-[90%]"
      >
        <MarkdownContent content={assistantMsg.content} />
      </div>
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
  const hasAttachments = attachments && attachments.length > 0;
  const hasText = content.trim().length > 0;

  return (
    <div>
      {hasAttachments && (
        <div className="flex flex-wrap gap-1">
          {attachments.map((attachment, index) => {
            const uri = attachment.path || '';
            return (
              <AttachmentImage
                key={index}
                uri={uri}
                filename={attachment.filename}
                thumbnail={attachment.thumbnail}
                onPress={() => onImagePress?.(uri)}
              />
            );
          })}
        </div>
      )}

      {hasAttachments && hasText && <div className="h-1" />}

      {hasText && (
        <p className="text-sm select-text whitespace-pre-wrap break-words">
          {content}
        </p>
      )}
    </div>
  );
}

interface AttachmentImageProps {
  uri: string;
  filename?: string;
  thumbnail?: string;
  onPress?: () => void;
}

function AttachmentImage({ uri, filename, thumbnail, onPress }: AttachmentImageProps) {
  // 썸네일이 있으면 사용, 없으면 파일 아이콘 표시
  const hasThumbnail = thumbnail && thumbnail.length > 0;

  if (!hasThumbnail) {
    // 비이미지 파일 또는 썸네일 없음 - 파일 아이콘 + 파일명
    return (
      <div
        className="w-16 h-16 rounded-lg bg-muted flex flex-col items-center justify-center border border-border cursor-pointer"
        onClick={onPress}
      >
        <span className="text-2xl">📄</span>
        {filename && (
          <span className="mt-0.5 text-xs text-muted-foreground truncate max-w-full px-1">
            {filename.length > 10 ? filename.slice(0, 8) + '...' : filename}
          </span>
        )}
      </div>
    );
  }

  return (
    <button onClick={onPress} className="focus:outline-none">
      <img
        src={thumbnail}
        alt={filename || 'attachment'}
        className="w-16 h-16 rounded-lg object-cover"
      />
    </button>
  );
}
