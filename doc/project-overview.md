# Estelle2 프로젝트 개요

> Claude Code를 여러 PC와 모바일에서 원격 제어하는 시스템 (v2)

---

## 배경

### 원본 프로젝트 (estelle)

```
┌─────────────────────────────────────────────────────┐
│              Hetzner 서버 (5.223.72.58)             │
│                                                      │
│  ┌──────────┐    ┌──────────┐                       │
│  │  Pylon   │◄──►│  Relay   │◄────────┐             │
│  │ (PM2)    │    │ (PM2)    │         │             │
│  └──────────┘    └──────────┘         │             │
│       │                         WebSocket           │
│  Claude Code                          │             │
└───────────────────────────────────────┼─────────────┘
                                        │
              ┌─────────────────────────┼────────────┐
              │                         │            │
        ┌─────┴─────┐            ┌─────┴─────┐ ┌────┴────┐
        │  Client   │            │  Client   │ │ Client  │
        │ (브라우저)│            │ (모바일)  │ │ (다른PC)│
        └───────────┘            └───────────┘ └─────────┘
```

| 컴포넌트 | 역할 |
|----------|------|
| **Relay** | 순수 라우터 (인증 + 메시지 전달), PM2로 실행 |
| **Pylon** | 백그라운드 서비스, 상태 관리, Claude SDK 직접 통합, PM2로 실행 |
| **Client** | 웹 클라이언트 (PWA), 브라우저에서 동작 |

### 기존 설계 결정 (유지할 것들)

1. **Relay는 순수 라우터** - 메시지 내용 해석 안 함
2. **Pylon이 Single Source of Truth** - App은 표시만
3. **Session Viewer 시스템** - 보고 있는 대화에만 스트리밍
4. **Permission Mode 3단계** - default / acceptEdits / bypassPermissions
5. **Device ID 체계** - 고정(1-99: Pylon) / 동적(100+: App)
6. **로컬 연결 우선** - 같은 PC면 Relay 안 거침

---

## 문제점 (estelle v1)

### 1. 컨텍스트 크기 제한
- Claude Code가 프로젝트 전체를 한 번에 파악 불가
- 파일 간 관계, 의존성 파악 어려움

### 2. 회귀 버그
- 한 곳 수정 → 다른 곳에서 예상치 못한 버그
- 변경의 영향 범위 파악 불가

### 3. TDD 부재
- 테스트 없이 개발 → 변경 시 검증 불가
- 기존 구조가 테스트하기 어려운 형태
  - 단일 파일에 여러 책임
  - 의존성 하드코딩 → 모킹 어려움
  - 모듈 간 높은 결합도

---

## 해결 방향 (estelle2)

### TypeScript 도입

| 문제 | TypeScript가 주는 이점 |
|------|------------------------|
| 컨텍스트 제한 | 타입/인터페이스만 봐도 모듈 역할 파악 가능 |
| 회귀 버그 | 타입 에러로 **컴파일 시점**에 잡힘 |
| TDD 어려움 | 인터페이스 정의 → 모킹 쉬워짐 |

### TDD 방법론

- 테스트 먼저 작성 → 구현
- 모든 모듈은 테스트 가능한 단위로 분리
- 의존성 주입 패턴 적용

### 모노레포 구조

- 공유 타입을 `core` 패키지에서 관리
- 한 곳 수정 시 타입 에러로 영향 범위 즉시 파악

---

## 기술 스택

| 컴포넌트 | 기술 | 비고 |
|----------|------|------|
| **core** | TypeScript | 공유 타입, 메시지 스키마 |
| **Relay** | Node.js + TypeScript | PM2로 실행, 정적 파일 서빙 |
| **Pylon** | Node.js + TypeScript | PM2로 실행, Claude SDK 직접 통합, MCP 서버 |
| **Client** | React + Vite + shadcn/ui | Relay에서 서빙, PWA |
| **테스트** | Vitest | 빠르고 ESM 친화적 |
| **패키지 관리** | pnpm workspaces | 모노레포 |
| **배포** | Node.js 스크립트 | 크로스 플랫폼 (Windows/Linux) |

---

## 폴더 구조

```
estelle2/
├── packages/
│   ├── core/           # 공유 타입, 메시지 스키마
│   ├── relay/          # Relay 서버 (순수 라우터 + 정적 파일 서빙)
│   ├── pylon/          # Pylon 서비스 (상태 관리, Claude SDK, MCP 서버)
│   └── client/         # React 웹 클라이언트 (Vite + shadcn/ui)
├── config/             # 환경 설정 (environments.json)
├── doc/                # 설계 문서
├── wip/                # 진행 중 작업
├── log/                # 완료된 작업
├── scripts/            # 빌드/배포 스크립트
├── release/            # production 빌드
├── release-stage/      # staging 빌드
├── release-data/       # release 전용 데이터
└── stage-data/         # stage 전용 데이터
```

---

