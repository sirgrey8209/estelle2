# Estelle 테스트 패턴 레퍼런스

> 코드 기반 분석 (2026-03-16)

## 테스트 프레임워크

- **Vitest** - 빠르고 ESM 친화적
- **전체 ~1,900개 테스트**
  - Core: ~601개
  - Relay: ~165개
  - Pylon: ~748개
  - Client: ~335개 (jsdom)

---

## 1. 기본 구조

### AAA 패턴 (Arrange-Act-Assert)

```typescript
describe('기능 범주', () => {
  describe('세부 기능', () => {
    it('should 동작 설명', () => {
      // Arrange (Given) - 준비
      const store = new WorkspaceStore();

      // Act (When) - 실행
      const result = store.createWorkspace('Test', '/path');

      // Assert (Then) - 검증
      expect(result.workspace.name).toBe('Test');
    });
  });
});
```

### 네이밍 컨벤션

- `describe`: 한글로 의도 명시
- `it`: `should`로 시작하는 영문 또는 snake_case

```typescript
describe('WorkspaceStore', () => {
  describe('createWorkspace', () => {
    it('should create workspace with valid name', () => { ... });
    it('should_reject_empty_name', () => { ... });
  });
});
```

---

## 2. 모킹 전략

### 핵심 원칙: 모킹 최소화

```typescript
// ❌ 피해야 할 패턴 - 내부 의존성 직접 생성
class Service {
  private store = new MockStore();
  private api = new MockAPI();
}

// ✅ 권장 패턴 - 의존성 주입
class Pylon {
  constructor(config: PylonConfig, deps: PylonDependencies) { }
}

// 테스트: 실제 객체 사용
const deps = {
  workspaceStore: new WorkspaceStore(),  // 실제 객체
  relayClient: { send: vi.fn() },        // I/O만 mock
};
```

### Mock 대상 분류

| 종류 | 대상 | 방식 |
|------|------|------|
| **실제 객체** | Store, Manager | 그대로 사용 |
| **vi.fn()** | I/O, 외부 API | relayClient, agentManager |
| **InMemory** | 파일시스템, DB | InMemoryFileSystem, `:memory:` SQLite |
| **vi.mock()** | 모듈 전체 | SDK, 외부 라이브러리 |

### 팩토리 함수 패턴

```typescript
function createMockDependencies(): PylonDependencies {
  const shareStore = new ShareStore();
  vi.spyOn(shareStore, 'validate');
  vi.spyOn(shareStore, 'create');

  return {
    workspaceStore: new WorkspaceStore(PYLON_ID),
    messageStore: new MessageStore(':memory:'),
    shareStore,
    relayClient: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      onMessage: vi.fn(),
      onStatusChange: vi.fn(),
    },
    agentManager: {
      sendMessage: vi.fn(),
      stop: vi.fn(),
      newSession: vi.fn(),
      cleanup: vi.fn(),
      abortAllSessions: vi.fn().mockReturnValue([]),
      respondPermission: vi.fn(),
      respondQuestion: vi.fn(),
      hasActiveSession: vi.fn().mockReturnValue(false),
      getSessionStartTime: vi.fn().mockReturnValue(null),
      getPendingEvent: vi.fn().mockReturnValue(null),
      getSessionIdByToolUseId: vi.fn().mockReturnValue(null),
      getSessionTools: vi.fn().mockReturnValue([]),
      getSessionSlashCommands: vi.fn().mockReturnValue([]),
    },
    blobHandler: {
      handleBlobStart: vi.fn().mockReturnValue({ success: true }),
      handleBlobChunk: vi.fn(),
      handleBlobEnd: vi.fn().mockReturnValue({ success: true }),
      handleBlobRequest: vi.fn(),
    },
    logger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
}
```

### 모듈 Mock (vi.mock)

```typescript
// SDK 전체 mock
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// React 컴포넌트 mock
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }) => (
    <button data-testid="google-login-button"
            onClick={() => onSuccess({ credential: 'mock' })}>Sign in</button>
  ),
  GoogleOAuthProvider: ({ children }) => <>{children}</>,
}));

// Zustand 스토어 mock
vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));
```

### Spy 래핑

```typescript
const shareStore = new ShareStore();
vi.spyOn(shareStore, 'validate');
vi.spyOn(shareStore, 'create');

pylon.handleMessage({ type: 'share_create', ... });
expect(shareStore.validate).toHaveBeenCalledWith(shareInfo.shareId);
```

---

## 3. 픽스처

### beforeEach / afterEach

