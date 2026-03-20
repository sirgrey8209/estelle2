import { Loader2 } from 'lucide-react';
import { useCurrentConversationState } from '../../stores/conversationStore';

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
  enabled: boolean;
}

export function SuggestionChips({ onSelect, enabled }: SuggestionChipsProps) {
  const state = useCurrentConversationState();
  const suggestions = state?.suggestions;

  if (!enabled) return null;
  if (!suggestions || suggestions.status === 'idle') return null;

  if (suggestions.status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>제안 생성 중...</span>
      </div>
    );
  }

  if (suggestions.status !== 'ready' || suggestions.items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      {suggestions.items.map((item, index) => (
        <button
          key={index}
          onClick={() => onSelect(item)}
          className="text-left text-sm px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors truncate"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