## 개발 계획

### 1단계: 프로젝트 스캐폴딩
- [ ] 모노레포 설정 (pnpm workspace)
- [ ] TypeScript 설정 (tsconfig)
- [ ] 테스트 프레임워크 설정 (Vitest)
- [ ] 린터/포매터 설정 (ESLint, Prettier)

### 2단계: core 패키지
- [ ] 메시지 타입 정의
- [ ] 공유 유틸리티

### 3단계: Relay 구현
- [ ] 인증 모듈 (TDD)
- [ ] 라우팅 모듈 (TDD)
- [ ] WebSocket 서버

### 4단계: Pylon 구현
- [ ] Claude SDK 래퍼 (TDD)
- [ ] 상태 관리 (TDD)
- [ ] 메시지 저장소 (TDD)

### 5단계: App 이전
- [ ] 기존 estelle-app 코드 이전
- [ ] core 타입과 동기화

---

## 설계 원칙

### Pylon 직접 SDK 통합 (2026-02-14)

각 Pylon이 Claude SDK를 직접 사용하는 단순한 구조입니다.

```
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Dev Pylon  │  │Stage Pylon │  │Release Pylon│
    │            │  │            │  │             │
    │ Claude SDK │  │ Claude SDK │  │ Claude SDK  │
    │ MCP Server │  │ MCP Server │  │ MCP Server  │
    └────────────┘  └────────────┘  └────────────┘
         :9878          :9877           :9876
```

**아키텍처**:
- 각 Pylon이 ClaudeSDKAdapter를 통해 SDK 직접 호출
- MCP 서버가 Pylon 내부에 통합 (`pylon/src/mcp/`)
- toolUseId → conversationId 매핑을 ClaudeManager 내부에서 처리
- 환경변수 `ESTELLE_MCP_PORT`로 MCP 포트 주입

**핵심 컴포넌트**:

| 컴포넌트 | 위치 | 역할 |
|----------|------|------|
| **ClaudeSDKAdapter** | pylon | Claude SDK 직접 호출, 이벤트 스트리밍 |
| **ClaudeManager** | pylon | 세션 관리, toolUseId 역매핑 |
| **PylonMcpServer** | pylon | MCP TCP 서버 (send_file, deploy 등) |

**포트 할당**:
- MCP TCP (release): 9876
- MCP TCP (stage): 9877
- MCP TCP (dev): 9878
- MCP TCP (test): 9879

---

### 대원칙: Pylon은 Single Source of Truth

**App은 Pylon의 데이터를 무조건 신뢰한다.**

```
┌─────────┐         ┌─────────┐
│   App   │ ──────► │  Pylon  │  ← 모든 상태의 원천
└─────────┘         └─────────┘
   표시만              상태 관리
```

| 항목 | App | Pylon |
|------|-----|-------|
| 상태 저장 | ❌ | ✅ |
| 상태 검증 | ❌ | ✅ |
| 상태 변경 | ❌ (요청만) | ✅ |
| 데이터 신뢰 | Pylon 데이터 무조건 신뢰 | 자기 자신 |

**이유**:
- 여러 App이 접속해도 동일한 상태 보장
- App 재접속 시 Pylon에서 전체 상태 받아옴
- 상태 충돌/불일치 원천 차단
- App 로직 단순화 (표시에만 집중)

### 대원칙: 모든 App은 동일한 상태를 본다

**App별 개별 상태는 존재하지 않는다.**

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ App A   │     │ App B   │     │ App C   │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     ▼
              ┌─────────────┐
              │   Pylon     │  ← 단일 상태
              │  (state)    │
              └─────────────┘
```

**예시**:
| 항목 | ❌ 앱별 관리 | ✅ Pylon 단일 관리 |
|------|-------------|-------------------|
| 채팅 읽음 여부 | App A만 읽음 | 하나가 읽으면 전부 읽음 |
| 선택된 대화 | App마다 다름 | 모두 같은 대화 선택 |
| 스크롤 위치 | App마다 다름 | (예외: UI 상태는 로컬) |

**경계**:
- **Pylon 관리**: 비즈니스 상태 (읽음, 선택, 설정 등)
- **App 로컬**: 순수 UI 상태 (스크롤 위치, 애니메이션, 키보드 등)

**결과**:
- 집에서 읽은 메시지는 회사에서도 읽음 상태
- 한 기기에서 대화 선택하면 다른 기기도 동기화
- "이 기기에서만" 같은 분기 로직 불필요

### App은 PylonState의 SubSet을 동기화

```
PylonState (전체)          App (SubSet)
┌────────────────┐         ┌──────────┐
│ 메모리 (로드됨) │ ──────► │ 동기화됨 │
│ 메모리 (로드됨) │         └──────────┘
│ 파일 (미로드)   │ ← 필요시 로드
└────────────────┘
```

- PylonState 전체가 항상 메모리에 있는 건 아님 (lazy load)
- App은 필요한 부분만 동기화 받음
- 세부 구현은 상황에 맞게 결정

**결과**:
- App은 로컬 상태 직접 수정 안 함
- 사용자 액션 → Pylon에 요청 → Pylon이 처리 → App에 결과 브로드캐스트
- App은 Pylon 응답을 검증 없이 반영

---

### 순수 데이터 클래스 (모킹 최소화)

**모킹은 테스트의 적이다.** 모킹이 필요 없는 구조를 만든다.

```
┌──────────────────────────────────────────────────────┐
│                    PylonState                        │
│                  (순수 데이터 클래스)                  │
│                                                      │
│   ┌─────────────────┐    ┌─────────────────┐        │
│   │ handlePacket()  │    │ handleClaude()  │        │
│   │  (패킷 입력)     │    │  (클로드 입력)   │        │
│   └─────────────────┘    └─────────────────┘        │
│                                                      │
│   상태: conversations, workspaces, sessions, ...     │
└──────────────────────────────────────────────────────┘
        ▲                           ▲
        │                           │
   WebSocket에서                Claude SDK에서
   (Adapter가 변환)             (Adapter가 변환)
