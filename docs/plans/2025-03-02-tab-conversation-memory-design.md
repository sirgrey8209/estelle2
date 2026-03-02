# 탭별 선택 대화 기억 기능

## 개요

Pylon 탭(또는 즐겨찾기 탭)을 전환할 때 해당 탭에서 마지막으로 선택했던 대화를 자동으로 선택하는 기능.

## 요구사항

1. 탭 전환 시 해당 탭의 마지막 선택 대화로 자동 전환
2. 저장된 대화가 삭제되었거나 없으면 해당 탭의 첫 번째 대화 선택
3. Pylon 탭 + 즐겨찾기 탭 모두 지원

## 저장 구조

```typescript
// localStorage key: 'estelle:tabSelectedConversation'
// value: { [PylonTabValue]: conversationId }
// 예: { 'favorites': 3, '1': 2, '2': 7 }
```

## 변경 범위

### WorkspaceSidebar.tsx

1. **새 localStorage 키 추가**
   - `TAB_CONVERSATION_STORAGE_KEY = 'estelle:tabSelectedConversation'`

2. **탭별 대화 저장/로드 함수**
   - `loadTabConversations(): Record<string, number>`
   - `saveTabConversation(tab: PylonTabValue, conversationId: number)`

3. **handleTabChange 수정**
   - 탭 전환 시 저장된 대화 ID 조회
   - 해당 대화가 존재하면 선택
   - 없으면 탭 내 첫 번째 대화 선택

4. **handleConversationSelect 수정**
   - 대화 선택 시 현재 탭에 해당 대화 ID 저장

## 상세 동작

### 탭 전환 시 (handleTabChange)

```
1. 새 탭의 저장된 conversationId 조회
2. 해당 대화가 새 탭의 워크스페이스에 존재하는지 확인
3. 존재하면 → 해당 대화 선택 (selectConversation 호출)
4. 존재하지 않으면 → 새 탭의 첫 번째 대화 선택
```

### 대화 선택 시 (handleConversationSelect)

```
1. 기존 로직 수행
2. 현재 selectedTab에 선택된 conversationId 저장
```
