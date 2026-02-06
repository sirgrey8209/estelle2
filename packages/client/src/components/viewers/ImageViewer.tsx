import { useState } from 'react';

interface ImageViewerProps {
  /** Base64 인코딩된 이미지 데이터 또는 URI */
  data: string;
  /** 파일명 */
  filename: string;
}

/**
 * 이미지 뷰어 (확대/축소 지원)
 */
export function ImageViewer({ data, filename }: ImageViewerProps) {
  const [error, setError] = useState(false);

  // data가 base64인지 uri인지 판단
  const imageSrc = data.startsWith('data:') || data.startsWith('file:') || data.startsWith('http')
    ? data
    : `data:image/png;base64,${data}`;

  if (error) {
    return (
      <div className="flex-1 bg-card flex flex-col items-center justify-center">
        <span className="text-4xl mb-3">🖼️</span>
        <p className="text-muted-foreground">이미지를 표시할 수 없습니다</p>
        <p className="text-xs text-muted-foreground mt-1">{filename}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-card overflow-auto flex items-center justify-center p-4">
      <img
        src={imageSrc}
        alt={filename}
        className="max-w-full max-h-full object-contain"
        onError={() => setError(true)}
      />
    </div>
  );
}
