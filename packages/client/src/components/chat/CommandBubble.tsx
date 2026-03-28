import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface CommandBubbleProps {
  commandName: string;
  commandIcon: string | null;
  commandColor: string | null;
  content: string;
}

function isEmoji(str: string): boolean {
  return /^\p{Emoji_Presentation}/u.test(str);
}

function BubbleIcon({ icon, color }: { icon: string | null; color: string | null }) {
  if (!icon) return null;
  if (isEmoji(icon)) return <span className="text-sm leading-none">{icon}</span>;

  const pascalCase = icon.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  const LucideIcon = (LucideIcons as Record<string, unknown>)[pascalCase] as LucideIcons.LucideIcon | undefined;
  if (LucideIcon) return <LucideIcon className="h-3.5 w-3.5" style={color ? { color } : undefined} />;
  return <span className="text-xs">{icon}</span>;
}

export function CommandBubble({ commandName, commandIcon, commandColor, content }: CommandBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
      >
        <BubbleIcon icon={commandIcon} color={commandColor} />
        <span className="font-medium">{commandName}</span>
        <span className="text-muted-foreground">실행</span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="mt-1 px-3 py-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}
