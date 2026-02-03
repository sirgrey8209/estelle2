# AutoResizeTextInput

## 구현 목표
1~6줄은 높이가 자동 조절되고, 6줄 초과 시 스크롤되는 멀티라인 텍스트 입력 컴포넌트

## 구현 방향
React Native 기본 TextInput 사용 (Paper TextInput의 multiline 기본 2줄 문제 해결)

```typescript
// 핵심 로직
const contentHeight = event.nativeEvent.contentSize.height;
const clampedHeight = Math.min(maxHeight, Math.max(minHeight, contentHeight));
const scrollEnabled = contentHeight > maxHeight;
```

- `onContentSizeChange`로 콘텐츠 높이 감지
- MIN(1줄) ~ MAX(6줄) 범위에서 자동 리사이징
- MAX 초과 시에만 `scrollEnabled = true`
- Android: `textAlignVertical: 'top'` 자동 적용

## 테스트 케이스 (24개)

### 기본 렌더링 (4개)
- 1줄 높이로 렌더링
- placeholder 표시
- 초기 value 렌더링
- 기본 multiline 활성화

### 텍스트 입력 (3개)
- onChangeText 호출
- 기본 editable 상태
- editable=false 동작

### 높이 자동 조절 (5개)
- minLines=1 최소 높이
- minLines=2 최소 높이
- onContentSizeChange로 높이 증가
- maxLines 초과 시 높이 제한
- 커스텀 maxLines 적용

### 스크롤 동작 (3개)
- maxLines 이내 스크롤 비활성화
- maxLines 초과 스크롤 활성화
- 경계값 스크롤 활성화

### 플랫폼별 동작 (1개)
- Android textAlignVertical='top'

### 엣지 케이스 (6개)
- 빈 문자열, 긴 단일 라인, 줄바꿈만, 빠른 변경, minLines===maxLines, height=0

### 스타일 Props (2개)
- 커스텀 style 적용
- 컴포넌트 로직 height 우선

## 파일
- 테스트: `packages/client/src/components/common/AutoResizeTextInput.test.tsx`
- 구현: `packages/client/src/components/common/AutoResizeTextInput.tsx`
- 통합: `packages/client/src/components/chat/InputBar.tsx`

## 진행 로그
- [260203 15:30] 1-PLAN 시작
- [260203 15:35] 1-PLAN 승인, 2-TEST 시작
- [260203 15:45] 2-TEST 완료 - 24개 테스트 케이스 작성
- [260203 16:05] 3-VERIFY 통과
- [260203 16:10] 4-IMPL 완료 (24개 테스트 통과)
- [260203 16:20] InputBar 통합 완료

## 미해결
- 웹에서 스크롤바 표시 안 됨 (기능 동작은 정상)
