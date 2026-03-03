# Estelle 테스트 패턴 레퍼런스

> 코드 기반 분석 (2026-03-02)

## 테스트 프레임워크

- **Vitest** - 빠르고 ESM 친화적
- **전체 1,849개 테스트**
  - Core: 601개
  - Relay: 165개
  - Pylon: 748개
  - Client: 335개 (jsdom)

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
- `it`: `should`로 시작하는 영문

```typescript
describe('WorkspaceStore', () => {
  describe('createWorkspace', () => {
    it('should create workspace with valid name', () => { ... });
    it('should reject empty name', () => { ... });
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
| **vi.fn()** | I/O, 외부 API | relayClient, claudeManager |
| **InMemory** | 파일시스템 | InMemoryFileSystem 클래스 |

### 팩토리 함수 패턴

```typescript
function createMockDependencies(): PylonDependencies {
  return {
    workspaceStore: new WorkspaceStore(),
    messageStore: new MessageStore(),
    relayClient: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
    },
    claudeManager: {
      sendMessage: vi.fn(),
      stop: vi.fn(),
      hasActiveSession: vi.fn().mockReturnValue(false),
    },
  };
}
```

### Spy 래핑

```typescript
const shareStore = new ShareStore();
vi.spyOn(shareStore, 'validate');
vi.spyOn(shareStore, 'create');

// 실제 메서드 호출 추적
pylon.handleMessage({ type: 'share_create', ... });
expect(shareStore.validate).toHaveBeenCalledWith(shareInfo.shareId);
```

---

## 3. 픽스처

### beforeEach / afterEach

```typescript
let pylon: Pylon;
let deps: PylonDependencies;

beforeEach(() => {
  deps = createMockDependencies();
  pylon = new Pylon(createMockConfig(), deps);
});

afterEach(() => {
  vi.clearAllMocks();
  deps.messageStore.close();  // 리소스 정리
});
```

### 테스트 상수

```typescript
const PYLON_ID = 1;
const TEST_CONVERSATION_ID = 132097;  // encodeConversationId(1, 1, 1)
const TEST_TOOL_USE_ID = 'toolu_test_deploy_456';

const workingDir = normalizePath('/workspace/project');
```

### InMemory 구현

```typescript
class InMemoryFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  // 테스트 헬퍼
  _setFile(p: string, content: string): void {
    this.files.set(normalizePath(p), content);
  }

  _getFileCount(): number {
    return this.files.size;
  }

  // 실제 인터페이스 구현
  existsSync(p: string): boolean {
    return this.files.has(normalizePath(p)) ||
           this.directories.has(normalizePath(p));
  }
}
```

---

## 4. 헬퍼 함수

### 경로 정규화 (플랫폼 독립)

```typescript
const SEP = path.sep;

function normalizePath(p: string): string {
  return p.replace(/[\\/]/g, SEP);
}

// Windows: C:\path\to\file
// Linux: /path/to/file
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
function createMockSDKResponse(messages: ClaudeMessage[]): AsyncIterable<ClaudeMessage> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const msg of messages) {
        yield msg;
      }
    },
  };
}

// 사용
vi.mocked(mockQuery).mockReturnValue(
  createMockSDKResponse([{ type: 'text', text: 'Hello' }])
);
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

  const messages: ClaudeMessage[] = [];
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

  // dev에서는 테스트 스킵
  if (currentEnv === 'dev') {
    return;
  }

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

  it('should return false for deny', () => {
    const result = checkPermission('Edit', { file_path: '.env' }, PermissionMode.DEFAULT);
    expect(isPermissionAllow(result)).toBe(false);
  });
});
```

### 에러 검증

```typescript
it('should throw on invalid input', () => {
  expect(() => {
    store.createWorkspace('', '/path');
  }).toThrow('Name is required');
});

// 비동기 에러
it('should reject on network failure', async () => {
  await expect(client.connect()).rejects.toThrow('Connection refused');
});
```

---

## 7. Client 테스트 (jsdom)

### 환경 설정

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

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

### Store 테스트

```typescript
it('should update state', () => {
  const { result } = renderHook(() => useWorkspaceStore());

  act(() => {
    result.current.selectConversation(1, 123);
  });

  expect(result.current.selectedConversation?.conversationId).toBe(123);
});
```

---

## 8. 테스트 명령어

```bash
# 전체 테스트
pnpm test

# 특정 패키지
pnpm --filter @estelle/pylon test

# watch 모드
pnpm --filter @estelle/pylon test:watch

# 단일 파일
pnpm --filter @estelle/pylon test src/state.test.ts

# 커버리지
pnpm test -- --coverage
```

---

## 9. 모범 사례

1. **순수 로직 우선**: Store, Manager는 실제 객체로 테스트
2. **I/O만 Mock**: relayClient, fileSystem 등 외부 연동
3. **팩토리 함수**: 의존성 생성 로직 재사용
4. **경로 정규화**: Windows/Linux 호환
5. **비동기 안전**: await, for-await, setTimeout 대기
6. **리소스 정리**: afterEach에서 mock 초기화, 연결 종료
7. **명확한 네이밍**: describe(한글), it(should...)
