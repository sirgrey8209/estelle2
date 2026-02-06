# UI 버그 수정 및 개선 (2026-02-05)

## 작업 요약

Vite 마이그레이션 이후 발견된 UI 버그들 일괄 수정 및 테마 개선

---

## 변경 사항

### 1. 색상 테마 변경

**파일**: `packages/client/src/index.css`

Blue/Slate 테마 → Claude.ai 스타일 (따뜻한 크림톤 + Sky Blue)

```css
:root {
  --background: 40 30% 97%;      /* 크림 배경 */
  --primary: 199 85% 52%;        /* Sky Blue */
  --accent: 24 95% 66%;          /* 테라코타 액센트 */
}
```

- 선택된 대화 글자색 검은색으로 변경

### 2. 퍼미션 버튼 동작 연결

**파일**:
- `packages/client/src/components/chat/ChatHeader.tsx`
- `packages/client/src/stores/workspaceStore.ts`
- `packages/pylon/src/pylon.ts`

변경 내용:
- `SelectedConversation`에 `permissionMode` 필드 추가
- `updatePermissionMode` 액션 추가
- `SessionMenuButton`과 퍼미션 모드 연결
- Pylon에서 퍼미션 변경 시 저장하도록 수정

### 3. AskUserQuestion UI 버그 수정

**파일**: `packages/client/src/stores/claudeStore.ts`

문제: Claude SDK에서 `askQuestion` 이벤트가 오는데 UI에 표시 안됨
원인: 이벤트 타입 불일치 (`askQuestion` vs `ask_question`)
해결: 두 형식 모두 처리하도록 수정

```typescript
case 'askQuestion':
case 'ask_question': {
  // 두 형식 모두 처리
}
```

### 4. 모바일 레이아웃 버그 수정

**파일**:
- `packages/client/src/layouts/MobileLayout.tsx`
- `packages/client/src/components/sidebar/WorkspaceSidebar.tsx`

문제들:
1. 화면이 빈 상태로 표시됨
2. 사이드바로 가면 자동으로 채팅창으로 돌아옴
3. 선택된 대화 클릭해도 채팅창으로 안 감

해결:
1. `-translate-x-full` → `-translate-x-1/2` (200% 컨테이너에서)
2. 이전 conversationId 추적하여 새 선택 시에만 이동
3. `closeSidebar()` 호출 추가

### 5. 디바이스 아이콘 매핑 수정

**파일**: `packages/client/src/utils/device-icons.ts`

문제: 워크스페이스 헤더와 채팅창에 아이콘 표시 안됨
원인: 이모지 문자열 반환 → React 컴포넌트로 사용 시도
해결: Lucide 아이콘 컴포넌트 반환하도록 변경

```typescript
const ICON_MAP: Record<string, LucideIcon> = {
  'office-building-outline': Building2,
  'home-outline': Home,
  'monitor': Monitor,
  'pylon': Monitor,
  'desktop': Laptop,
};
```

---

## 테스트

### 추가된 테스트
- `packages/pylon/tests/pylon.test.ts`: 퍼미션 모드 흐름 테스트 3개
- `packages/client/src/utils/device-icons.test.ts`: 아이콘 매핑 테스트 업데이트

### 테스트 결과
```
✓ Core:    201 tests
✓ Relay:   162 tests
✓ Pylon:   32 tests (+3)
✓ Client:  161 tests (+3)
─────────────────────
  Total: 556 tests passing
```

---

## 영향 범위

| 기능 | 상태 |
|------|------|
| 색상 테마 | ✅ 적용됨 |
| 퍼미션 버튼 | ✅ 동작함 |
| 질문 UI | ✅ 표시됨 |
| 모바일 레이아웃 | ✅ 정상 동작 |
| 디바이스 아이콘 | ✅ 표시됨 |
