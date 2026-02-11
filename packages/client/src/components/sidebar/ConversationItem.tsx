import type { Conversation } from '@estelle/core';
import { cn } from '../../lib/utils';
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
 * status와 unread를 조합하여 StatusDot에 전달할 상태 결정
 * - working/waiting/error: 해당 상태 그대로
 * - idle + unread: 'unread' (초록색)
 * - idle + !unread: 'idle' (회색)
 */
function getDisplayStatus(
  status: Conversation['status'],
  unread: boolean
): 'idle' | 'working' | 'waiting' | 'error' | 'unread' {
  if (status !== 'idle') {
    return status;
  }
  return unread ? 'unread' : 'idle';
}

/**
 * 대화 아이템 (컴팩트)
 */
export function ConversationItem({
  workspaceName,
  conversation,
  isSelected,
  showWorkspaceName = true,
  onPress,
}: ConversationItemProps) {
  const dotStatus = getDisplayStatus(conversation.status, conversation.unread);

  return (
    <button
      onClick={onPress}
      className={cn(
        'flex items-center justify-between w-full px-3 py-1.5 mx-1 rounded-lg text-left transition-colors',
        isSelected
          ? 'bg-primary/20 text-gray-900'
          : 'hover:bg-accent/50'
      )}
    >
      <span className={cn('text-sm truncate', isSelected && 'font-medium')}>
        {showWorkspaceName ? workspaceName : conversation.name}
      </span>
      <StatusDot status={dotStatus} size="sm" />
    </button>
  );
}
