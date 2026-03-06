# FilePathLink 컴포넌트 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 파일 경로를 클릭 가능한 링크로 표시하는 재사용 컴포넌트를 만들어 Read/Write/Edit/send_file 도구에 적용

**Architecture:** FilePathLink 컴포넌트 생성 → ToolCard에서 사용 → MessageList의 handleMcpFileClick 재사용

**Tech Stack:** React, TypeScript, Tailwind CSS

---

### Task 1: FilePathLink 컴포넌트 생성

**Files:**
- Create: `packages/client/src/components/chat/FilePathLink.tsx`

**Step 1: 컴포넌트 파일 생성**

```tsx
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
```

**Step 2: 커밋**

```bash
git add packages/client/src/components/chat/FilePathLink.tsx
git commit -m "feat(client): add FilePathLink component for clickable file paths"
```

---

### Task 2: ToolCard에 onFilePathClick prop 추가

**Files:**
- Modify: `packages/client/src/components/chat/ToolCard.tsx`

**Step 1: import 추가 및 props 확장**

ToolCard.tsx 상단에 import 추가:
```tsx
import { FilePathLink } from './FilePathLink';
```

ToolCardProps 인터페이스에 추가:
```tsx
/** 파일 경로 클릭 핸들러 */
onFilePathClick?: (path: string) => void;
```

ToolCard 함수 파라미터에 추가:
```tsx
onFilePathClick,
```

**Step 2: 커밋**

```bash
git add packages/client/src/components/chat/ToolCard.tsx
git commit -m "feat(client): add onFilePathClick prop to ToolCard"
```

---

### Task 3: Read 도구에 FilePathLink 적용

**Files:**
- Modify: `packages/client/src/components/chat/ToolCard.tsx:759-763`

**Step 1: Read 도구 렌더링 수정**

기존 코드:
```tsx
if (toolName === 'Read') {
  const filePath = (toolInput?.file_path as string) || '';
  const fileName = extractFileName(filePath);
  return renderSpecialTool('Read', fileName, filePath);
}
```

변경 코드:
```tsx
if (toolName === 'Read') {
  const filePath = (toolInput?.file_path as string) || '';
  const fileName = extractFileName(filePath);

  return (
    <div
      className={cn(
        'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
        borderColor
      )}
      style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center px-2 py-1 hover:bg-muted/50 transition-colors"
      >
        <span className={statusColor}>{statusIcon}</span>
        <span className="ml-1.5 text-sm font-medium">Read</span>
        <span className="flex-1 ml-1.5 text-xs text-muted-foreground truncate text-left">
          {fileName}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      <Collapsible expanded={isExpanded}>
        <div className="border-t border-border">
          <div className="px-2 py-1">
            <FilePathLink
              path={filePath}
              onClick={() => onFilePathClick?.(filePath)}
            />
          </div>
          {isComplete && cleanedOutput !== undefined && (
            <div className="bg-muted p-2 rounded-b">
              <p className="text-xs opacity-80 select-text whitespace-pre-wrap break-all">
                {typeof cleanedOutput === 'string'
                  ? cleanedOutput.length > 500
                    ? cleanedOutput.substring(0, 500) + '...'
                    : cleanedOutput
                  : JSON.stringify(cleanedOutput, null, 2)}
              </p>
            </div>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
```

**Step 2: 커밋**

```bash
git add packages/client/src/components/chat/ToolCard.tsx
git commit -m "feat(client): apply FilePathLink to Read tool"
```

---

### Task 4: Write 도구에 FilePathLink 적용

**Files:**
- Modify: `packages/client/src/components/chat/ToolCard.tsx:765-809`

**Step 1: Write 도구 filePath 부분 수정**

라인 796-798의 기존 코드:
```tsx
<p className="px-2 py-1 text-xs text-muted-foreground/50 truncate select-text">
  {filePath}
</p>
```

변경:
```tsx
<div className="px-2 py-1">
  <FilePathLink
    path={filePath}
    onClick={() => onFilePathClick?.(filePath)}
  />
</div>
```

**Step 2: 커밋**

```bash
git add packages/client/src/components/chat/ToolCard.tsx
git commit -m "feat(client): apply FilePathLink to Write tool"
```

---

### Task 5: Edit 도구에 FilePathLink 적용

**Files:**
- Modify: `packages/client/src/components/chat/ToolCard.tsx:812-895`

**Step 1: Edit 도구 filePath 부분 수정**

라인 844-846의 기존 코드:
```tsx
<p className="px-2 py-1 text-xs text-muted-foreground/50 truncate select-text">
  {filePath}
</p>
```

변경:
```tsx
<div className="px-2 py-1">
  <FilePathLink
    path={filePath}
    onClick={() => onFilePathClick?.(filePath)}
  />
</div>
```

**Step 2: 커밋**

```bash
git add packages/client/src/components/chat/ToolCard.tsx
git commit -m "feat(client): apply FilePathLink to Edit tool"
```

---

### Task 6: send_file MCP 도구에 FilePathLink 적용

**Files:**
- Modify: `packages/client/src/components/chat/ToolCard.tsx:154-173`

**Step 1: renderMcpTool 내 send_file 파일 카드 수정**

