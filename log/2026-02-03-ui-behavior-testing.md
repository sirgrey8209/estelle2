# UI 동작 테스트 (UI Behavior Testing)

> Store/Service 레벨 + 컴포넌트 렌더링 테스트 체계 완성

---

## 개요

React Native 앱의 UI 동작을 두 가지 레벨에서 검증하는 테스트 체계를 구축했습니다.

| 레벨 | 도구 | 테스트 수 | 설명 |
|------|------|---------|------|
| **Store/Service** | vitest | 118개 | 핵심 로직, 메시지 전송 검증 |
| **컴포넌트 렌더링** | jest + RNTL | 61개 | 실제 UI 렌더링, 사용자 인터랙션 |
| **합계** | | **179개** | |

---

## 테스트 구조

```
packages/client/
├── vitest.config.ts              # vitest 설정 (Store/Service)
├── jest.config.js                # jest 설정 (컴포넌트)
├── src/test/
│   ├── setupTests.ts             # vitest 환경 설정
│   ├── testUtils.tsx             # vitest Mock 팩토리
│   ├── jestSetup.ts              # jest 환경 설정
│   └── jestTestUtils.tsx         # jest Mock 팩토리
├── src/e2e/
│   ├── ui-behavior.test.ts       # UI 동작 테스트 (18개)
│   └── message-flow.test.ts      # 메시지 플로우 테스트 (8개)
└── src/components/
    ├── chat/
    │   ├── InputBar.test.tsx     # 42개 테스트
    │   └── ChatArea.test.tsx     # 12개 테스트
    ├── requests/
    │   └── RequestBar.test.tsx   # 25개 테스트
    └── sidebar/
        └── WorkspaceSidebar.test.tsx  # 13개 테스트
```

---

## 실행 방법

```bash
# Store/Service 레벨 테스트 (vitest)
pnpm --filter @estelle/client test

# 컴포넌트 렌더링 테스트 (jest)
pnpm --filter @estelle/client test:component

# watch 모드
pnpm --filter @estelle/client test:watch
pnpm --filter @estelle/client test:component:watch
```

---

## 테스트 커버리지

### Store/Service 레벨 (vitest)

| 파일 | 테스트 수 | 검증 내용 |
|------|---------|----------|
| ui-behavior.test.ts | 18개 | 메시지 전송, 상태 전환, 권한 처리 |
| message-flow.test.ts | 8개 | E2E 메시지 플로우 |
| claudeStore.test.ts | 17개 | Store 상태 관리 |
| relayService.test.ts | 9개 | WebSocket 통신 |
| 기타 Store/Hook | 66개 | 개별 기능 검증 |

### 컴포넌트 렌더링 (jest)

| 컴포넌트 | 테스트 수 | 검증 내용 |
|---------|---------|----------|
| InputBar | 42개 | 텍스트 입력, 전송, Stop, 이미지 첨부 |
| ChatArea | 12개 | 메시지 표시, 전송 플로우, 상태별 UI |
| RequestBar | 25개 | 권한 요청, 질문 응답, 상세 정보 토글 |
| WorkspaceSidebar | 13개 | 워크스페이스 목록, 대화 선택 |

---

## 기술 스택

### vitest (Store/Service)
- 빠른 실행 속도
- Node.js 환경에서 순수 로직 테스트
- RN 컴포넌트 렌더링 없이 동작

### jest + jest-expo + RNTL (컴포넌트)
- `jest-expo`: Expo 프로젝트용 Jest 프리셋
- `@testing-library/react-native`: 사용자 관점 테스트
- React Native 컴포넌트 실제 렌더링

---

## 주요 설정

### jest.config.js

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/test/jestSetup.ts'],
  testMatch: ['**/src/components/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|...)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@estelle/core$': '<rootDir>/../core/src/index.ts',
  },
};
```

### package.json 스크립트

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:component": "jest",
    "test:component:watch": "jest --watch"
  }
}
```

---

## 관련 파일

- `packages/client/vitest.config.ts` - vitest 설정
- `packages/client/jest.config.js` - jest 설정
- `packages/client/src/test/jestSetup.ts` - jest 환경 설정
- `packages/client/src/test/jestTestUtils.tsx` - jest Mock 유틸

---

*작성일: 2026-02-03*
*완료일: 2026-02-03*
