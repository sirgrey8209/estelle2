# UX 정리 작업

## 작업 일시
2026-02-03

## 변경 사항

### 1. 워크스페이스 사이드바 개선
- **3단계 → 2단계 구조로 단순화**: Pylon → Workspace → Conversation에서 Workspace(Pylon 아이콘 포함) → Conversation으로
- **Device Config Store**: Device ID ↔ 아이콘/이름 매핑을 클라이언트에서 관리
  - Device 1: Office (`office-building-outline`)
  - Device 2: Home (`home-outline`)
- **워크스페이스 카드 스타일**: Surface로 감싸고 라운딩 처리
  - 선택된 워크스페이스: `elevation.level3` + `outlineVariant` border
  - 선택 안된 워크스페이스: `elevation.level1`
- **대화 선택 표시**: `primaryContainer` 배경 + `onPrimaryContainer` 텍스트
- **열기/닫기 애니메이션**: Reanimated 4 CSS Transitions 사용 (`Collapsible` 컴포넌트)
- **워크스페이스 선택**: 항상 하나는 열려있음, 닫힌 워크스페이스에서도 선택된 대화 표시
- **+ 새 대화 버튼**: 열린 워크스페이스 하단에 표시
- **+ 워크스페이스 추가**: FAB 대신 목록 하단에 dashed border 스타일 버튼
- **StatusDot**: 대화명 옆에서 오른쪽으로 이동

### 2. 헤더 통합 (AppHeader)
- **데스크탑/모바일 공용**: `AppHeader` 컴포넌트로 통합
- **높이**: 44px (컴팩트)
- **색상**: `primaryContainer` 배경 + `onPrimaryContainer` 텍스트/아이콘
- **좌측**: Estelle + 버전
- **우측**: Pylon 상태 아이콘 + 설정 버튼 (`menu`)
- **Pylon 상태 아이콘**:
  - Relay 연결 안됨: `cloud-off-outline` (error 색상)
  - Relay O, Pylon 없음: `monitor-off`
  - Pylon 연결됨: 각 Pylon별 아이콘 (home-outline, office-building-outline 등)

### 3. 채팅 헤더 (ChatHeader)
- **색상**: `secondaryContainer` 배경 + `onSecondaryContainer` 텍스트/아이콘
- **레이아웃**: 대화명(좌) + 워크스페이스 아이콘/이름(우, 작게) - 한 줄
- **모바일**: 뒤로 가기 버튼 (`arrow-left`) 추가
- **세션 메뉴**: 데스크탑/모바일 모두 표시
- **StatusDot 제거**: 헤더에서 제거
- **SelectedConversation에 pylonId 추가**: 아이콘 표시용

### 4. 입력 바 (InputBar)
- **색상**: `secondaryContainer` 배경
- **+ 버튼**: `onSecondaryContainer` 색상, 크기 축소 (18px, 32x32)
- **전송 버튼**: `secondary` 배경 + `onSecondary` 아이콘, 크기 통일
- **메시지 입력창**:
  - `mode="flat"`, `surface` 배경, `borderRadius: 8`
  - 자동 높이 조절 (`onContentSizeChange` 사용)
  - 최소 36px, 최대 140px (약 6줄)
  - 스크롤: 최대 높이 도달 시에만 활성화
  - **스크롤바 상시 표시**: 8px 너비, 반투명 흰색
- **키보드 동작**:
  - 데스크탑: Enter = 전송, Shift/Ctrl+Enter = 줄바꾸기
  - 모바일: Enter = 줄바꾸기, 전송은 버튼

### 5. 기타
- **MobileSubHeader, MobileTopBar, DesktopHeader 제거**: AppHeader로 통합
- **경로(workingDir) 표시 제거**: 채팅 헤더에서 삭제
- **아이콘 샘플 페이지**: `/icons` 라우트 추가 (디버그용)
- **색상 팔레트 페이지**: `/colors` 라우트 추가 (디버그용)

## 수정된 파일
- `packages/client/global.css`
- `packages/client/src/stores/deviceConfigStore.ts`
- `packages/client/src/stores/workspaceStore.ts`
- `packages/client/src/components/sidebar/WorkspaceSidebar.tsx`
- `packages/client/src/components/sidebar/ConversationItem.tsx`
- `packages/client/src/components/common/Collapsible.tsx` (신규)
- `packages/client/src/layouts/AppHeader.tsx` (신규)
- `packages/client/src/layouts/DesktopLayout.tsx`
- `packages/client/src/layouts/MobileLayout.tsx`
- `packages/client/src/components/chat/ChatHeader.tsx`
- `packages/client/src/components/chat/ChatArea.tsx`
- `packages/client/src/components/chat/InputBar.tsx`
- `packages/client/src/components/debug/ColorPalette.tsx` (신규)
- `packages/client/src/components/debug/IconSamples.tsx` (신규)
- `packages/client/app/colors.tsx` (신규)
- `packages/client/app/icons.tsx` (신규)

## 테스트 수정
- `packages/client/src/stores/deviceConfigStore.test.ts`: 기본 아이콘 값 변경 ('🖥️' → 'monitor')
