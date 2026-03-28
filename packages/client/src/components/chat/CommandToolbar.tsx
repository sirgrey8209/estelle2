import { useCallback, useRef, useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Plus } from 'lucide-react';
import { useCommandStore } from '../../stores/commandStore';
import { useConversationStore } from '../../stores/conversationStore';
import { executeCommand, commandManageConversation } from '../../services/relaySender';
import type { StoreMessage } from '@estelle/core';

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
 * - 클릭으로 선택, 선택된 상태에서 클릭으로 실행
 * - 선택된 커맨드 버튼 롱프레스 → 게이지 애니메이션 후 커맨드 편집 대화
 * - + 버튼 → 선택 후 클릭으로 새 커맨드 생성 대화
 */
export function CommandToolbar({ conversationId, workspaceId }: CommandToolbarProps) {
  const commandsByWorkspace = useCommandStore((state) => state.commandsByWorkspace);
  const commands = workspaceId ? (commandsByWorkspace.get(workspaceId) ?? []) : [];

  const [selectedId, setSelectedId] = useState<number | 'add' | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);

  const longPressFired = useRef(false);
  const longPressStart = useRef<number | null>(null);
  const longPressRaf = useRef<number | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Outside click: deselect when clicking outside toolbar
  useEffect(() => {
    if (selectedId == null) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setSelectedId(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [selectedId]);

  const handleCommandClick = useCallback(
    (cmdId: number) => {
      if (longPressFired.current) {
        longPressFired.current = false;
        return; // 롱프레스 후 클릭 무시
      }

      if (selectedId === cmdId) {
        // 선택된 버튼 클릭 → 실행 후 선택 해제
        if (conversationId == null) return;

        const cmd = commands.find((c) => c.id === cmdId);
        if (cmd) {
          // optimistic update: command_execute 임시 메시지 추가
          const tempMessage = {
            id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: 'user' as const,
            type: 'command_execute' as const,
            content: cmd.content,
            timestamp: Date.now(),
            commandId: cmd.id,
            commandName: cmd.name,
            commandIcon: cmd.icon,
            commandColor: cmd.color,
            temporary: true,
          } as StoreMessage;
          useConversationStore.getState().addMessage(conversationId, tempMessage);
        }

        executeCommand(cmdId, conversationId);
        setSelectedId(null);
      } else {
        // 미선택 또는 다른 버튼 클릭 → 선택
        setSelectedId(cmdId);
      }
    },
    [selectedId, conversationId, commands]
  );

  const handleAddClick = useCallback(() => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }

    if (selectedId === 'add') {
      // 선택된 상태에서 클릭 → 실행 후 선택 해제
      if (workspaceId) {
        commandManageConversation(workspaceId);
      }
      setSelectedId(null);
    } else {
      // 미선택 → 선택
      setSelectedId('add');
    }
  }, [selectedId, workspaceId]);

  const cancelLongPress = useCallback(() => {
    if (longPressRaf.current != null) {
      cancelAnimationFrame(longPressRaf.current);
      longPressRaf.current = null;
    }
    longPressStart.current = null;
    setLongPressProgress(0);
  }, []);

  const handlePointerDown = useCallback(
    (cmdId: number) => {
      // 롱프레스는 선택된 커맨드 버튼에서만 동작
      if (selectedId !== cmdId) return;

      longPressFired.current = false;
      longPressStart.current = performance.now();

      const animate = () => {
        if (longPressStart.current == null) return;

        const elapsed = performance.now() - longPressStart.current;
        const progress = Math.min(elapsed / 500, 1);
        setLongPressProgress(progress);

        if (progress >= 1) {
          // 게이지 완료 → 커맨드 편집 대화
          longPressFired.current = true;
          if (workspaceId) {
            commandManageConversation(workspaceId, cmdId);
          }
          longPressStart.current = null;
          longPressRaf.current = null;
          setLongPressProgress(0);
          return;
        }

        longPressRaf.current = requestAnimationFrame(animate);
      };

      longPressRaf.current = requestAnimationFrame(animate);
    },
    [selectedId, workspaceId]
  );

  const handlePointerUp = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  return (
    <div className="relative px-3 py-1.5" ref={toolbarRef}>
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
        {/* 커맨드 버튼들 */}
        {commands.map((cmd) => {
          const isSelected = selectedId === cmd.id;
          return (
            <button
              key={cmd.id}
              onClick={() => handleCommandClick(cmd.id)}
              onPointerDown={() => handlePointerDown(cmd.id)}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className={`relative flex items-center gap-1 text-xs rounded-md border transition-colors whitespace-nowrap shrink-0 overflow-hidden ${
                isSelected
                  ? 'px-2 py-1 ring-1 ring-primary border-primary bg-secondary/50 hover:bg-secondary'
                  : 'p-1 border-border bg-secondary/50 hover:bg-secondary'
              }`}
              title={cmd.name}
            >
              {/* Long press gauge */}
              {isSelected && longPressProgress > 0 && (
                <div
                  className="absolute inset-0 bg-primary/20 origin-left"
                  style={{ transform: `scaleX(${longPressProgress})` }}
                />
              )}
              <span className="relative flex items-center gap-1">
                <CommandIcon icon={cmd.icon} color={cmd.color} />
                {isSelected && <span>{cmd.name}</span>}
              </span>
            </button>
          );
        })}

        {/* + 추가 버튼 */}
        {(() => {
          const isAddSelected = selectedId === 'add';
          return (
            <button
              onClick={handleAddClick}
              className={`flex items-center justify-center rounded-md border transition-colors shrink-0 ${
                isAddSelected
                  ? 'gap-1 px-2 py-1 ring-1 ring-primary border-primary bg-secondary/50 hover:bg-secondary'
                  : 'w-6 h-6 border-dashed border-border hover:bg-secondary/50'
              }`}
              title="커맨드 추가"
            >
              <Plus className="h-3 w-3 text-muted-foreground" />
              {isAddSelected && <span className="text-xs whitespace-nowrap">커맨드 추가</span>}
            </button>
          );
        })()}
      </div>
    </div>
  );
}
