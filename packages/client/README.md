# @estelle/client

Estelle의 React 웹 클라이언트입니다.

## 개요

모던 웹 클라이언트로서:

- **채팅 인터페이스** - Claude와 실시간 대화
- **워크스페이스 관리** - 프로젝트별 대화 정리
- **파일 전송** - 이미지와 파일을 Claude에게 전송
- **PWA 지원** - 모바일에서 네이티브 앱처럼 설치

## 기술 스택

- **React 18** - UI 프레임워크
- **Vite** - 빠른 개발 서버 및 번들러
- **Tailwind CSS** - 유틸리티 기반 스타일링
- **shadcn/ui** - 아름답고 접근성 높은 컴포넌트
- **Zustand** - 가벼운 상태 관리
- **TypeScript** - 타입 안전성

## 기능

### 채팅

- 실시간 스트리밍 응답
- Markdown 렌더링 및 구문 강조
- 도구 사용 시각화
- 이미지 첨부

### 워크스페이스

- 워크스페이스 생성/수정/삭제
- 대화 정리
- 빠른 워크스페이스 전환

### 모바일

- 반응형 디자인
- PWA 설치 가능
- 터치 친화적 인터랙션

## 개발

```bash
# 개발 서버 시작
pnpm dev

# 프로덕션 빌드
pnpm build

# 빌드 결과 미리보기
pnpm preview

# 타입 체크
pnpm typecheck
```

## 프로젝트 구조

```
src/
├── components/     # React 컴포넌트
│   ├── ui/        # shadcn/ui 컴포넌트
│   ├── chat/      # 채팅 관련 컴포넌트
│   └── workspace/ # 워크스페이스 컴포넌트
├── stores/        # Zustand 스토어
├── hooks/         # 커스텀 React 훅
├── lib/           # 유틸리티
└── App.tsx        # 루트 컴포넌트
```

## 환경

클라이언트는 런타임에 Relay URL을 결정합니다:

- `localhost` → `ws://localhost:3000` (dev)
- 그 외 → `wss://${window.location.host}` (production)

Relay URL을 위한 빌드 타임 환경 변수가 필요 없습니다.

## 빌드

클라이언트는 빌드 후 Relay에서 서빙됩니다:

```bash
# 클라이언트 빌드 (relay/public으로 출력)
pnpm build

# 또는 전체 프로젝트 빌드
pnpm --filter @estelle/relay build
```

## UI 컴포넌트

커스텀 테마가 적용된 shadcn/ui 사용:

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function MyComponent() {
  return (
    <div>
      <Input placeholder="메시지를 입력하세요..." />
      <Button>전송</Button>
    </div>
  );
}
```
