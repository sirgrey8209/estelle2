import { Loader2, FileDown, Check, AlertCircle } from 'lucide-react';
import { type FileInfo, useDownloadStore } from '../../stores';

interface FileAttachmentCardProps {
  file: FileInfo;
  onDownload?: () => void;
  onOpen?: () => void;
}

const FILE_ICONS: Record<string, string> = {
  image: '🖼️',
  markdown: '📝',
  text: '📄',
};

/**
 * 파일 첨부 카드 (한 줄 컴팩트)
 */
export function FileAttachmentCard({ file, onDownload, onOpen }: FileAttachmentCardProps) {
  const downloadStatus = useDownloadStore((s) => s.getStatus(file.filename));
  const isDownloading = downloadStatus === 'downloading';
  const isDownloaded = downloadStatus === 'downloaded';
  const isFailed = downloadStatus === 'failed';

  const icon = FILE_ICONS[file.fileType] ?? '📁';
  const label = file.description || file.filename;

  const handlePress = () => {
    if (isDownloaded) {
      onOpen?.();
    } else if (!isDownloading) {
      onDownload?.();
    }
  };

  return (
    <button
      onClick={handlePress}
      className="my-0.5 ml-2 pl-1.5 pr-2 py-1 rounded border-l-2 border-blue-500 bg-card flex items-center gap-1.5 max-w-[400px] text-left hover:bg-accent/30 transition-colors"
    >
      <span className="text-sm shrink-0">{icon}</span>
      <span className="text-sm truncate">{label}</span>
      <span className="ml-auto shrink-0">
        {isDownloading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        {isDownloaded && <Check className="h-3.5 w-3.5 text-green-500" />}
        {isFailed && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
        {!isDownloading && !isDownloaded && !isFailed && (
          <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </span>
    </button>
  );
}
