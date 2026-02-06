import type { StoreMessage, Attachment } from '../../stores/claudeStore';
import type {
  UserTextMessage,
  AssistantTextMessage,
  ToolStartMessage,
  ToolCompleteMessage,
  ErrorMessage,
  UserResponseMessage,
} from '@estelle/core';
import { ToolCard, type ChildToolInfo } from './ToolCard';
import { cn } from '../../lib/utils';

interface MessageBubbleProps {
  message: StoreMessage;
  onImagePress?: (uri: string) => void;
  /** Task 툴의 하위 툴들 */
  childTools?: ChildToolInfo[];
}

/**
 * 메시지 버블 (컴팩트)
 */
export function MessageBubble({ message, onImagePress, childTools }: MessageBubbleProps) {
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
        <p className="text-destructive select-text">
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
        <p className="select-text">
          {responseMsg.response}
        </p>
      </div>
    );
  }

  if (isUser) {
    const userMsg = message as UserTextMessage;
    return (
      <div
        className="my-0.5 ml-2 pl-1.5 pr-2 py-1 rounded border-l-2 border-primary bg-muted max-w-[90%] self-start"
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
        <p className="opacity-85 leading-relaxed select-text whitespace-pre-wrap">
          {assistantMsg.content}
        </p>
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
                onPress={() => onImagePress?.(uri)}
              />
            );
          })}
        </div>
      )}

      {hasAttachments && hasText && <div className="h-1" />}

      {hasText && (
        <p className="select-text whitespace-pre-wrap">
          {content}
        </p>
      )}
    </div>
  );
}

interface AttachmentImageProps {
  uri: string;
  filename?: string;
  onPress?: () => void;
}

function AttachmentImage({ uri, filename, onPress }: AttachmentImageProps) {
  const hasUri = uri && uri.length > 0;

  if (!hasUri) {
    return (
      <div
        className="w-16 h-16 rounded-lg bg-muted flex flex-col items-center justify-center border border-border"
      >
        <span>📷</span>
        {filename && (
          <span className="mt-0.5 text-xs text-muted-foreground truncate max-w-full px-1">
            {filename.slice(0, 8)}
          </span>
        )}
      </div>
    );
  }

  return (
    <button onClick={onPress} className="focus:outline-none">
      <img
        src={uri}
        alt={filename || 'attachment'}
        className="w-16 h-16 rounded-lg object-cover"
      />
    </button>
  );
}