기존 코드:
```tsx
{mcpToolName === 'send_file' && fileInfo && (
  <button
    onClick={() => onFileClick?.(fileInfo!)}
    className="w-full flex items-center gap-1.5 px-2 py-1 border-t border-border/50 hover:bg-accent/30 transition-colors"
  >
    <span className="text-sm">{getFileTypeIcon(fileInfo.mimeType, fileInfo.filename)}</span>
    <span className="text-xs truncate flex-1 text-left">
      {fileInfo.description || fileInfo.filename}
    </span>
    {fileInfo.filename && fileInfo.description && (
      <span className="text-[10px] text-muted-foreground/60 truncate max-w-[80px]">
        {fileInfo.filename}
      </span>
    )}
    <span className="text-[10px] text-muted-foreground/60 shrink-0">
      {formatSize(fileInfo.size)}
    </span>
  </button>
)}
```

변경 코드 (FilePathLink 사용):
```tsx
{mcpToolName === 'send_file' && fileInfo && (
  <div className="px-2 py-1 border-t border-border/50">
    <FilePathLink
      path={fileInfo.path}
      description={fileInfo.description ?? undefined}
      size={fileInfo.size}
      onClick={() => onFileClick?.(fileInfo!)}
    />
  </div>
)}
```

**Step 2: McpRenderContext에 FilePathLink import 필요 없음 (ToolCard 레벨에서 이미 import됨)**

**Step 3: 커밋**

```bash
git add packages/client/src/components/chat/ToolCard.tsx
git commit -m "feat(client): apply FilePathLink to send_file MCP tool"
```

---

### Task 7: MessageBubble에 onFilePathClick 전달

**Files:**
- Modify: `packages/client/src/components/chat/MessageBubble.tsx`

**Step 1: props에 onFilePathClick 추가**

MessageBubbleProps 인터페이스에 추가:
```tsx
/** 파일 경로 클릭 핸들러 */
onFilePathClick?: (path: string) => void;
```

함수 파라미터에 추가:
```tsx
onFilePathClick,
```

ToolCard 호출 부분 (라인 69-83)에 prop 추가:
```tsx
onFilePathClick={onFilePathClick}
```

**Step 2: 커밋**

```bash
git add packages/client/src/components/chat/MessageBubble.tsx
git commit -m "feat(client): pass onFilePathClick through MessageBubble"
```

---

### Task 8: MessageList에서 handleFilePathClick 구현 및 전달

**Files:**
- Modify: `packages/client/src/components/chat/MessageList.tsx`

**Step 1: handleFilePathClick 핸들러 추가**

handleMcpFileClick 아래에 추가:
```tsx
// 파일 경로 클릭 → McpFileInfo로 변환하여 기존 핸들러 재사용
const handleFilePathClick = useCallback((filePath: string) => {
  const filename = filePath.split('/').pop() || filePath;
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // 확장자로 MIME 타입 추정
  const mimeMap: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
    md: 'text/markdown', txt: 'text/plain', json: 'application/json',
    js: 'text/javascript', ts: 'text/typescript', tsx: 'text/typescript',
    jsx: 'text/javascript', css: 'text/css', html: 'text/html',
  };
  const mimeType = mimeMap[ext] || 'application/octet-stream';

  // McpFileInfo 형태로 변환하여 기존 핸들러 호출
  handleMcpFileClick({
    filename,
    path: filePath,
    mimeType,
    size: 0, // 크기는 알 수 없음
  });
}, [handleMcpFileClick]);
```

**Step 2: MessageBubble 호출에 onFilePathClick 추가**

MessageBubble 렌더링 부분에 prop 추가:
```tsx
onFilePathClick={handleFilePathClick}
```

**Step 3: 커밋**

```bash
git add packages/client/src/components/chat/MessageList.tsx
git commit -m "feat(client): implement handleFilePathClick in MessageList"
```

---

### Task 9: 빌드 및 테스트

**Step 1: TypeScript 빌드 확인**

```bash
cd packages/client && pnpm build
```

Expected: 빌드 성공

**Step 2: 개발 서버에서 동작 확인**

- Read 도구 실행 후 확장 → 파일 경로 클릭 → FileViewer 열림
- Write 도구 실행 후 확장 → 파일 경로 클릭 → FileViewer 열림
- Edit 도구 실행 후 확장 → 파일 경로 클릭 → FileViewer 열림
- send_file MCP 도구 → 파일 버튼 클릭 → FileViewer 열림

**Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat(client): clickable file paths in Read/Write/Edit/send_file tools

- Add FilePathLink reusable component
- Apply to Read, Write, Edit tools
- Unify send_file MCP tool to use same component
- Click opens file in FileViewer"
```

---

## 요약

| Task | 설명 |
|------|------|
| 1 | FilePathLink 컴포넌트 생성 |
| 2 | ToolCard에 onFilePathClick prop 추가 |
| 3 | Read 도구에 FilePathLink 적용 |
| 4 | Write 도구에 FilePathLink 적용 |
| 5 | Edit 도구에 FilePathLink 적용 |
| 6 | send_file MCP 도구에 FilePathLink 적용 |
| 7 | MessageBubble에 onFilePathClick 전달 |
| 8 | MessageList에서 handleFilePathClick 구현 |
| 9 | 빌드 및 테스트 |
