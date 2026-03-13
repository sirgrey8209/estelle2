import { ReactNode, useMemo } from 'react';

export type MarkdownElementType =
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'paragraph'
  | 'code_block'
  | 'blockquote'
  | 'list_item'
  | 'ordered_list_item'
  | 'hr'
  | 'empty';

export interface ParsedElement {
  type: MarkdownElementType;
  content: string;
  language?: string;
}

export function parseMarkdown(content: string): ParsedElement[] {
  const lines = content.split('\n');
  const elements: ParsedElement[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLanguage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 코드 블록 시작/끝
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push({
          type: 'code_block',
          content: codeBlockContent.trimEnd(),
          language: codeBlockLanguage,
        });
        codeBlockContent = '';
        codeBlockLanguage = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? '\n' : '') + line;
      continue;
    }

    // 빈 줄
    if (!line.trim()) {
      elements.push({ type: 'empty', content: '' });
      continue;
    }

    // 구분선
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      elements.push({ type: 'hr', content: '' });
      continue;
    }

    // 제목 (h4 → h1 순서로 체크)
    const h4Match = line.match(/^####\s+(.+)/);
    if (h4Match) {
      elements.push({ type: 'h4', content: h4Match[1] });
      continue;
    }
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      elements.push({ type: 'h3', content: h3Match[1] });
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      elements.push({ type: 'h2', content: h2Match[1] });
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      elements.push({ type: 'h1', content: h1Match[1] });
      continue;
    }

    // 인용
    const quoteMatch = line.match(/^>\s*(.+)/);
    if (quoteMatch) {
      elements.push({ type: 'blockquote', content: quoteMatch[1] });
      continue;
    }

    // 비순서 목록
    const ulMatch = line.match(/^[-*]\s+(.+)/);
    if (ulMatch) {
      elements.push({ type: 'list_item', content: ulMatch[1] });
      continue;
    }

    // 순서 목록
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      elements.push({ type: 'ordered_list_item', content: olMatch[1] });
      continue;
    }

    // 일반 단락
    elements.push({ type: 'paragraph', content: line });
  }

  // 열린 코드 블록 처리 (스트리밍용)
  if (inCodeBlock) {
    elements.push({
      type: 'code_block',
      content: codeBlockContent.trimEnd(),
      language: codeBlockLanguage,
    });
  }

  return elements;
}

// 내부 함수: bold, italic, code 처리 (링크 제외)
function renderInlineStylesInternal(text: string, keyOffset: number = 0): { nodes: ReactNode[]; keyCount: number } {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = keyOffset;

  // **bold** 처리
  while (remaining.includes('**')) {
    const start = remaining.indexOf('**');
    const end = remaining.indexOf('**', start + 2);

    if (end === -1) break;

    if (start > 0) {
      parts.push(remaining.slice(0, start));
    }

    parts.push(
      <strong key={key++}>
        {remaining.slice(start + 2, end)}
      </strong>
    );

    remaining = remaining.slice(end + 2);
  }

  // *italic* 처리 (bold 처리 후 남은 부분)
  let italicRemaining = remaining;
  const italicParts: ReactNode[] = [];

  while (italicRemaining.includes('*')) {
    const start = italicRemaining.indexOf('*');
    const end = italicRemaining.indexOf('*', start + 1);

    if (end === -1) break;

    if (start > 0) {
      italicParts.push(italicRemaining.slice(0, start));
    }

    italicParts.push(
      <em key={key++}>
        {italicRemaining.slice(start + 1, end)}
      </em>
    );

    italicRemaining = italicRemaining.slice(end + 1);
  }

  if (italicParts.length > 0) {
    italicParts.push(italicRemaining);
    parts.push(...italicParts);
  } else if (remaining) {
    parts.push(remaining);
  }

  // `code` 처리
  const finalParts: ReactNode[] = [];
  for (const part of parts) {
    if (typeof part === 'string' && part.includes('`')) {
      let codePart = part;
      while (codePart.includes('`')) {
        const start = codePart.indexOf('`');
        const end = codePart.indexOf('`', start + 1);

        if (end === -1) {
          finalParts.push(codePart);
          codePart = '';
          break;
        }

        if (start > 0) {
          finalParts.push(codePart.slice(0, start));
        }

        finalParts.push(
          <code
            key={key++}
            className="bg-muted px-1 rounded text-primary font-mono text-[0.9em]"
          >
            {codePart.slice(start + 1, end)}
          </code>
        );

        codePart = codePart.slice(end + 1);
      }
      if (codePart) {
        finalParts.push(codePart);
      }
    } else {
      finalParts.push(part);
    }
  }

  return { nodes: finalParts.length > 0 ? finalParts : [text], keyCount: key };
}