```

**입력은 두 가지뿐**:
- `handlePacket(packet)` - App/Relay에서 오는 메시지
- `handleClaude(event)` - Claude SDK에서 오는 이벤트

**테스트 예시**:
```typescript
// 모킹 없이 테스트
const state = new PylonState();

// 패킷 입력
state.handlePacket({
  type: 'prompt',
  conversationId: 'conv1',
  content: 'hello'
});
expect(state.conversations.get('conv1').messages).toHaveLength(1);

// 클로드 입력
state.handleClaude({
  type: 'assistant_message',
  content: 'Hi there!'
});
expect(state.conversations.get('conv1').messages).toHaveLength(2);
```

**장점**:
- WebSocket, Claude SDK 모킹 불필요
- 인스턴스 생성 → 입력 → 상태 확인, 이게 전부
- 외부 의존성은 Adapter 계층에서 처리

---

### 계층 분리 (Adapter 패턴)

### 계층 분리 (Adapter 패턴)

```
┌─────────────────────────────────────────────────────────────┐
│                      Adapters (I/O)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ WebSocket    │  │ Claude SDK   │  │ FileSystem   │      │
│  │ Adapter      │  │ Adapter      │  │ Adapter      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          │ handlePacket()  │ handleClaude()  │ (저장/로드)
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    PylonState (순수)                        │
│                                                             │
│  - 외부 의존성 없음                                          │
│  - 모든 상태 보유                                            │
│  - 입력 → 상태 변경 → 출력 이벤트                            │
└─────────────────────────────────────────────────────────────┘
```

**테스트 경계**:
- `PylonState`: 모킹 없이 단위 테스트 (핵심)
- `Adapters`: 통합 테스트 또는 E2E (소수)

### Relay는 순수 함수

Relay는 상태가 없다. 입력 → 출력 변환하는 **순수 함수**로 구성.

```typescript
// 인증 - 순수 함수
function authenticate(token: string, config: AuthConfig): AuthResult {
  if (config.pylonTokens.includes(token)) {
    return { valid: true, deviceId: config.pylonTokens.indexOf(token) + 1 };
  }
  return { valid: false };
}

// 라우팅 - 순수 함수
function routeMessage(
  msg: Message,
  connections: Map<number, Connection>
): RouteResult {
  if (msg.to) return { target: connections.get(msg.to) };
  if (msg.broadcast) return { targets: [...connections.values()] };
  return { error: 'no target' };
}
```

**테스트**:
```typescript
// 모킹 없음, 상태 없음, 그냥 함수 호출
expect(authenticate('secret', config)).toEqual({ valid: true, deviceId: 1 });
expect(routeMessage({ to: 2 }, conns)).toEqual({ target: conn2 });
```

**정리**:
| 컴포넌트 | 형태 | 테스트 방식 |
|----------|------|-------------|
| **Relay** | 순수 함수 | 함수 호출 → 결과 확인 |
| **Pylon** | 순수 데이터 클래스 | 인스턴스 → 입력 → 상태 확인 |

### 인터페이스 우선

```typescript
// 인터페이스 정의 → 구현은 나중에
interface IMessageStore {
  save(conversationId: string, messages: Message[]): Promise<void>;
  load(conversationId: string): Promise<Message[]>;
}

// 테스트용 구현
class InMemoryMessageStore implements IMessageStore { ... }

// 실제 구현
class FileMessageStore implements IMessageStore { ... }
```

---

## 참고 문서

- 원본 스펙: `C:\WorkSpace\estelle\spec\`
- 원본 코드: `C:\WorkSpace\estelle\`
- Beacon 제거 히스토리: `log/2026-02-14-beacon-removal.md` (예정)

---

*작성일: 2026-01-31*
*갱신일: 2026-02-14*
