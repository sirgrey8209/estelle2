import { Loader2 } from 'lucide-react';
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
  description?: string;
}

interface FileViewerProps {
  open: boolean;
  onClose: () => void;
  file: FileInfo;
  /** 텍스트 내용 또는 base64 이미지 데이터 (null이면 로딩 중) */
  content: string | null;
}

const formatSize = (bytes: number): string => {
  if (bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FILE_ICONS: Record<string, string> = {
  image: '🖼️',
  markdown: '📝',
};

/**
 * 파일 뷰어 다이얼로그
 */
export function FileViewer({ open, onClose, file, content }: FileViewerProps) {
  const isImage = file.mimeType?.startsWith('image/') ||
    /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.filename);

  const isMarkdown = file.mimeType === 'text/markdown' ||
    /\.(md|markdown)$/i.test(file.filename);

  const icon = isImage ? FILE_ICONS.image : isMarkdown ? FILE_ICONS.markdown : '📄';
  const sizeText = formatSize(file.size);

  const renderContent = () => {
    if (content === null) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">다운로드 중...</p>
        </div>
      );
    }
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
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl shrink-0">{icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{file.filename}</p>
              <div className="flex items-center gap-1.5">
                {file.description && (
                  <span className="text-xs text-muted-foreground truncate">
                    {file.description}
                  </span>
                )}
                {file.description && sizeText && (
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                )}
                {sizeText && (
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">
                    {sizeText}
                  </span>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-[300px] border-t border-border overflow-auto">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
