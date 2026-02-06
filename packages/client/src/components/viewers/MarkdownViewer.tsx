import { useMemo, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface MarkdownViewerProps {
  /** 마크다운 내용 */
  content: string;
  /** 파일명 */
  filename: string;
}

/**
 * 마크다운 뷰어
 *
 * 기본적인 마크다운 렌더링 지원:
 * - 제목 (# ~ ####)
 * - 강조 (**bold**, *italic*)
 * - 코드 블록 (```)
 * - 인라인 코드 (`)
 * - 목록 (-, *, 1.)
 * - 인용 (>)
 * - 구분선 (---, ***)
 */
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

/**
 * 마크다운 요소 타입
 */
type MarkdownElementType =
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'paragraph'
  | 'code_block'
  | 'blockquote'
  | 'list_item'
  | 'ordered_list_item'
  | 'hr'
  | 'empty';

interface ParsedElement {
  type: MarkdownElementType;
  content: string;
  language?: string;
}

/**
 * 마크다운 파싱
 */
function parseMarkdown(content: string): ParsedElement[] {
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
          content: codeBlockContent.trim(),
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
      codeBlockContent += line + '\n';
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

    // 제목
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

  return elements;
}

/**
 * 마크다운 요소 렌더링
 */
function MarkdownElement({ element }: { element: ParsedElement }) {
  switch (element.type) {
    case 'h1':
      return (
        <h1 className="text-2xl font-bold mt-4 mb-2">
          {renderInlineStyles(element.content)}
        </h1>
      );
    case 'h2':
      return (
        <h2 className="text-xl font-semibold mt-3 mb-2">
          {renderInlineStyles(element.content)}
        </h2>
      );
    case 'h3':
      return (
        <h3 className="text-lg font-semibold mt-3 mb-1">
          {renderInlineStyles(element.content)}
        </h3>
      );
    case 'h4':
      return (
        <h4 className="text-base font-medium mt-2 mb-1">
          {renderInlineStyles(element.content)}
        </h4>
      );
    case 'paragraph':
      return (
        <p className="leading-6 mb-2 opacity-80 select-text">
          {renderInlineStyles(element.content)}
        </p>
      );
    case 'code_block':
      return (
        <div className="bg-muted p-3 rounded-lg my-2 border border-border">
          {element.language && (
            <p className="text-xs text-muted-foreground mb-2">{element.language}</p>
          )}
          <pre className="font-mono text-sm select-text whitespace-pre-wrap">
            {element.content}
          </pre>
        </div>
      );
    case 'blockquote':
      return (
        <div className="border-l-2 border-primary pl-3 my-2">
          <p className="italic opacity-80 select-text">
            {renderInlineStyles(element.content)}
          </p>
        </div>
      );
    case 'list_item':
      return (
        <div className="flex ml-2 mb-1">
          <span className="text-primary mr-2">•</span>
          <p className="flex-1 opacity-80 select-text">
            {renderInlineStyles(element.content)}
          </p>
        </div>
      );
    case 'ordered_list_item':
      return (
        <div className="flex ml-2 mb-1">
          <span className="text-primary mr-2">-</span>
          <p className="flex-1 opacity-80 select-text">
            {renderInlineStyles(element.content)}
          </p>
        </div>
      );
    case 'hr':
      return <hr className="my-4 border-border" />;
    case 'empty':
      return <div className="h-2" />;
    default:
      return null;
  }
}

/**
 * 인라인 스타일 렌더링 (bold, italic, code)
 */
function renderInlineStyles(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

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
            className="bg-muted px-1 rounded text-primary font-mono"
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

  return finalParts.length > 0 ? finalParts : text;
}
