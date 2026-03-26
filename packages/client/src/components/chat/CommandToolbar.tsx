import { useState, useCallback, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { useCommandStore, CommandItem } from '../../stores/commandStore';
import { executeCommand, createCommand, updateCommand, deleteCommand } from '../../services/relaySender';

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

interface CommandFormData {
  name: string;
  icon: string;
  color: string;
  content: string;
}

const EMPTY_FORM: CommandFormData = { name: '', icon: '', color: '', content: '' };

/**
 * 커맨드 추가/수정 폼 (인라인 팝오버)
 */
function CommandForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: CommandFormData;
  onSubmit: (data: CommandFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CommandFormData>(initial);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) return;
    onSubmit(form);
  };

  return (
    <div
      ref={formRef}
      className="absolute bottom-full left-0 mb-1 z-50 w-72 rounded-lg border border-border bg-background shadow-lg p-3"
    >
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="text-xs text-muted-foreground">이름 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="커맨드 이름"
            className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">아이콘</label>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="search, 🔍"
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="w-20">
            <label className="text-xs text-muted-foreground">색상</label>
            <input
              type="text"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              placeholder="#ff0"
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">내용 *</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="실행할 프롬프트 내용"
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 text-xs rounded-md hover:bg-secondary transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!form.name.trim() || !form.content.trim()}
            className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * 컨텍스트 메뉴 (우클릭)
 */
function ContextMenu({
  x,
  y,
  onEdit,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-32 rounded-md border border-border bg-background shadow-lg py-1"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => {
          onEdit();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
        수정
      </button>
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-secondary transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        삭제
      </button>
    </div>
  );
}

/**
 * 커맨드 툴바
 * - 커맨드 버튼 목록 (가로 스크롤)
 * - 추가/수정/삭제 인라인 UI
 */
export function CommandToolbar({ conversationId, workspaceId }: CommandToolbarProps) {
  const commandsByWorkspace = useCommandStore((state) => state.commandsByWorkspace);
  const commands = workspaceId ? (commandsByWorkspace.get(workspaceId) ?? []) : [];
  const [showForm, setShowForm] = useState(false);
  const [editingCommand, setEditingCommand] = useState<CommandItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    cmd: CommandItem;
    x: number;
    y: number;
  } | null>(null);

  const handleExecute = useCallback(
    (cmdId: number) => {
      if (conversationId == null) return;
      executeCommand(cmdId, conversationId);
    },
    [conversationId]
  );

  const handleCreate = useCallback((data: CommandFormData) => {
    createCommand(
      data.name.trim(),
      data.icon.trim() || null,
      data.color.trim() || null,
      data.content.trim()
    );
    setShowForm(false);
  }, []);

  const handleUpdate = useCallback(
    (data: CommandFormData) => {
      if (!editingCommand) return;
      updateCommand(editingCommand.id, {
        name: data.name.trim(),
        icon: data.icon.trim() || undefined,
        color: data.color.trim() || undefined,
        content: data.content.trim(),
      });
      setEditingCommand(null);
    },
    [editingCommand]
  );

  const handleDelete = useCallback((cmdId: number) => {
    deleteCommand(cmdId);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, cmd: CommandItem) => {
    e.preventDefault();
    setContextMenu({ cmd, x: e.clientX, y: e.clientY });
  }, []);

  const handleStartEdit = useCallback((cmd: CommandItem) => {
    setEditingCommand(cmd);
    setShowForm(false);
  }, []);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingCommand(null);
  }, []);

  return (
    <div className="relative px-3 py-1.5">
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
        {/* 커맨드 버튼들 */}
        {commands.map((cmd) => (
          <button
            key={cmd.id}
            onClick={() => handleExecute(cmd.id)}
            onContextMenu={(e) => handleContextMenu(e, cmd)}
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
            setShowForm(true);
            setEditingCommand(null);
          }}
          className="flex items-center justify-center w-6 h-6 rounded-md border border-dashed border-border hover:bg-secondary/50 transition-colors shrink-0"
          title="커맨드 추가"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <CommandForm initial={EMPTY_FORM} onSubmit={handleCreate} onCancel={handleCancelForm} />
      )}

      {/* 수정 폼 */}
      {editingCommand && (
        <CommandForm
          initial={{
            name: editingCommand.name,
            icon: editingCommand.icon ?? '',
            color: editingCommand.color ?? '',
            content: editingCommand.content,
          }}
          onSubmit={handleUpdate}
          onCancel={handleCancelForm}
        />
      )}

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onEdit={() => handleStartEdit(contextMenu.cmd)}
          onDelete={() => handleDelete(contextMenu.cmd.id)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
