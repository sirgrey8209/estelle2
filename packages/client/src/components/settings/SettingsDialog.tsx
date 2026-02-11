import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { SettingsContent } from './SettingsScreen';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Desktop용 설정 다이얼로그
 */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <SettingsContent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
