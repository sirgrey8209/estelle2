# Vite 마이그레이션 체크리스트

React Native → React (shadcn/ui) 컴포넌트 마이그레이션

## 상태
✅ 완료

---

## 우선순위 1: 핵심 기능 (26개)

### sidebar/ (4개)
- [x] WorkspaceSidebar.tsx - 워크스페이스/대화 목록
- [x] ConversationItem.tsx - 대화 항목
- [x] NewWorkspaceDialog.tsx - 워크스페이스 추가
- [x] NewConversationDialog.tsx - 대화 추가

### chat/ (12개)
- [x] ChatArea.tsx - 채팅 영역 메인
- [x] ChatHeader.tsx - 채팅 헤더
- [x] InputBar.tsx - 메시지 입력
- [x] MessageList.tsx - 메시지 목록
- [x] MessageBubble.tsx - 메시지 버블
- [x] StreamingBubble.tsx - 스트리밍 메시지
- [x] ToolCard.tsx - 도구 실행 카드
- [x] WorkingIndicator.tsx - 작업 중 표시
- [x] SystemDivider.tsx - 시스템 구분선
- [x] ResultInfo.tsx - 결과 정보
- [x] FileAttachmentCard.tsx - 파일 첨부 카드
- [x] UploadingBubble.tsx - 업로드 중 표시

### requests/ (3개)
- [x] RequestBar.tsx - 요청 바
- [x] PermissionRequest.tsx - 권한 요청
- [x] QuestionRequest.tsx - 질문 요청

### layouts/ (7개)
- [x] ResponsiveLayout.tsx - 반응형 레이아웃
- [x] DesktopLayout.tsx - 데스크탑 레이아웃
- [x] MobileLayout.tsx - 모바일 레이아웃
- [x] AppHeader.tsx - 앱 헤더

---

## 우선순위 2: 공통 컴포넌트 (12개)

### common/ (8개)
- [x] LoadingOverlay.tsx - 로딩 오버레이
- [x] Collapsible.tsx - 접기/펼치기
- [x] StatusDot.tsx - 상태 점
- [x] BugReportDialog.tsx - 버그 리포트
- [x] SessionMenuButton.tsx - 세션 메뉴 버튼
- [x] AutoResizeTextInput.tsx - 자동 크기 입력
- [x] ThemedFlatList.tsx - 리스트
- [x] ThemedScrollView.tsx - 스크롤뷰

### viewers/ (4개)
- [x] MarkdownViewer.tsx - 마크다운 뷰어
- [x] TextViewer.tsx - 텍스트 뷰어
- [x] FileViewer.tsx - 파일 뷰어
- [x] ImageViewer.tsx - 이미지 뷰어

---

## 우선순위 3: 설정/기타 (8개)

### settings/ (6개)
- [x] SettingsScreen.tsx - 설정 화면
- [x] SettingsDialog.tsx - 설정 다이얼로그
- [x] ClaudeUsageCard.tsx - Claude 사용량
- [x] DeployStatusCard.tsx - 배포 상태
- [x] DeploySection.tsx - 배포 섹션
- [x] AppUpdateSection.tsx - 앱 업데이트

### deploy/ (1개)
- [ ] DeployDialog.tsx - 배포 다이얼로그 (설정에 통합됨)

### task/ (1개)
- [ ] TaskDetailView.tsx - 태스크 상세 (사용 안 함)

---

## 제외 (2개)
- debug/ColorPalette.tsx - 개발용
- debug/IconSamples.tsx - 개발용

---

## 총계: 46개 → 42개 완료

## 마이그레이션 완료 사항

1. **React Native → Web 변환**
   - `View` → `div`
   - `Text` → `span` / `p`
   - `ScrollView` → `div` with overflow
   - `Pressable` → `button` / `div` with onClick
   - `FlatList` → `map()` 렌더링

2. **React Native Paper → shadcn/ui**
   - `Button` → `components/ui/button`
   - `TextInput` → `components/ui/input` or `textarea`
   - `Dialog` → `components/ui/dialog`
   - `Surface` → `components/ui/card`
   - `IconButton` → `Button` with `lucide-react` icon

3. **아이콘**
   - `react-native-vector-icons` → `lucide-react`

4. **스타일**
   - StyleSheet → Tailwind CSS classes
   - `useTheme()` → CSS 변수 (이미 설정됨)

5. **테마**
   - `theme/index.ts` - CSS 변수 기반으로 변환
