# 드래그 선택 개선 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 메시지 버블 내 텍스트 선택을 정상화하고, 버블 경계를 넘는 선택을 방지하며, 파일 뷰어에 복사 버튼을 추가한다.

**Architecture:**
1. CSS `select-text` 클래스를 마크다운 제목에 추가하여 선택 가능하게 함
2. 버블 컴포넌트에 마우스 이벤트 핸들러를 추가하여 경계 선택 차단
3. 파일 뷰어에 플로팅 복사 버튼 추가

**Tech Stack:** React, Tailwind CSS, navigator.clipboard API

---

### Task 1: 마크다운 제목에 select-text 추가

**Files:**
- Modify: `/home/estelle/estelle2/packages/client/src/lib/markdown.tsx:221-244`

**Step 1: h1 ~ h4 제목에 select-text 클래스 추가**

```tsx
// h1 (라인 221-226)
case 'h1':
  return (
    <h1 className="text-base font-bold mt-3 mb-1 select-text">
      {renderInlineStyles(element.content)}
    </h1>
  );

// h2 (라인 227-232)
case 'h2':
  return (
    <h2 className="text-sm font-semibold mt-2 mb-1 select-text">
      {renderInlineStyles(element.content)}
    </h2>
  );

// h3 (라인 233-238)
case 'h3':
  return (
    <h3 className="text-sm font-semibold mt-2 mb-0.5 select-text">
      {renderInlineStyles(element.content)}
    </h3>
  );

// h4 (라인 239-244)
case 'h4':
  return (
    <h4 className="text-sm font-medium mt-1 mb-0.5 select-text">
      {renderInlineStyles(element.content)}
    </h4>
  );
```

**Step 2: 수동 확인**

브라우저에서 마크다운 제목을 드래그하여 선택 가능한지 확인

**Step 3: Commit**

```bash
git add packages/client/src/lib/markdown.tsx
git commit -m "fix(client): add select-text to markdown headings"
```

---

### Task 2: 버블 경계 선택 차단 - MarkdownContent 래퍼

**Files:**
- Modify: `/home/estelle/estelle2/packages/client/src/lib/markdown.tsx:304-317`

**Step 1: MarkdownContent에 선택 경계 로직 추가**

`MarkdownContent` 컴포넌트의 최상위 div에서 마우스 이벤트를 처리하여, 드래그가 버블 외부로 나가면 selection을 초기화한다.

```tsx
export function MarkdownContent({ content, showCursor }: MarkdownContentProps) {
  const elements = useMemo(() => parseMarkdown(content), [content]);

  const handleMouseLeave = (e: React.MouseEvent) => {
    // 마우스 버튼이 눌린 상태로 나가면 (드래그 중) selection 초기화
    if (e.buttons === 1) {
      window.getSelection()?.removeAllRanges();
    }
  };

  return (
    <div className="break-words" onMouseLeave={handleMouseLeave}>
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

**Step 2: 수동 확인**

버블 내부에서 드래그 시작 후 버블 외부로 마우스를 이동했을 때 선택이 해제되는지 확인

**Step 3: Commit**

```bash
git add packages/client/src/lib/markdown.tsx
git commit -m "fix(client): clear selection when drag leaves markdown content"
```

---

### Task 3: 버블 경계 선택 차단 - UserContent

**Files:**
- Modify: `/home/estelle/estelle2/packages/client/src/components/chat/MessageBubble.tsx:166-197`

**Step 1: UserContent에 선택 경계 로직 추가**

```tsx
function UserContent({ content, attachments, onImagePress }: UserContentProps) {
  const hasAttachments = attachments && attachments.length > 0;
  const hasText = content.trim().length > 0;

  const handleMouseLeave = (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      window.getSelection()?.removeAllRanges();
    }
  };

  return (
    <div onMouseLeave={handleMouseLeave}>
      {hasAttachments && (
        <div className="flex flex-wrap gap-1">
          {attachments.map((attachment, index) => {
            const uri = attachment.path || '';
            return (
              <AttachmentImage
                key={index}
                uri={uri}
                filename={attachment.filename}
                thumbnail={attachment.thumbnail}
                onPress={() => onImagePress?.(uri)}
              />
            );
          })}
        </div>
      )}

      {hasAttachments && hasText && <div className="h-1" />}

      {hasText && (
        <p className="text-sm select-text whitespace-pre-wrap break-words">
          {content}
        </p>
      )}
    </div>
  );
}
```

**Step 2: 수동 확인**

사용자 메시지 버블에서 드래그 시작 후 버블 외부로 마우스를 이동했을 때 선택이 해제되는지 확인

**Step 3: Commit**

```bash
git add packages/client/src/components/chat/MessageBubble.tsx
git commit -m "fix(client): clear selection when drag leaves user content"
```

---

### Task 4: 파일 뷰어 복사 버튼 - TextViewer

**Files:**
- Modify: `/home/estelle/estelle2/packages/client/src/components/viewers/TextViewer.tsx`

**Step 1: 복사 버튼 상태와 핸들러 추가**

```tsx
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex-1 bg-card overflow-auto relative">
      {/* 플로팅 복사 버튼 */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted border border-border transition-colors"
        title="전체 복사"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <div className="p-4">
        <pre className="font-mono text-sm leading-6 opacity-80 whitespace-pre-wrap select-text">
          {content}
        </pre>
      </div>
    </div>
  );
}
```

**Step 2: 수동 확인**

TextViewer 열고 우측 상단 복사 버튼 클릭 → 클립보드에 전체 내용이 복사되는지 확인

**Step 3: Commit**

```bash
git add packages/client/src/components/viewers/TextViewer.tsx
git commit -m "feat(client): add floating copy button to TextViewer"
```

---

### Task 5: 파일 뷰어 복사 버튼 - MarkdownViewer

**Files:**
- Modify: `/home/estelle/estelle2/packages/client/src/components/viewers/MarkdownViewer.tsx`

**Step 1: 복사 버튼 상태와 핸들러 추가**

```tsx
import { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { parseMarkdown, MarkdownElement } from '../../lib/markdown';

interface MarkdownViewerProps {
  content: string;
  filename: string;
}

export function MarkdownViewer({ content, filename }: MarkdownViewerProps) {
  const [copied, setCopied] = useState(false);
  const elements = useMemo(() => parseMarkdown(content), [content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex-1 bg-card overflow-auto relative">
      {/* 플로팅 복사 버튼 */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted border border-border transition-colors"
        title="전체 복사"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <div className="p-4">
        {elements.map((element, index) => (
          <MarkdownElement key={index} element={element} />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: 수동 확인**

MarkdownViewer 열고 우측 상단 복사 버튼 클릭 → 클립보드에 원본 마크다운이 복사되는지 확인

**Step 3: Commit**

```bash
git add packages/client/src/components/viewers/MarkdownViewer.tsx
git commit -m "feat(client): add floating copy button to MarkdownViewer"
```

---

### Task 6: 최종 검증 및 통합 커밋

**Step 1: 전체 빌드 확인**

```bash
cd /home/estelle/estelle2 && pnpm build
```

Expected: 빌드 성공

**Step 2: 기능 확인 체크리스트**

- [ ] 마크다운 제목(h1~h4) 드래그 선택 가능
- [ ] 버블 내부 텍스트 드래그 선택 정상 동작
- [ ] 버블 경계를 넘어 드래그 시 선택 해제됨
- [ ] TextViewer 복사 버튼 동작
- [ ] MarkdownViewer 복사 버튼 동작