```typescript
let pylon: Pylon;
let deps: PylonDependencies;
let dbPath: string;

beforeEach(() => {
  dbPath = createTempDbPath();
  deps = createMockDependencies();
  pylon = new Pylon(createMockConfig(), deps);
});

afterEach(() => {
  vi.clearAllMocks();
  deps.messageStore.close();
  cleanupTempDir(dbPath);
});
```

### beforeAll / afterAll (통합 테스트)

```typescript
let server: PylonMcpServer;
let TEST_PORT: number;

beforeAll(async () => {
  TEST_PORT = getRandomPort();
  server = new PylonMcpServer(workspaceStore, { port: TEST_PORT });
  await server.listen();
  await waitForPort(TEST_PORT);
});

afterAll(async () => {
  await server.close();
});
```

### 테스트 상수

```typescript
const PYLON_ID = 1;
const DEVICE_INDEX = 1;
const ENV_ID = 0 as const;  // 0=release, 1=stage, 2=dev

const TEST_PYLON_ID = encodePylonId(ENV_ID, DEVICE_INDEX);
const TEST_CONVERSATION_ID = encodeConversationId(
  encodeWorkspaceId(TEST_PYLON_ID, 1), 1
);

const workingDir = toNativePath('/workspace/project');
```

### InMemory 구현

```typescript
class InMemoryFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  _setFile(p: string, content: string): void {
    this.files.set(normalizePath(p), content);
  }

  _getFileCount(): number {
    return this.files.size;
  }

  existsSync(p: string): boolean {
    return this.files.has(normalizePath(p)) ||
           this.directories.has(normalizePath(p));
  }
}
```

### 임시 파일 관리

```typescript
function createTempDbPath(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'message-store-test-'));
  return path.join(tempDir, 'messages.db');
}

function cleanupTempDir(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
```

---

## 4. 헬퍼 함수

### 경로 정규화 (플랫폼 독립)

```typescript
const IS_WINDOWS = os.platform() === 'win32';

function toNativePath(path: string): string {
  return IS_WINDOWS ? path.replace(/\//g, '\\') : path.replace(/\\/g, '/');
}

expect(workspace.workingDir).toBe(toNativePath('C:\\test'));
```

### 포트 유틸

```typescript
function getRandomPort(): number {
  return 10000 + Math.floor(Math.random() * 50000);
}

async function waitForPort(port: number, maxRetries = 10): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = createConnection({ port, host: '127.0.0.1' });
      client.end();
      return;
    } catch {
      await new Promise(r => setTimeout(r, 50));
    }
  }
  throw new Error(`Port ${port} not available`);
}
```

### Mock 응답 생성

```typescript
function createMockSDKResponse(messages: AgentMessage[]): AsyncIterable<AgentMessage> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const msg of messages) {
        yield msg;
      }
    },
  };
}

vi.mocked(mockQuery).mockReturnValue(
  createMockSDKResponse([
    { type: 'system', subtype: 'init', session_id: 'sess-1', model: 'claude-3' },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } },
  ])
);
```

### WebSocket 테스트 헬퍼

```typescript
class TestClient {
  ws: WebSocket | null = null;
  messages: unknown[] = [];
  private messageResolvers: Array<(msg: unknown) => void> = [];

  async connect(): Promise<void> { ... }
  send(msg: unknown): void { ... }
  async waitForMessage(timeout = 2000): Promise<unknown> {
    if (this.messages.length > 0) return this.messages.shift();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
      this.messageResolvers.push((msg) => { clearTimeout(timer); resolve(msg); });
    });
  }
}
```

---

## 5. 비동기 테스트

### async/await

```typescript
it('should save workspace', async () => {
  const store = new WorkspaceStore();
  await store.save();
  expect(fs.existsSync('/data/workspaces.json')).toBe(true);
});
```

### for-await (AsyncIterable)

```typescript
it('should stream messages', async () => {
  vi.mocked(mockQuery).mockReturnValue(createMockSDKResponse([...]));

  const messages: AgentMessage[] = [];
  for await (const msg of adapter.query(options)) {
    messages.push(msg);
  }

  expect(messages).toHaveLength(3);
});
```

### 비동기 작업 대기

```typescript
it('should persist after create', async () => {
  pylon.handleMessage({ type: 'workspace_create', ... });

  // 디바운스된 저장 완료 대기
  await new Promise(r => setTimeout(r, 100));

  expect(mockPersistence.saveWorkspaceStore).toHaveBeenCalled();
});
```

### 통합 테스트 (서버)

```typescript
let server: PylonMcpServer;
let client: PylonClient;
let TEST_PORT: number;

beforeEach(async () => {
  TEST_PORT = getRandomPort();
  server = new PylonMcpServer(workspaceStore, { port: TEST_PORT });
  await server.listen();
  await waitForPort(TEST_PORT);

  client = new PylonClient({ host: '127.0.0.1', port: TEST_PORT });
});

afterEach(async () => {
  await server.close();
});
```

