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
 * 대화 아이템 (컴팩트)
 */
export function ConversationItem({
  workspaceName,
  conversation,
  isSelected,
  showWorkspaceName = true,
  onPress,
}: ConversationItemProps) {
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
      <StatusDot status={conversation.status} size="sm" />
    </button>
  );
}
