import { useCallback, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { Plus } from 'lucide-react';
import { useCommandStore } from '../../stores/commandStore';
import { executeCommand, commandManageConversation } from '../../services/relaySender';

interface CommandToolbarProps {
  conversationId: number | null;
  workspaceId: number | null;
}

/**
 * Lucide 아이콘 이름(kebab-case)을 PascalCase로 변환하여 컴포넌트 가져오기
 */
function getLucideIcon(name: string): LucideIcons.LucideIcon | null {
  const pascalCase = name
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  return (
    ((LucideIcons as Record<string, unknown>)[pascalCase] as LucideIcons.LucideIcon | undefined) ??
    null
  );
}

/**
 * 문자열이 이모지로 시작하는지 판별
 */
function isEmoji(str: string): boolean {
  return /^\p{Emoji_Presentation}/u.test(str);
}

/**
 * 커맨드 아이콘 렌더링
 */
function CommandIcon({ icon, color }: { icon: string | null; color: string | null }) {
  if (!icon) return null;

  if (isEmoji(icon)) {
    return <span className="text-sm leading-none">{icon}</span>;
  }

  const LucideIcon = getLucideIcon(icon);
  if (LucideIcon) {
    return <LucideIcon className="h-3.5 w-3.5" style={color ? { color } : undefined} />;
  }

  // 아이콘을 찾지 못하면 텍스트로 표시
  return <span className="text-xs leading-none">{icon}</span>;
}

/**
 * 커맨드 툴바
 * - 커맨드 버튼 목록 (가로 스크롤)
 * - + 버튼 → 새 커맨드 생성 대화
 * - 롱프레스 → 커맨드 편집 대화
 */
export function CommandToolbar({ conversationId, workspaceId }: CommandToolbarProps) {
  const commandsByWorkspace = useCommandStore((state) => state.commandsByWorkspace);
  const commands = workspaceId ? (commandsByWorkspace.get(workspaceId) ?? []) : [];

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const handleExecute = useCallback(
    (cmdId: number) => {
      if (longPressFired.current) {
        longPressFired.current = false;
        return; // 롱프레스 후 클릭 무시
      }
      if (conversationId == null) return;
      executeCommand(cmdId, conversationId);
    },
    [conversationId]
  );

  const handlePointerDown = useCallback((cmdId: number) => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (workspaceId) {
        commandManageConversation(workspaceId, cmdId);
      }
      longPressTimer.current = null;
    }, 500); // 500ms 롱프레스
  }, [workspaceId]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div className="relative px-3 py-1.5">
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
        {/* 커맨드 버튼들 */}
        {commands.map((cmd) => (
          <button
            key={cmd.id}
            onClick={() => handleExecute(cmd.id)}
            onPointerDown={() => handlePointerDown(cmd.id)}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border bg-secondary/50 hover:bg-secondary transition-colors whitespace-nowrap shrink-0"
            title={cmd.name}
          >
            <CommandIcon icon={cmd.icon} color={cmd.color} />
            <span>{cmd.name}</span>
          </button>
        ))}

        {/* + 추가 버튼 */}
        <button
          onClick={() => {
            if (workspaceId) {
              commandManageConversation(workspaceId);
            }
          }}
          className="flex items-center justify-center w-6 h-6 rounded-md border border-dashed border-border hover:bg-secondary/50 transition-colors shrink-0"
          title="커맨드 추가"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