export function renderInlineStyles(
  text: string,
  onFilePathClick?: (path: string) => void
): ReactNode {
  // 1. 먼저 링크를 파싱: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const segments: { type: 'text' | 'link'; content: string; url?: string }[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    // 링크 앞의 텍스트
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    // 링크
    segments.push({ type: 'link', content: match[1], url: match[2] });
    lastIndex = match.index + match[0].length;
  }

  // 마지막 남은 텍스트
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // 링크가 없으면 기존 로직 사용
  if (segments.length === 0) {
    const { nodes } = renderInlineStylesInternal(text);
    return nodes;
  }

  // 2. 각 세그먼트 처리
  const result: ReactNode[] = [];
  let keyCounter = 0;

  for (const segment of segments) {
    if (segment.type === 'link') {
      const url = segment.url!;
      const isWebUrl = url.startsWith('http://') || url.startsWith('https://');

      if (isWebUrl) {
        result.push(
          <a
            key={keyCounter++}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:opacity-80"
          >
            {segment.content}
          </a>
        );
      } else {
        result.push(
          <button
            key={keyCounter++}
            onClick={() => onFilePathClick?.(url)}
            className="text-primary underline hover:opacity-80 cursor-pointer"
            title={url}
          >
            {segment.content}
          </button>
        );
      }
    } else {
      // 텍스트 세그먼트: bold/italic/code 처리
      const { nodes, keyCount } = renderInlineStylesInternal(segment.content, keyCounter);
      keyCounter = keyCount;
      result.push(...nodes);
    }
  }

  return result;
}

export function MarkdownElement({ element }: { element: ParsedElement }) {
  switch (element.type) {
    case 'h1':
      return (
        <h1 className="text-base font-bold mt-3 mb-1">
          {renderInlineStyles(element.content)}
        </h1>
      );
    case 'h2':
      return (
        <h2 className="text-sm font-semibold mt-2 mb-1">
          {renderInlineStyles(element.content)}
        </h2>
      );
    case 'h3':
      return (
        <h3 className="text-sm font-semibold mt-2 mb-0.5">
          {renderInlineStyles(element.content)}
        </h3>
      );
    case 'h4':
      return (
        <h4 className="text-sm font-medium mt-1 mb-0.5">
          {renderInlineStyles(element.content)}
        </h4>
      );
    case 'paragraph':
      return (
        <p className="text-sm leading-relaxed mb-1 opacity-85 select-text">
          {renderInlineStyles(element.content)}
        </p>
      );
    case 'code_block':
      return (
        <div className="bg-muted rounded-lg my-1.5 border border-border overflow-hidden">
          {element.language && (
            <div className="text-xs text-muted-foreground px-2 py-1 border-b border-border bg-muted/50">
              {element.language}
            </div>
          )}
          <pre className="font-mono text-xs select-text p-2 overflow-x-auto whitespace-pre">
            {element.content}
          </pre>
        </div>
      );
    case 'blockquote':
      return (
        <div className="border-l-2 border-primary pl-2 my-1">
          <p className="text-sm italic opacity-80 select-text">
            {renderInlineStyles(element.content)}
          </p>
        </div>
      );
    case 'list_item':
      return (
        <div className="flex ml-1 mb-0.5">
          <span className="text-primary mr-1.5 text-sm">•</span>
          <p className="flex-1 text-sm opacity-85 select-text">
            {renderInlineStyles(element.content)}
          </p>
        </div>
      );
    case 'ordered_list_item':
      return (
        <div className="flex ml-1 mb-0.5">
          <span className="text-primary mr-1.5 text-sm">-</span>
          <p className="flex-1 text-sm opacity-85 select-text">
            {renderInlineStyles(element.content)}
          </p>
        </div>
      );
    case 'hr':
      return <hr className="my-2 border-border" />;
    case 'empty':
      return <div className="h-1" />;
    default:
      return null;
  }
}

interface MarkdownContentProps {
  content: string;
  showCursor?: boolean;
}

export function MarkdownContent({ content, showCursor }: MarkdownContentProps) {
  const elements = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="break-words">
      {elements.map((element, index) => (
        <MarkdownElement key={index} element={element} />
      ))}
      {showCursor && (
        <span className="text-primary animate-pulse">▋</span>
      )}
    </div>
  );
}
