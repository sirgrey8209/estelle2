import { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { LoadingSpinner } from '../ui/loading-spinner';

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (message: string) => Promise<void>;
}

/**
 * 버그 리포트 다이얼로그
 */
export function BugReportDialog({ open, onClose, onSubmit }: BugReportDialogProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setSending(true);
    setError(null);
    try {
      if (onSubmit) {
        await onSubmit(trimmedMessage);
      }
      setMessage('');
      onClose();
      // TODO: toast notification
      alert('버그 리포트가 전송되었습니다.');
    } catch (err) {
      setError(`전송 실패: ${err}`);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setMessage('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>버그 리포트</DialogTitle>
          <DialogDescription>
            문제를 설명해주세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="어떤 문제가 발생했나요?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            disabled={sending}
            autoFocus
          />

          <p className="text-xs text-muted-foreground">
            현재 대화/워크스페이스 정보가 함께 전송됩니다.
          </p>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={sending || !message.trim()}
          >
            {sending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                전송 중...
              </>
            ) : (
              '전송'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
