# 앱 크래시: 워크스페이스 로드 중 죽음

## 현상
- 앱 설치 후 실행 시 워크스페이스 불러오다가 크래시 발생
- 웹에서는 문제 없음 (개발 서버에서 테스트 시)

## 시도한 수정

### 1차 시도: useMessageRouter에서 selectConversation 추가 호출
```typescript
// 문제: setWorkspaces 호출 후 별도로 selectConversation 호출
if (isFirstLoad && activeWorkspaceId && activeConversationId) {
  useWorkspaceStore.getState().selectConversation(pylonId, activeWorkspaceId, activeConversationId);
  selectConversation(activeWorkspaceId, activeConversationId);
}
```
- 결과: 크래시 해결 안됨

### 2차 시도: setWorkspaces에 activeInfo 파라미터 추가
```typescript
// workspaceStore.ts
setWorkspaces: (pylonId, workspaces, activeInfo?) => {
  // activeInfo가 있으면 서버의 active 대화 선택
  // 없으면 기존 로직 (첫 번째 대화 자동 선택)
}

// useMessageRouter.ts
const activeInfo = activeWorkspaceId && activeConversationId
  ? { workspaceId: activeWorkspaceId, conversationId: activeConversationId }
  : undefined;
useWorkspaceStore.getState().setWorkspaces(pylonId, workspaces || [], activeInfo);
```
- 결과: 테스트 통과, 크래시 해결 안됨

## 추정 원인

1. **React Native 릴리즈 빌드 특유의 문제**
   - 개발 빌드에서는 에러가 로그만 출력되고 앱 계속 동작
   - 릴리즈 빌드에서는 에러 시 크래시

2. **의심 지점**
   - workspaceStore 상태 업데이트 중 문제?
   - WebSocket 연결 관련?
   - 메시지 라우팅 중 undefined 접근?

## 디버깅 필요 사항

1. **로그캣 확인** (Android)
   ```bash
   adb logcat | grep -E "(ReactNative|estelle)"
   ```

2. **Sentry 등 크래시 리포팅 추가 고려**

3. **릴리즈 빌드에서 디버그 모드 활성화**
   ```javascript
   // android/app/build.gradle
   buildTypes {
     release {
       debuggable true  // 임시로 디버깅 활성화
     }
   }
   ```

## 관련 파일
- `packages/client/src/hooks/useMessageRouter.ts`
- `packages/client/src/stores/workspaceStore.ts`
- `packages/pylon/src/pylon.ts` (workspace_list_result 전송)

## 버전
- v2.1.0, v2.1.1 모두 크래시 발생
