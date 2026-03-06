# FilePathLink 컴포넌트 설계

## 개요

파일 경로를 클릭 가능한 링크로 표시하는 재사용 컴포넌트. 클릭 시 Estelle FileViewer로 파일 내용을 표시한다.

## 배경

현재 상태:
- `send_file` MCP 도구만 클릭 가능한 파일 링크 제공
- Read/Write/Edit 도구는 파일 경로를 일반 텍스트로 표시
- 사용자가 파일을 확인하려면 수동으로 경로를 복사해서 열어야 함

목표:
- 모든 파일 관련 도구에서 일관된 클릭 가능 파일 경로 제공
- 기존 `send_file`도 동일한 컴포넌트 사용으로 통일

## 설계

### FilePathLink 컴포넌트

```tsx
interface FilePathLinkProps {
  path: string;           // 파일 절대 경로
  label?: string;         // 표시 텍스트 (기본: 파일명)
  description?: string;   // 파일 설명 (선택)
  size?: number;          // 파일 크기 (선택)
  className?: string;     // 추가 스타일
}
```

### 기능
- 파일 타입에 따른 아이콘 표시 (🖼️ 이미지, 📝 마크다운, 📄 기본)
- 클릭 시 FileViewer로 파일 열기
- hover 시 시각적 피드백
- 파일 크기 표시 (제공된 경우)

### 적용 대상

| 도구 | 현재 | 변경 후 |
|------|------|---------|
| Read | `renderSpecialTool('Read', fileName, filePath)` | filePath → `<FilePathLink>` |
| Write | `<p>{filePath}</p>` | `<FilePathLink path={filePath} />` |
| Edit | `<p>{filePath}</p>` | `<FilePathLink path={filePath} />` |
| send_file | 커스텀 버튼 | `<FilePathLink path={file.path} label={file.description} size={file.size} />` |

### 클릭 핸들러 연결

현재 구조:
```
ToolCard (onMcpFileClick)
  ← MessageBubble
    ← MessageList (handleMcpFileClick)
      → blobService.requestFile()
        → FileViewer
```

변경:
- `ToolCard`에 `onFilePathClick?: (path: string) => void` prop 추가
- `MessageList`에서 path를 받아 `McpFileInfo` 형태로 변환 후 기존 로직 재사용

### 파일 구조

```
packages/estelle/src/renderer/components/
├── FilePathLink.tsx          # 새 컴포넌트
└── message/
    └── ToolCard.tsx          # 수정: FilePathLink 사용
```

## 구현 범위

1. `FilePathLink.tsx` 컴포넌트 생성
2. `ToolCard.tsx` 수정
   - Read/Write/Edit에서 FilePathLink 사용
   - send_file에서 FilePathLink 사용
3. `MessageBubble.tsx` 수정: onFilePathClick prop 전달
4. `MessageList.tsx` 수정: handleFilePathClick 핸들러 추가

## 테스트 계획

- FilePathLink 컴포넌트 단위 테스트
- Read/Write/Edit/send_file 각각에서 클릭 동작 확인
- 다양한 파일 타입(이미지, 텍스트, 마크다운)에서 아이콘 및 뷰어 동작 확인
