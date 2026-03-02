# Tab Conversation Memory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 탭 전환 시 해당 탭에서 마지막으로 선택했던 대화를 자동으로 선택

**Architecture:** localStorage에 탭별 마지막 선택 대화 ID를 저장. 탭 전환 시 저장된 대화로 전환하고, 없으면 탭 내 첫 번째 대화 선택.

**Tech Stack:** React, Zustand, localStorage

---

### Task 1: localStorage 헬퍼 함수 추가

**Files:**
- Modify: `packages/client/src/components/sidebar/WorkspaceSidebar.tsx:49` (TAB_STORAGE_KEY 다음)

**Step 1: 새 localStorage 키와 헬퍼 함수 추가**

`TAB_STORAGE_KEY` 상수 아래에 다음 코드를 추가:

```typescript
/** 탭별 선택된 대화 localStorage 키 */
const TAB_CONVERSATION_STORAGE_KEY = 'estelle:tabSelectedConversation';

/**
 * 탭별 저장된 대화 ID를 로드
 */
function loadTabConversations(): Record<string, number> {
  try {
    const saved = localStorage.getItem(TAB_CONVERSATION_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/**
 * 특정 탭의 대화 ID를 저장
 */
function saveTabConversation(tab: PylonTabValue, conversationId: number): void {
  try {
    const current = loadTabConversations();
    current[String(tab)] = conversationId;
    localStorage.setItem(TAB_CONVERSATION_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // 무시
  }
}
```

**Step 2: Commit**

```bash
git add packages/client/src/components/sidebar/WorkspaceSidebar.tsx
git commit -m "feat(sidebar): add localStorage helpers for tab conversation memory"
```

---

### Task 2: handleConversationSelect에서 탭별 대화 저장

**Files:**
- Modify: `packages/client/src/components/sidebar/WorkspaceSidebar.tsx:576-590` (handleConversationSelect)

**Step 1: handleConversationSelect 수정**

기존 `handleConversationSelect` 콜백에 `saveTabConversation` 호출을 추가:

```typescript
  // 대화 선택 핸들러
  const handleConversationSelect = useCallback((workspace: WorkspaceWithPylon, conversation: Conversation) => {
    // workspaceStore에서 대화 선택 (conversationId 사용)
    selectInStore(
      workspace.pylonId,
      conversation.conversationId
    );

    // conversationStore에서 현재 대화 설정 (conversationId 사용)
    useConversationStore.getState().setCurrentConversation(conversation.conversationId);

    // Pylon에 대화 선택 알림 (히스토리 로드 요청) - conversationId 사용
    selectConversation(conversation.conversationId);

    // 현재 탭에 선택된 대화 저장
    saveTabConversation(selectedTab, conversation.conversationId);

    closeSidebar();
  }, [selectInStore, closeSidebar, selectedTab]);
```

**Step 2: Commit**

```bash
git add packages/client/src/components/sidebar/WorkspaceSidebar.tsx
git commit -m "feat(sidebar): save selected conversation per tab"
```

---

### Task 3: handleTabChange에서 저장된 대화로 전환

**Files:**
- Modify: `packages/client/src/components/sidebar/WorkspaceSidebar.tsx:444-451` (handleTabChange)

**Step 1: handleTabChange 수정**

탭 전환 시 저장된 대화로 전환하는 로직을 추가. `handleTabChange`는 `flatWorkspaces`와 `favoriteWorkspaces`, `isFavorite`에 의존하므로 이들을 참조해야 함.

먼저 `handleTabChange`를 `filteredWorkspaces` memo 이후로 이동하고, 다음과 같이 수정:

```typescript
  // 탭 변경 핸들러
  const handleTabChange = useCallback((tab: PylonTabValue) => {
    setSelectedTab(tab);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(tab));
    } catch {
      // 무시
    }

    // 새 탭의 워크스페이스 목록 계산
    const newTabWorkspaces = tab === 'favorites'
      ? flatWorkspaces.filter((ws) => isFavorite(ws.workspaceId))
      : flatWorkspaces.filter((ws) => ws.pylonId === tab);

    if (newTabWorkspaces.length === 0) return;

    // 저장된 대화 ID 조회
    const savedConversations = loadTabConversations();
    const savedConvId = savedConversations[String(tab)];

    // 저장된 대화가 새 탭에 존재하는지 확인
    let targetWorkspace: WorkspaceWithPylon | undefined;
    let targetConversation: Conversation | undefined;

    if (savedConvId !== undefined) {
      for (const ws of newTabWorkspaces) {
        const conv = ws.conversations.find((c) => c.conversationId === savedConvId);
        if (conv) {
          targetWorkspace = ws;
          targetConversation = conv;
          break;
        }
      }
    }

    // 저장된 대화가 없으면 첫 번째 대화 선택
    if (!targetWorkspace || !targetConversation) {
      targetWorkspace = newTabWorkspaces[0];
      targetConversation = targetWorkspace.conversations[0];
    }

    if (targetWorkspace && targetConversation) {
      // 대화 선택
      selectInStore(targetWorkspace.pylonId, targetConversation.conversationId);
      useConversationStore.getState().setCurrentConversation(targetConversation.conversationId);
      selectConversation(targetConversation.conversationId);
    }
  }, [flatWorkspaces, isFavorite, selectInStore]);
```

**Step 2: Commit**

```bash
git add packages/client/src/components/sidebar/WorkspaceSidebar.tsx
git commit -m "feat(sidebar): switch to saved conversation on tab change"
```

---

### Task 4: 수동 테스트

**Step 1: 개발 서버 실행**

```bash
cd packages/client && pnpm dev
```

**Step 2: 테스트 시나리오**

1. Pylon 탭1에서 대화 A 선택
2. Pylon 탭2로 전환 → 대화 B 선택
3. 탭1로 다시 전환 → 대화 A가 자동 선택되는지 확인
4. 즐겨찾기 탭에서 대화 C 선택
5. 다른 탭으로 갔다가 즐겨찾기 탭으로 돌아옴 → 대화 C가 선택되는지 확인
6. 저장된 대화 삭제 후 탭 전환 → 첫 번째 대화가 선택되는지 확인

**Step 3: Commit (최종)**

```bash
git add -A
git commit -m "feat(sidebar): complete tab conversation memory feature"
```
