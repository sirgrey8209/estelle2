import { Loader2 } from 'lucide-react';
import { type FileInfo, formatFileSize, useDownloadStore } from '../../stores';
import { cn } from '../../lib/utils';

interface FileAttachmentCardProps {
  file: FileInfo;
  onDownload?: () => void;
  onOpen?: () => void;
}

/**
 * 파일 첨부 카드
 */
export function FileAttachmentCard({ file, onDownload, onOpen }: FileAttachmentCardProps) {
  const downloadStatus = useDownloadStore((s) => s.getStatus(file.filename));
  const isDownloading = downloadStatus === 'downloading';
  const isDownloaded = downloadStatus === 'downloaded';
  const isFailed = downloadStatus === 'failed';

  const getFileIcon = (): string => {
    switch (file.fileType) {
      case 'image':
        return '🖼️';
      case 'markdown':
        return '📝';
      case 'text':
        return '📄';
      default:
        return '📁';
    }
  };

  const getStatusIcon = () => {
    if (isDownloading) {
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    }
    if (isDownloaded) {
      return <span className="text-green-500 text-sm">✓</span>;
    }
    if (isFailed) {
      return <span className="text-destructive text-sm">!</span>;
    }
    return <span className="text-primary text-sm">⬇</span>;
  };

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
      className="w-full text-left"
    >
      <div
        className="my-0.5 max-w-[90%] border-l-2 border-primary px-3 py-2 rounded bg-card"
      >
        <div className="flex items-center">
          <span className="text-xl mr-3">{getFileIcon()}</span>

          <div className="flex-1 min-w-0">
            <p className="truncate">
              {file.filename}
            </p>
            <div className="flex items-center mt-0.5">
              <span className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              {file.description && (
                <>
                  <span className="text-xs text-muted-foreground/40 mx-1">|</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {file.description}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="ml-3 w-6 h-6 flex items-center justify-center">
            {getStatusIcon()}
          </div>
        </div>

        {isFailed && (
          <p className="text-xs text-destructive mt-2">
            다운로드 실패. 탭하여 재시도
          </p>
        )}

        {!isDownloaded && !isDownloading && !isFailed && (
          <p className="text-xs text-muted-foreground mt-1">
            탭하여 다운로드
          </p>
        )}
      </div>
    </button>
  );
}
