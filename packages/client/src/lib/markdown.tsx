import { ReactNode, useMemo } from 'react';

export type MarkdownElementType =
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'paragraph'
  | 'code_block'
  | 'blockquote'
  | 'list_item'
  | 'ordered_list_item'
  | 'hr'
  | 'empty'
  | 'table';

export interface ParsedElement {
  type: MarkdownElementType;
  content: string;
  language?: string;
  headers?: string[];
  rows?: string[][];
}

function isTableLine(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  const inner = line.trim().slice(1, -1); // Remove leading/trailing |
  const cells: string[] = [];
  let current = '';
  let inCode = false;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (char === '`') {
      inCode = !inCode;
      current += char;
    } else if (char === '|' && !inCode) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());

  return cells;
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

    // 테이블 감지 및 파싱
    if (isTableLine(line)) {
      const tableLines: string[] = [line];
      let j = i + 1;

      // 연속된 테이블 라인 수집
      while (j < lines.length && isTableLine(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }

      // 최소 2줄 (헤더 + 구분선) 이상이고 두 번째 줄이 구분선인 경우만 테이블
      if (tableLines.length >= 2 && isTableSeparator(tableLines[1])) {
        const headers = parseTableCells(tableLines[0]);
        const rows = tableLines.slice(2).map(parseTableCells);

        elements.push({
          type: 'table',
          content: '',
          headers,
          rows,
        });

        i = j - 1; // 루프 인덱스 조정
        continue;
      }
      // 테이블이 아니면 일반 단락으로 폴백
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

// 내부 함수: bold, italic 처리 (코드/링크は上位で処理済み)
function renderBoldItalic(text: string, keyOffset: number = 0): { nodes: ReactNode[]; keyCount: number } {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = keyOffset;

  // **bold** 처理
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

  return { nodes: parts.length > 0 ? parts : [text], keyCount: key };
}

export function renderInlineStyles(
  text: string,
  onFilePathClick?: (path: string) => void
): ReactNode {
  // Phase 1: 코드 스팬을 먼저 분리 (코드 안은 어떤 마크다운도 처리하지 않음)
  const codeSpanRegex = /`([^`]+)`/g;
  const topSegments: { type: 'text' | 'code'; content: string }[] = [];

  let lastIdx = 0;
  let codeMatch: RegExpExecArray | null;

  while ((codeMatch = codeSpanRegex.exec(text)) !== null) {
    if (codeMatch.index > lastIdx) {
      topSegments.push({ type: 'text', content: text.slice(lastIdx, codeMatch.index) });
    }
    topSegments.push({ type: 'code', content: codeMatch[1] });
    lastIdx = codeMatch.index + codeMatch[0].length;
  }
  if (lastIdx < text.length) {
    topSegments.push({ type: 'text', content: text.slice(lastIdx) });
  }
  if (topSegments.length === 0) {
    topSegments.push({ type: 'text', content: text });
  }

  // Phase 2: 각 세그먼트 처리
  const result: ReactNode[] = [];
  let key = 0;

  for (const seg of topSegments) {
    if (seg.type === 'code') {
      result.push(
        <code
          key={key++}
          className="bg-muted px-1 rounded text-primary font-mono text-[0.9em]"
        >
          {seg.content}
        </code>
      );
      continue;
    }

    // 코드가 아닌 텍스트: 링크 파싱
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const linkSegments: { type: 'text' | 'link'; content: string; url?: string }[] = [];

    let linkLastIdx = 0;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkRegex.exec(seg.content)) !== null) {
      if (linkMatch.index > linkLastIdx) {
        linkSegments.push({ type: 'text', content: seg.content.slice(linkLastIdx, linkMatch.index) });
      }
      linkSegments.push({ type: 'link', content: linkMatch[1], url: linkMatch[2] });
      linkLastIdx = linkMatch.index + linkMatch[0].length;
    }
    if (linkLastIdx < seg.content.length) {
      linkSegments.push({ type: 'text', content: seg.content.slice(linkLastIdx) });
    }
    if (linkSegments.length === 0) {
      linkSegments.push({ type: 'text', content: seg.content });
    }

    for (const linkSeg of linkSegments) {
      if (linkSeg.type === 'link') {
        const url = linkSeg.url!;
        const isWebUrl = url.startsWith('http://') || url.startsWith('https://');

        if (isWebUrl) {
          result.push(
            <a
              key={key++}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:opacity-80"
            >
              {linkSeg.content}
            </a>
          );
        } else {
          result.push(
            <button
              key={key++}
              onClick={() => onFilePathClick?.(url)}
              className="text-primary underline hover:opacity-80 cursor-pointer"
              title={url}
            >
              {linkSeg.content}
            </button>
          );
        }
      } else {
        // 일반 텍스트: bold/italic 처리 (코드 스팬은 이미 분리됨)
        const { nodes, keyCount } = renderBoldItalic(linkSeg.content, key);
        key = keyCount;
        result.push(...nodes);
      }
    }
  }

  return result.length === 1 ? result[0] : result;
}

interface MarkdownElementProps {
  element: ParsedElement;
  onFilePathClick?: (path: string) => void;
}

export function MarkdownElement({ element, onFilePathClick }: MarkdownElementProps) {
  switch (element.type) {
    case 'h1':
      return (
        <h1 className="text-base font-bold mt-3 mb-1">
          {renderInlineStyles(element.content, onFilePathClick)}
        </h1>
      );
    case 'h2':
      return (
        <h2 className="text-sm font-semibold mt-2 mb-1">
          {renderInlineStyles(element.content, onFilePathClick)}
        </h2>
      );
    case 'h3':
      return (
        <h3 className="text-sm font-semibold mt-2 mb-0.5">
          {renderInlineStyles(element.content, onFilePathClick)}
        </h3>
      );
    case 'h4':
      return (
        <h4 className="text-sm font-medium mt-1 mb-0.5">
          {renderInlineStyles(element.content, onFilePathClick)}
        </h4>
      );
    case 'paragraph':
      return (
        <p className="text-sm leading-relaxed mb-1 opacity-85 select-text">
          {renderInlineStyles(element.content, onFilePathClick)}
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
            {renderInlineStyles(element.content, onFilePathClick)}
          </p>
        </div>
      );
    case 'list_item':
      return (
        <div className="flex ml-1 mb-0.5">
          <span className="text-primary mr-1.5 text-sm">•</span>
          <p className="flex-1 text-sm opacity-85 select-text">
            {renderInlineStyles(element.content, onFilePathClick)}
          </p>
        </div>
      );
    case 'ordered_list_item':
      return (
        <div className="flex ml-1 mb-0.5">
          <span className="text-primary mr-1.5 text-sm">-</span>
          <p className="flex-1 text-sm opacity-85 select-text">
            {renderInlineStyles(element.content, onFilePathClick)}
          </p>
        </div>
      );
    case 'table':
      return (
        <div className="my-2 overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                {element.headers?.map((header, i) => (
                  <th key={i} className="px-2 py-1 text-left font-semibold select-text">
                    {renderInlineStyles(header, onFilePathClick)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {element.rows?.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1 select-text">
                      {renderInlineStyles(cell, onFilePathClick)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
  onFilePathClick?: (path: string) => void;
}

export function MarkdownContent({ content, showCursor, onFilePathClick }: MarkdownContentProps) {
  const elements = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="break-words">
      {elements.map((element, index) => (
        <MarkdownElement
          key={index}
          element={element}
          onFilePathClick={onFilePathClick}
        />
      ))}
      {showCursor && (
        <span className="text-primary animate-pulse">▋</span>
      )}
    </div>
  );
}
