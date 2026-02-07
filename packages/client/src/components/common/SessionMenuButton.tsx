import { useState } from 'react';
import { Lock, Pencil, AlertTriangle, MoreVertical, RefreshCw, Package, Bug, Type, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions';

const PERMISSION_CONFIG: Record<
  PermissionMode,
  { label: string; icon: typeof Lock }
> = {
  default: { label: 'Default', icon: Lock },
  acceptEdits: { label: 'Accept Edits', icon: Pencil },
  bypassPermissions: { label: 'Bypass All', icon: AlertTriangle },
};

const PERMISSION_MODES: PermissionMode[] = [
  'default',
  'acceptEdits',
  'bypassPermissions',
];

interface SessionMenuButtonProps {
  permissionMode?: PermissionMode;
  onPermissionModeChange?: (mode: PermissionMode) => void;
  onNewSession?: () => void;
  onCompact?: () => void;
  onBugReport?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  conversationName?: string;
}

/**
 * 세션 메뉴 버튼
 */
export function SessionMenuButton({
  permissionMode = 'default',
  onPermissionModeChange,
  onNewSession,
  onCompact,
  onBugReport,
  onRename,
  onDelete,
  conversationName,
}: SessionMenuButtonProps) {
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const config = PERMISSION_CONFIG[permissionMode];
  const Icon = config.icon;

  const handlePermissionCycle = () => {
    const currentIndex = PERMISSION_MODES.indexOf(permissionMode);
    const nextIndex = (currentIndex + 1) % PERMISSION_MODES.length;
    const nextMode = PERMISSION_MODES[nextIndex];
    onPermissionModeChange?.(nextMode);
  };

  const handleNewSession = () => {
    setShowNewSessionDialog(true);
  };

  const confirmNewSession = () => {
    setShowNewSessionDialog(false);
    onNewSession?.();
  };

  const confirmDelete = () => {
    setShowDeleteDialog(false);
    onDelete?.();
  };

  return (
    <>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePermissionCycle}
          title={config.label}
        >
          <Icon className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onRename && (
              <DropdownMenuItem onClick={onRename}>
                <Type className="mr-2 h-4 w-4" />
                이름 변경
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleNewSession}>
              <RefreshCw className="mr-2 h-4 w-4" />
              새 세션
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCompact}>
              <Package className="mr-2 h-4 w-4" />
              컴팩트
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onBugReport} className="text-destructive">
              <Bug className="mr-2 h-4 w-4" />
              버그 리포트
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                대화 삭제
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 새 세션 확인 다이얼로그 */}
      <Dialog open={showNewSessionDialog} onOpenChange={setShowNewSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 세션</DialogTitle>
            <DialogDescription>
              현재 세션을 종료하고 새 세션을 시작할까요?
              <br />
              기존 대화 내용은 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSessionDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmNewSession}>
              새 세션 시작
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 대화 삭제 확인 다이얼로그 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>대화 삭제</DialogTitle>
            <DialogDescription>
              "{conversationName}" 대화를 삭제할까요?
              <br />
              삭제된 대화는 복구할 수 없어요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
