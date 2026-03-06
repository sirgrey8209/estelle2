import { cn } from '../../lib/utils';

export interface FilePathLinkProps {
  /** 파일 절대 경로 */
  path: string;
  /** 표시 텍스트 (기본: 파일명) */
  label?: string;
  /** 파일 설명 */
  description?: string;
  /** 파일 크기 (bytes) */
  size?: number;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 추가 스타일 */
  className?: string;
}

/**
 * 파일 경로에서 파일명 추출
 */
function extractFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * 파일 확장자로 타입 아이콘 결정
 */
function getFileTypeIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (/^(png|jpg|jpeg|gif|webp|bmp|svg|ico)$/.test(ext)) return '🖼️';
  if (/^(md|markdown)$/.test(ext)) return '📝';
  if (/^(ts|tsx|js|jsx|py|rb|go|rs|java|c|cpp|h|hpp)$/.test(ext)) return '💻';
  if (/^(json|yaml|yml|toml|xml)$/.test(ext)) return '⚙️';
  return '📄';
}

/**
 * 파일 크기 포맷팅
 */
function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 클릭 가능한 파일 경로 링크 컴포넌트
 */
export function FilePathLink({
  path,
  label,
  description,
  size,
  onClick,
  className,
}: FilePathLinkProps) {
  const filename = extractFileName(path);
  const displayText = label || description || filename;
  const icon = getFileTypeIcon(filename);
  const sizeText = formatSize(size);

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded',
        'text-xs text-left',
        'hover:bg-accent/50 transition-colors',
        'cursor-pointer',
        className
      )}
      title={path}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{displayText}</span>
      {/* description이 있고 label과 다르면 파일명도 표시 */}
      {description && description !== filename && (
        <span className="text-muted-foreground/60 truncate max-w-[80px]">
          {filename}
        </span>
      )}
      {sizeText && (
        <span className="text-muted-foreground/60 shrink-0">{sizeText}</span>
      )}
    </button>
  );
}
