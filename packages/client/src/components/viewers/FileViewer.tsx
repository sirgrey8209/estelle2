import { X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { ImageViewer } from './ImageViewer';
import { TextViewer } from './TextViewer';
import { MarkdownViewer } from './MarkdownViewer';

interface FileInfo {
  filename: string;
  size: number;
  mimeType?: string;
}

interface FileViewerProps {
  open: boolean;
  onClose: () => void;
  file: FileInfo;
  /** 텍스트 내용 또는 base64 이미지 데이터 */
  content: string;
}

/**
 * 파일 뷰어 다이얼로그
 */
export function FileViewer({ open, onClose, file, content }: FileViewerProps) {
  const isImage = file.mimeType?.startsWith('image/') ||
    /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.filename);

  const isMarkdown = file.mimeType === 'text/markdown' ||
    /\.(md|markdown)$/i.test(file.filename);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (): string => {
    if (isImage) return '🖼️';
    if (isMarkdown) return '📝';
    return '📄';
  };

  const renderContent = () => {
    if (isImage) {
      return <ImageViewer data={content} filename={file.filename} />;
    }
    if (isMarkdown) {
      return <MarkdownViewer content={content} filename={file.filename} />;
    }
    return <TextViewer content={content} filename={file.filename} />;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[85vh] w-full flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between pr-8">
          <DialogTitle className="flex items-center gap-3">
            <span className="text-lg">{getFileIcon()}</span>
            <div>
              <p className="text-sm font-medium truncate">{file.filename}</p>
              <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
            </div>
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 min-h-[300px] border-t border-border overflow-hidden">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