---

## 6. 특수 패턴

### 조건부 테스트

```typescript
it('should reject self-deploy', async () => {
  const currentEnv = getCurrentEnv();
  if (currentEnv === 'dev') return;

  const result = await client.deployByToolUseId(id, currentEnv);
  expect(result.success).toBe(false);
});
```

### 타입 가드 검증

```typescript
describe('isPermissionAllow', () => {
  it('should return true for allow', () => {
    const result = checkPermission('Read', {}, PermissionMode.DEFAULT);
    expect(isPermissionAllow(result)).toBe(true);
  });
});
```

### 에러 검증

```typescript
it('should throw on invalid input', () => {
  expect(() => store.createWorkspace('', '/path')).toThrow('Name is required');
});

it('should reject on network failure', async () => {
  await expect(client.connect()).rejects.toThrow('Connection refused');
});
```

### 상태 변경 검증 (Zustand)

```typescript
it('should update state when login succeeds', () => {
  useAuthStore.getState().login({ idToken: 'test', user: { ... } });

  const state = useAuthStore.getState();
  expect(state.isAuthenticated).toBe(true);
  expect(state.idToken).toBe('test');
});
```

### 모듈 리셋

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
```

---

## 7. Client 테스트 (jsdom)

### 환경 설정

```typescript
// vitest.config.ts
export default mergeConfig(
  viteConfig,
  defineConfig({
    define: { 'process.env.NODE_ENV': '"development"' },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setupTests.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['node_modules/**/*', 'src/components.skip/**/*'],
    },
  })
);
```

### setupTests.ts 주요 구성

- localStorage mock
- WebSocket mock (MockWebSocket 클래스)
- window.matchMedia mock
- ResizeObserver, IntersectionObserver mock
- URL.createObjectURL mock

### React 컴포넌트 테스트

```typescript
import { render, screen, fireEvent } from '@testing-library/react';

it('should render message', () => {
  render(<MessageBubble message={mockMessage} />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});

it('should call onClick', () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Click</Button>);
  fireEvent.click(screen.getByText('Click'));
  expect(onClick).toHaveBeenCalled();
});
```

### Store 테스트 (Zustand)

```typescript
describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it('should have unauthenticated initial state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.idToken).toBeNull();
  });
});
```

---

## 8. 패키지별 설정

### Core (타입/헬퍼)

```typescript
// vitest.config.ts - Node.js 환경, 의존성 최소
test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] }
```

### Relay (백엔드 서버)

```typescript
// vitest.config.ts - Node.js 환경, 통합 테스트
test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] }
```

### Pylon (에이전트)

```typescript
// vitest.config.ts - globalSetup 지원
test: { globalSetup: ['./tests/setup/global-setup.ts'] }
```

### Client (웹 앱)

```typescript
// vitest.config.ts - jsdom, React Testing Library
test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test/setupTests.ts'] }
```

---

## 9. 테스트 명령어

```bash
# 전체 테스트
pnpm test

# 특정 패키지
pnpm --filter @estelle/core test
pnpm --filter @estelle/relay test
pnpm --filter @estelle/pylon test
pnpm --filter @estelle/client test

# watch 모드
pnpm --filter @estelle/pylon test:watch

# 단일 파일
pnpm --filter @estelle/pylon test src/state.test.ts

# 커버리지
pnpm test -- --coverage

# 특정 테스트
pnpm test -- --grep "should create workspace"
```

---

## 10. 모범 사례

1. **순수 로직 우선**: Store, Manager는 실제 객체로 테스트
2. **I/O만 Mock**: relayClient, fileSystem 등 외부 연동
3. **팩토리 함수**: 의존성 생성 로직 재사용
4. **경로 정규화**: Windows/Linux 호환 (`toNativePath()`)
5. **비동기 안전**: await, for-await, setTimeout 대기
6. **리소스 정리**: afterEach에서 mock 초기화, 연결 종료, 임시 파일 삭제
7. **명확한 네이밍**: describe(한글), it(should...)
8. **Zustand 초기화**: 각 테스트마다 `reset()` 호출
9. **랜덤 포트**: 통합 테스트에서 포트 충돌 방지

---

## 11. 주의사항

- **vi.mock() 순서**: import 전에 호출, 파일 상단에 배치
- **jsdom 확인**: Client 테스트는 jsdom만 지원
- **모듈 격리**: `vi.resetModules()`로 상태 오염 방지
- **타임아웃**: 느린 테스트는 `it('...', async () => {}, 10000)` 형태로 확장
