# Markdown Renderer Extension Design

## Overview

Client의 자체 마크다운 렌더러(`/packages/client/src/lib/markdown.tsx`)에 테이블과 링크 기능을 추가한다.

## 요구사항

### 기능적 요구사항

1. **테이블 렌더링**
   - `| col | col |` 형식의 마크다운 테이블 파싱
   - 헤더 구분선 `|---|---|` 인식
   - 셀 내 인라인 스타일(bold, italic, code) 지원

2. **링크 (웹 URL)**
   - `[text](https://...)` 형식 파싱
   - 새 창(`target="_blank"`)으로 열기
   - 보안: `rel="noopener noreferrer"` 추가

3. **링크 (파일 경로)**
   - `[text](/path/to/file)` 형식 파싱
   - 기존 `FilePathLink` 컴포넌트 활용
   - 클릭 시 뷰어로 열기 (`onFilePathClick` 핸들러)

4. **텍스트 선택**
   - 모든 렌더링된 요소에서 드래그 선택 가능
   - `select-text` 클래스 적용

### URL 구분 로직

```
http:// 또는 https:// 로 시작 → 웹 링크
그 외 → 파일 경로
```

## 구현 설계

### 1. 타입 확장

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
  | 'table';  // 추가

export interface ParsedElement {
  type: MarkdownElementType;
  content: string;
  language?: string;
  // 테이블용
  headers?: string[];
  rows?: string[][];
}
```

### 2. 테이블 파싱 로직

`parseMarkdown` 함수에서:

1. `|`로 시작하는 연속 라인 감지
2. 두 번째 줄이 `|:?-+:?|` 패턴이면 헤더 구분선
3. 첫 줄 → headers, 나머지 → rows
4. 각 셀의 앞뒤 공백 trim

```typescript
// 테이블 라인 감지
const isTableLine = (line: string) => line.trim().startsWith('|');
const isHeaderSeparator = (line: string) => /^\|[\s:|-]+\|$/.test(line.trim());
```

### 3. 링크 파싱 로직

`renderInlineStyles` 함수에서 링크 처리 추가:

```typescript
// 링크 정규식: [text](url)
const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

// URL 타입 판별
const isWebUrl = (url: string) => /^https?:\/\//.test(url);
```

### 4. Props 변경

```typescript
interface MarkdownContentProps {
  content: string;
  showCursor?: boolean;
  onFilePathClick?: (path: string) => void;  // 추가
}

// MarkdownElement도 동일하게 onFilePathClick 전달
```

### 5. 테이블 렌더링 컴포넌트

```tsx
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
```

### 6. 링크 렌더링

```tsx
// 웹 링크
<a
  href={url}
  target="_blank"
  rel="noopener noreferrer"
  className="text-primary underline hover:opacity-80"
>
  {text}
</a>

// 파일 링크 - FilePathLink 컴포넌트 사용
<FilePathLink
  path={url}
  label={text}
  onClick={() => onFilePathClick?.(url)}
/>
```

## 수정 대상 파일

1. `/packages/client/src/lib/markdown.tsx` - 메인 구현
2. 테스트 파일 추가 (TDD)

## 에지 케이스

- 테이블 내 빈 셀: 빈 문자열로 처리
- 불완전한 테이블 (헤더 구분선 없음): 일반 텍스트로 폴백
- 링크 텍스트 내 특수문자: 정규식 이스케이프 처리
- 중첩된 마크다운 (테이블 셀 내 링크): 인라인 스타일로 처리

## 테스트 케이스

1. 기본 테이블 파싱/렌더링
2. 테이블 셀 내 인라인 스타일
3. 웹 링크 파싱 및 새 창 열기
4. 파일 경로 링크 파싱 및 핸들러 호출
5. 혼합 콘텐츠 (테이블 + 링크 + 기존 요소)
6. 텍스트 선택 가능 여부
