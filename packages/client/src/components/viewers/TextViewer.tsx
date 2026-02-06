interface TextViewerProps {
  /** 텍스트 내용 */
  content: string;
  /** 파일명 */
  filename: string;
}

/**
 * 텍스트 파일 뷰어
 */
export function TextViewer({ content, filename }: TextViewerProps) {
  return (
    <div className="flex-1 bg-card overflow-auto">
      <div className="p-4">
        <pre className="font-mono text-sm leading-6 opacity-80 whitespace-pre-wrap select-text">
          {content}
        </pre>
      </div>
    </div>
  );
}
