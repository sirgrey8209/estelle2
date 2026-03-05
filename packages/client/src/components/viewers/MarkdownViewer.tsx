import { useMemo } from 'react';
import { parseMarkdown, MarkdownElement } from '../../lib/markdown';

interface MarkdownViewerProps {
  content: string;
  filename: string;
}

export function MarkdownViewer({ content, filename }: MarkdownViewerProps) {
  const elements = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="flex-1 bg-card overflow-auto">
      <div className="p-4">
        {elements.map((element, index) => (
          <MarkdownElement key={index} element={element} />
        ))}
      </div>
    </div>
  );
}
