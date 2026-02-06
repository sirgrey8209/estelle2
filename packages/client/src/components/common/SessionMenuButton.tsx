import { useState } from 'react';
import { Lock, Pencil, AlertTriangle, MoreVertical, RefreshCw, Package, Bug } from 'lucide-react';
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
}: SessionMenuButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const config = PERMISSION_CONFIG[permissionMode];
  const Icon = config.icon;

  const handlePermissionCycle = () => {
    const currentIndex = PERMISSION_MODES.indexOf(permissionMode);
    const nextIndex = (currentIndex + 1) % PERMISSION_MODES.length;
    const nextMode = PERMISSION_MODES[nextIndex];
    onPermissionModeChange?.(nextMode);
  };

  const handleNewSession = () => {
    setShowConfirmDialog(true);
  };

  const confirmNewSession = () => {
    setShowConfirmDialog(false);
    onNewSession?.();
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
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
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={confirmNewSession}>
              새 세션 시작
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
