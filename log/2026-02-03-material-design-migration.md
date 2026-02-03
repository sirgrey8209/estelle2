# Material Design 3 마이그레이션 완료

## 개요

NativeWind(Tailwind CSS) 기반 UI를 React Native Paper (Material Design 3)로 전환 완료.

## 변경사항

### 테마 설정

- `src/theme/index.ts` 생성
- MD3DarkTheme 기반
- `roundness: 2` (MD3 기본값 4의 절반)
- `semanticColors` 정의 (success, warning, info - MD3에 없는 색상)
- `statusColors` 정의 (Claude 상태 표시용)

### 변환된 컴포넌트 (40+개)

**Dialog 컴포넌트**
- BugReportDialog, NewConversationDialog, NewWorkspaceDialog
- SettingsDialog, DeployDialog, FileViewer

**Chat 컴포넌트**
- InputBar, MessageBubble, ToolCard, MessageList
- StreamingBubble, UploadingBubble, ResultInfo
- SystemDivider, WorkingIndicator, FileAttachmentCard
- ChatArea, ChatHeader

**Sidebar 컴포넌트**
- WorkspaceSidebar, ConversationItem, StatusDot

**Layout 컴포넌트**
- DesktopLayout, DesktopHeader
- MobileLayout, MobileTopBar, MobileSubHeader

**Settings 컴포넌트**
- SettingsScreen, ClaudeUsageCard
- DeploySection, DeployStatusCard, AppUpdateSection

**Request 컴포넌트**
- RequestBar, PermissionRequest, QuestionRequest

**Common 컴포넌트**
- SessionMenuButton, LoadingOverlay

**Viewer 컴포넌트**
- MarkdownViewer, FileViewer, ImageViewer, TextViewer

### 제거된 것

- 모든 NativeWind `className` 속성
- 하드코딩된 hex 색상 (#으로 시작하는 색상)
- 커스텀 `spacing` 상수

### 사용된 Paper 컴포넌트

- `PaperProvider`, `useTheme`
- `Surface`, `Card`, `Dialog`, `Portal`
- `Button`, `IconButton`, `FAB`
- `TextInput`, `Text`
- `List.Item`, `List.Section`
- `Appbar`, `Menu`
- `ActivityIndicator`, `ProgressBar`
- `Chip`, `RadioButton`

## 테스트 결과

- 497개 테스트 모두 통과
- 웹 개발 서버 정상 동작 (localhost:10000)

## 파일 구조

```
src/theme/
  index.ts          # 테마 정의 (MD3DarkTheme + semanticColors)

app/
  _layout.tsx       # PaperProvider 래핑

components/
  chat/             # 채팅 관련 (11개)
  sidebar/          # 사이드바 관련 (5개)
  layouts/          # 레이아웃 (5개)
  settings/         # 설정 (5개)
  requests/         # 요청 (3개)
  common/           # 공통 (4개)
  viewers/          # 뷰어 (4개)
  deploy/           # 배포 (1개)
```

## 참고

- React Native Paper 문서: https://reactnativepaper.com/
- Material Design 3: https://m3.material.io/
