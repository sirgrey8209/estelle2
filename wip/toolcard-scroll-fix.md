# ToolCard 펼침 시 스크롤 위치 유지

## 문제
- ToolCard가 Collapsible로 펼쳐질 때 높이가 증가
- inverted FlatList에서 아이템 높이 변화 시 스크롤 위치가 밀림
- 카드가 위로 올라가는 것처럼 보임

## 원인
- inverted FlatList는 아래에서 위로 쌓임
- 아이템 높이가 변하면 그 위 아이템들이 밀림
- 스크롤 위치는 고정되어 있어서 시각적으로 점프

## 시도한 방법
- LayoutAnimation: 웹에서 동작 안 함
- Context로 FlatList ref 공유 + adjustScroll: 복잡도 높음

## 해결 방향 (미구현)
1. **Context 방식**: MessageListContext로 flatListRef 공유, ToolCard에서 펼침 시 delta만큼 scrollToOffset 조정
2. **maintainVisibleContentPosition**: FlatList prop이지만 inverted에서 동작 확인 필요
3. **onContentSizeChange**: 전체 컨텐츠 크기 변화 감지 후 스크롤 조정

## 관련 파일
- `packages/client/src/components/chat/ToolCard.tsx`
- `packages/client/src/components/chat/MessageList.tsx`
- `packages/client/src/components/common/Collapsible.tsx`
