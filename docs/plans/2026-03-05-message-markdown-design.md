# 메시지 마크다운 렌더링 설계

## 개요

Estelle 클라이언트의 Assistant 메시지에 마크다운 렌더링 기능을 추가한다.
현재는 평문으로만 표시되어 코드 블록, 표 등이 깨지는 문제가 있다.

## 요구사항

- **적용 범위**: Assistant 메시지만 (User 메시지는 평문 유지)
- **코드 블록**: 화면 너비 유지, 내부에서만 가로 스크롤
- **스트리밍**: 실시간 마크다운 렌더링 (열린 코드 블록은 스타일 유지)

## 지원 서식

기존 `MarkdownViewer.tsx` 기준:
- 제목: `#`, `##`, `###`, `####`
- 강조: `**bold**`, `*italic*`, `` `code` ``
- 코드 블록: ` ``` ` (언어 표시 포함)
- 목록: `-`, `*`, `1.`
- 인용: `>`
- 구분선: `---`, `***`, `___`

## 아키텍처

```
packages/client/src/
├── lib/
│   └── markdown.tsx (NEW) ← 파싱/렌더링 로직 분리
├── components/
│   ├── chat/
│   │   ├── MessageBubble.tsx ← MarkdownContent 사용
│   │   └── StreamingBubble.tsx ← MarkdownContent 사용 (커서 포함)
│   └── viewers/
│       └── MarkdownViewer.tsx ← markdown.tsx import로 변경
```

## 핵심 컴포넌트

### markdown.tsx

**Export**:
- `parseMarkdown(content: string): ParsedElement[]` - 마크다운 파싱
- `renderInlineStyles(text: string): ReactNode` - 인라인 스타일 렌더링
- `MarkdownElement` - 요소별 렌더링 컴포넌트
- `MarkdownContent` - 메시지용 마크다운 렌더링 컴포넌트

**MarkdownContent Props**:
```tsx
interface MarkdownContentProps {
  content: string;
  showCursor?: boolean; // 스트리밍용 커서 표시
}
```

### 코드 블록 스타일

```css
.code-block {
  overflow-x: auto;      /* 내부 가로 스크롤 */
  max-width: 100%;       /* 부모 너비 유지 */
  white-space: pre;      /* 줄바꿈 방지 */
}
```

### 스트리밍 처리

- 열린 코드 블록(``` 닫히지 않음): 코드 블록 스타일 유지하며 계속 렌더링
- 커서(▋): 마지막 요소 뒤에 표시

## 변경 파일

1. `lib/markdown.tsx` - 새 파일, 파싱/렌더링 로직
2. `components/chat/MessageBubble.tsx` - MarkdownContent 적용
3. `components/chat/StreamingBubble.tsx` - MarkdownContent 적용 (커서 옵션)
4. `components/viewers/MarkdownViewer.tsx` - markdown.tsx import로 리팩토링
