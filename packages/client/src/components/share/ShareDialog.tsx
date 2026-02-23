/**
 * @file ShareDialog.tsx
 * @description 공유 링크 다이얼로그
 *
 * 공유 링크를 생성하고 복사할 수 있는 다이얼로그입니다.
 */

import { useState, useEffect } from 'react';
import { Copy, Check, Loader2, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  shareUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * 공유 다이얼로그 컴포넌트
 */
export function ShareDialog({
  open,
  onClose,
  shareUrl,
  isLoading,
  error,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  // 다이얼로그가 닫힐 때 복사 상태 초기화
  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const handleCopy = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            대화 공유
          </DialogTitle>
          <DialogDescription>
            이 링크를 통해 누구나 대화 내용을 볼 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="text-destructive text-sm text-center py-4">
              {error}
            </div>
          )}

          {shareUrl && !isLoading && (
            <div className="flex items-center gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {shareUrl && !isLoading && (
            <p className="text-xs text-muted-foreground">
              • 로그인 없이 접근 가능합니다
              <br />
              • 실시간으로 새 메시지가 표시됩니다
              <br />
              • 수동으로 비활성화하기 전까지 유효합니다
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
