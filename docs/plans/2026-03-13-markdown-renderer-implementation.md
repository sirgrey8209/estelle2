# Markdown Renderer Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 자체 마크다운 렌더러에 테이블과 링크(웹/파일) 기능을 추가한다.

**Architecture:** 기존 `parseMarkdown` 함수에 테이블 파싱 로직을 추가하고, `renderInlineStyles` 함수에 링크 파싱을 추가한다. 파일 링크는 기존 `FilePathLink` 컴포넌트를 재사용한다.

**Tech Stack:** React, TypeScript, Vitest

---

## Task 1: 링크 파싱 테스트 작성

**Files:**
- Create: `packages/client/src/lib/markdown.test.ts`

**Step 1: 테스트 파일 생성 및 링크 파싱 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest';
import { parseMarkdown, renderInlineStyles } from './markdown';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';

describe('renderInlineStyles - links', () => {
  it('should parse web link [text](https://url)', () => {
    const result = renderInlineStyles('Check [Google](https://google.com) now');
    const { container } = render(createElement('div', null, result));

    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.textContent).toBe('Google');
    expect(link?.getAttribute('href')).toBe('https://google.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should parse http link', () => {
    const result = renderInlineStyles('Visit [Site](http://example.com)');
    const { container } = render(createElement('div', null, result));

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('http://example.com');
  });

  it('should parse file path link', () => {
    const onFilePathClick = vi.fn();
    const result = renderInlineStyles('Open [config](/home/user/config.ts)', onFilePathClick);
    const { container } = render(createElement('div', null, result));

    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(button?.textContent).toContain('config');
  });

  it('should handle multiple links in one line', () => {
    const result = renderInlineStyles('[A](https://a.com) and [B](https://b.com)');
    const { container } = render(createElement('div', null, result));

    const links = container.querySelectorAll('a');
    expect(links.length).toBe(2);
  });

  it('should handle link with inline styles', () => {
    const result = renderInlineStyles('**Bold** and [Link](https://test.com)');
    const { container } = render(createElement('div', null, result));

    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelector('a')).toBeTruthy();
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client test src/lib/markdown.test.ts`
Expected: FAIL - renderInlineStyles doesn't accept second parameter, links not parsed

---

## Task 2: 링크 파싱 구현

**Files:**
- Modify: `packages/client/src/lib/markdown.tsx`

**Step 1: renderInlineStyles 함수에 onFilePathClick 파라미터 추가 및 링크 파싱 구현**

`renderInlineStyles` 함수를 다음과 같이 수정:

```typescript
export function renderInlineStyles(
  text: string,
  onFilePathClick?: (path: string) => void
): ReactNode {
  // 먼저 링크를 파싱 (다른 인라인 스타일보다 먼저)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const segments: Array<{ type: 'text' | 'link'; content: string; url?: string }> = [];

  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // 링크 전 텍스트
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    // 링크
    segments.push({ type: 'link', content: match[1], url: match[2] });
    lastIndex = match.index + match[0].length;
  }

  // 남은 텍스트
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // 세그먼트가 없으면 전체가 텍스트
  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  const result: ReactNode[] = [];
  let key = 0;

  for (const segment of segments) {
    if (segment.type === 'link' && segment.url) {
      const isWebUrl = /^https?:\/\//.test(segment.url);

      if (isWebUrl) {
        result.push(
          <a
            key={key++}
            href={segment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:opacity-80"
          >
            {segment.content}
          </a>
        );
      } else {
        // 파일 경로 - 인라인 버튼으로 렌더링
        result.push(
          <button
            key={key++}
            onClick={() => onFilePathClick?.(segment.url!)}
            className="text-primary underline hover:opacity-80 cursor-pointer"
            title={segment.url}
          >
            {segment.content}
          </button>
        );
      }
    } else {
      // 텍스트 세그먼트에 기존 인라인 스타일 적용
      result.push(
        <span key={key++}>
          {renderInlineStylesInternal(segment.content)}
        </span>
      );
    }
  }

  return result.length === 1 ? result[0] : result;
}

// 기존 인라인 스타일 로직을 내부 함수로 분리
function renderInlineStylesInternal(text: string): ReactNode {
  // ... 기존 bold, italic, code 파싱 로직 그대로 ...
}
```

**Step 2: 테스트 실행하여 통과 확인**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client test src/lib/markdown.test.ts`
Expected: PASS

**Step 3: 커밋**

```bash
git add packages/client/src/lib/markdown.tsx packages/client/src/lib/markdown.test.ts
git commit -m "feat(client): add link parsing to markdown renderer

- Parse [text](url) syntax
- Web URLs (http/https) open in new tab
- File paths trigger onFilePathClick callback

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: 테이블 파싱 테스트 작성

**Files:**
- Modify: `packages/client/src/lib/markdown.test.ts`

**Step 1: 테이블 파싱 테스트 추가**

```typescript
describe('parseMarkdown - tables', () => {
  it('should parse simple table', () => {
    const input = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;

    const result = parseMarkdown(input);

    expect(result.length).toBe(1);
    expect(result[0].type).toBe('table');
    expect(result[0].headers).toEqual(['Header 1', 'Header 2']);
    expect(result[0].rows).toEqual([['Cell 1', 'Cell 2']]);
  });

  it('should parse table with multiple rows', () => {
    const input = `| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |`;

    const result = parseMarkdown(input);

    expect(result[0].rows?.length).toBe(2);
    expect(result[0].rows?.[0]).toEqual(['1', '2']);
    expect(result[0].rows?.[1]).toEqual(['3', '4']);
  });

  it('should handle table with alignment markers', () => {
    const input = `| Left | Center | Right |
|:-----|:------:|------:|
| L    | C      | R     |`;

    const result = parseMarkdown(input);

    expect(result[0].type).toBe('table');
    expect(result[0].headers).toEqual(['Left', 'Center', 'Right']);
  });

  it('should handle empty cells', () => {
    const input = `| A | B |
|---|---|
|   | X |`;

    const result = parseMarkdown(input);

    expect(result[0].rows?.[0]).toEqual(['', 'X']);
  });

  it('should not parse incomplete table (no separator)', () => {
    const input = `| Not | A | Table |
| Just | Pipes |`;

    const result = parseMarkdown(input);

    // Should be paragraphs, not a table
    expect(result.every(e => e.type === 'paragraph')).toBe(true);
  });

  it('should parse table surrounded by other content', () => {
    const input = `Some text

| H1 | H2 |
|----|---|
| A  | B |

More text`;

    const result = parseMarkdown(input);

    expect(result[0].type).toBe('paragraph');
    expect(result[2].type).toBe('table');
    expect(result[4].type).toBe('paragraph');
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client test src/lib/markdown.test.ts`
Expected: FAIL - table type doesn't exist

---

## Task 4: 테이블 파싱 구현

**Files:**
- Modify: `packages/client/src/lib/markdown.tsx`

**Step 1: 타입에 table 추가**

```typescript
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
```

**Step 2: parseMarkdown에 테이블 파싱 로직 추가**

테이블 파싱 헬퍼 함수 추가:

```typescript
function isTableLine(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  return line
    .trim()
    .slice(1, -1) // Remove leading/trailing |
    .split('|')
    .map(cell => cell.trim());
}
```

`parseMarkdown` 함수 내에서 테이블 처리 (코드 블록 처리 다음, 빈 줄 처리 전에):

```typescript
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
```

**Step 3: 테스트 실행하여 통과 확인**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client test src/lib/markdown.test.ts`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/client/src/lib/markdown.tsx packages/client/src/lib/markdown.test.ts
git commit -m "feat(client): add table parsing to markdown renderer

- Detect table lines starting/ending with |
- Parse header separator |---|
- Extract headers and rows

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: 테이블 렌더링 테스트 작성

**Files:**
- Modify: `packages/client/src/lib/markdown.test.ts`

**Step 1: 테이블 렌더링 테스트 추가**

```typescript
import { MarkdownElement, MarkdownContent } from './markdown';

describe('MarkdownElement - table rendering', () => {
  it('should render table with headers and rows', () => {
    const element = {
      type: 'table' as const,
      content: '',
      headers: ['Name', 'Value'],
      rows: [['A', '1'], ['B', '2']],
    };

    const { container } = render(createElement(MarkdownElement, { element }));

    const table = container.querySelector('table');
    expect(table).toBeTruthy();

    const ths = container.querySelectorAll('th');
    expect(ths.length).toBe(2);
    expect(ths[0].textContent).toBe('Name');
    expect(ths[1].textContent).toBe('Value');

    const tds = container.querySelectorAll('td');
    expect(tds.length).toBe(4);
  });

  it('should apply select-text class to cells', () => {
    const element = {
      type: 'table' as const,
      content: '',
      headers: ['H'],
      rows: [['C']],
    };

    const { container } = render(createElement(MarkdownElement, { element }));

    const th = container.querySelector('th');
    const td = container.querySelector('td');

    expect(th?.className).toContain('select-text');
    expect(td?.className).toContain('select-text');
  });

  it('should render inline styles in table cells', () => {
    const element = {
      type: 'table' as const,
      content: '',
      headers: ['**Bold Header**'],
      rows: [['`code`']],
    };

    const { container } = render(createElement(MarkdownElement, { element }));

    expect(container.querySelector('th strong')).toBeTruthy();
    expect(container.querySelector('td code')).toBeTruthy();
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client test src/lib/markdown.test.ts`
Expected: FAIL - MarkdownElement doesn't handle table type

---

## Task 6: 테이블 렌더링 구현

**Files:**
- Modify: `packages/client/src/lib/markdown.tsx`

**Step 1: MarkdownElement에 onFilePathClick prop 추가 및 table case 구현**

```typescript
interface MarkdownElementProps {
  element: ParsedElement;
  onFilePathClick?: (path: string) => void;
}

export function MarkdownElement({ element, onFilePathClick }: MarkdownElementProps) {
  switch (element.type) {
    // ... 기존 cases ...

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

    // ... default case ...
  }
}
```

**Step 2: 기존 cases에서도 renderInlineStyles에 onFilePathClick 전달**

모든 `renderInlineStyles(element.content)` 호출을 `renderInlineStyles(element.content, onFilePathClick)`으로 변경.

**Step 3: 테스트 실행하여 통과 확인**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client test src/lib/markdown.test.ts`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/client/src/lib/markdown.tsx packages/client/src/lib/markdown.test.ts
git commit -m "feat(client): add table rendering to markdown renderer

- Render table with thead/tbody
- Apply select-text class for text selection
- Support inline styles in table cells

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: MarkdownContent props 확장 및 통합 테스트

**Files:**
- Modify: `packages/client/src/lib/markdown.tsx`
- Modify: `packages/client/src/lib/markdown.test.ts`

**Step 1: MarkdownContent에 onFilePathClick prop 추가**

```typescript
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
```

**Step 2: 통합 테스트 추가**

```typescript
describe('MarkdownContent - integration', () => {
  it('should render mixed content with table and links', () => {
    const content = `# Title

Check [docs](https://docs.com) for info.

| Feature | Status |
|---------|--------|
| Tables  | Done   |
| Links   | Done   |

Open [config](/etc/config.ts) to edit.`;

    const onFilePathClick = vi.fn();
    const { container } = render(
      createElement(MarkdownContent, { content, onFilePathClick })
    );

    expect(container.querySelector('h1')).toBeTruthy();
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelectorAll('a').length).toBe(1);
    expect(container.querySelectorAll('button').length).toBe(1); // file link
  });

  it('should call onFilePathClick when file link clicked', () => {
    const content = 'Open [file](/path/to/file.ts)';
    const onFilePathClick = vi.fn();

    const { container } = render(
      createElement(MarkdownContent, { content, onFilePathClick })
    );

    const button = container.querySelector('button');
    button?.click();

    expect(onFilePathClick).toHaveBeenCalledWith('/path/to/file.ts');
  });
});
```

**Step 3: 테스트 실행하여 통과 확인**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client test src/lib/markdown.test.ts`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/client/src/lib/markdown.tsx packages/client/src/lib/markdown.test.ts
git commit -m "feat(client): add onFilePathClick prop to MarkdownContent

- Pass onFilePathClick through to MarkdownElement
- Add integration tests for mixed content

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: 전체 테스트 실행 및 최종 검증

**Step 1: Client 패키지 전체 테스트 실행**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client test`
Expected: All tests PASS

**Step 2: 타입 체크**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client typecheck`
Expected: No errors

**Step 3: 최종 커밋 (필요시)**

```bash
git add -A
git commit -m "chore: finalize markdown renderer extension

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | 링크 파싱 테스트 작성 |
| 2 | 링크 파싱 구현 (웹 URL + 파일 경로) |
| 3 | 테이블 파싱 테스트 작성 |
| 4 | 테이블 파싱 구현 |
| 5 | 테이블 렌더링 테스트 작성 |
| 6 | 테이블 렌더링 구현 |
| 7 | MarkdownContent props 확장 및 통합 테스트 |
| 8 | 전체 테스트 실행 및 최종 검증 |
