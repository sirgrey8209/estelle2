# 메시지 마크다운 렌더링 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Assistant 메시지에 마크다운 렌더링을 적용하여 코드 블록, 강조 등이 올바르게 표시되도록 한다.

**Architecture:** 기존 MarkdownViewer의 파싱 로직을 `lib/markdown.tsx`로 분리하고, MessageBubble과 StreamingBubble에서 재사용한다. 코드 블록은 내부 가로 스크롤을 지원한다.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## Task 1: markdown.tsx 유틸 생성

**Files:**
- Create: `packages/client/src/lib/markdown.tsx`

**Step 1: 타입 정의 작성**

```tsx
import { ReactNode } from 'react';

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
```

**Step 2: parseMarkdown 함수 작성**

MarkdownViewer.tsx의 parseMarkdown 로직을 그대로 가져온다. 단, 열린 코드 블록(스트리밍용)을 처리하기 위해 마지막에 닫히지 않은 코드 블록도 추가한다.

```tsx
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
```

**Step 3: renderInlineStyles 함수 작성**

```tsx
export function renderInlineStyles(text: string): ReactNode {
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

  return finalParts.length > 0 ? finalParts : text;
}
```

**Step 4: MarkdownElement 컴포넌트 작성**

코드 블록에 `overflow-x-auto`와 `whitespace-pre`를 적용한다.

```tsx
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
```

**Step 5: MarkdownContent 컴포넌트 작성**

메시지용 래퍼 컴포넌트. 스트리밍 커서 옵션 포함.

```tsx
import { useMemo } from 'react';

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
```

**Step 6: 파일 완성 및 확인**

Run: `cd /home/estelle/estelle2 && pnpm exec tsc --noEmit -p packages/client`
Expected: 타입 에러 없음

**Step 7: Commit**

```bash
git add packages/client/src/lib/markdown.tsx
git commit -m "feat(client): add markdown parsing utilities"
```

---

## Task 2: MessageBubble에 마크다운 적용

**Files:**
- Modify: `packages/client/src/components/chat/MessageBubble.tsx:122-133`

**Step 1: import 추가**

파일 상단에 추가:

```tsx
import { MarkdownContent } from '../../lib/markdown';
```

**Step 2: assistant 메시지 부분 수정**

기존 코드 (122-133줄):
```tsx
if (message.role === 'assistant' && message.type === 'text') {
  const assistantMsg = message as AssistantTextMessage;
  return (
    <div
      className="my-0.5 ml-2 pl-1.5 pr-2 border-l-2 border-transparent max-w-[90%]"
    >
      <p className="text-sm opacity-85 leading-relaxed select-text whitespace-pre-wrap break-words">
        {assistantMsg.content}
      </p>
    </div>
  );
}
```

변경 후:
```tsx
if (message.role === 'assistant' && message.type === 'text') {
  const assistantMsg = message as AssistantTextMessage;
  return (
    <div
      className="my-0.5 ml-2 pl-1.5 pr-2 border-l-2 border-transparent max-w-[90%]"
    >
      <MarkdownContent content={assistantMsg.content} />
    </div>
  );
}
```

**Step 3: 타입 체크**

Run: `cd /home/estelle/estelle2 && pnpm exec tsc --noEmit -p packages/client`
Expected: 에러 없음

**Step 4: Commit**

```bash
git add packages/client/src/components/chat/MessageBubble.tsx
git commit -m "feat(client): apply markdown rendering to assistant messages"
```

---

## Task 3: StreamingBubble에 마크다운 적용

**Files:**
- Modify: `packages/client/src/components/chat/StreamingBubble.tsx`

**Step 1: import 추가**

```tsx
import { MarkdownContent } from '../../lib/markdown';
```

**Step 2: 전체 컴포넌트 수정**

기존:
```tsx
export function StreamingBubble({ text }: StreamingBubbleProps) {
  return (
    <div
      className="my-0.5 ml-2 pl-1.5 pr-2 border-l-2 border-transparent max-w-[90%]"
    >
      <p className="text-sm opacity-85 leading-relaxed select-text whitespace-pre-wrap">
        {text}
        <span className="text-primary animate-pulse">▋</span>
      </p>
    </div>
  );
}
```

변경 후:
```tsx
export function StreamingBubble({ text }: StreamingBubbleProps) {
  return (
    <div
      className="my-0.5 ml-2 pl-1.5 pr-2 border-l-2 border-transparent max-w-[90%]"
    >
      <MarkdownContent content={text} showCursor />
    </div>
  );
}
```

**Step 3: 타입 체크**

Run: `cd /home/estelle/estelle2 && pnpm exec tsc --noEmit -p packages/client`
Expected: 에러 없음

**Step 4: Commit**

```bash
git add packages/client/src/components/chat/StreamingBubble.tsx
git commit -m "feat(client): apply markdown rendering to streaming messages"
```

---

## Task 4: MarkdownViewer 리팩토링

**Files:**
- Modify: `packages/client/src/components/viewers/MarkdownViewer.tsx`

**Step 1: 기존 로컬 로직을 import로 교체**

기존 파일의 `parseMarkdown`, `renderInlineStyles`, `MarkdownElement` 등 로컬 정의를 삭제하고 import로 교체.

```tsx
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
```

**Step 2: 타입 체크**

Run: `cd /home/estelle/estelle2 && pnpm exec tsc --noEmit -p packages/client`
Expected: 에러 없음

**Step 3: Commit**

```bash
git add packages/client/src/components/viewers/MarkdownViewer.tsx
git commit -m "refactor(client): use shared markdown utilities in MarkdownViewer"
```

---

## Task 5: 빌드 및 수동 테스트

**Step 1: 빌드 확인**

Run: `cd /home/estelle/estelle2/packages/client && pnpm build`
Expected: 빌드 성공

**Step 2: 수동 테스트 항목**

앱 실행 후 확인:
1. Assistant 메시지에서 `**bold**` → 굵게 표시
2. Assistant 메시지에서 `` `code` `` → 인라인 코드 스타일
3. Assistant 메시지에서 코드 블록 → 배경색, 가로 스크롤 확인
4. 스트리밍 중 코드 블록이 열려있을 때 스타일 유지 확인
5. 스트리밍 커서(▋) 마지막에 표시 확인

**Step 3: 최종 커밋 (필요시)**

```bash
git add -A
git commit -m "feat(client): complete markdown rendering for messages"
```
