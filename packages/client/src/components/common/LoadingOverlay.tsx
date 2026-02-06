import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
}

/**
 * 로딩 오버레이
 */
export function LoadingOverlay({ message = '로딩 중...' }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="rounded-xl bg-background px-8 py-6 shadow-lg text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
