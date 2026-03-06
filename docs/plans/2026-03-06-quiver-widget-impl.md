# QuiverAI Arrow 위젯 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** QuiverAI Arrow API를 활용한 실시간 SVG 생성 위젯 구현

**Architecture:** 독립 프로젝트(`widget/quiver`)로 CLI 기반 위젯 구현. Widget Protocol v2의 `render`로 초기 UI를, `event`로 SSE 스트리밍 데이터를 실시간 전달. Client JS가 SVG 영역만 업데이트하여 부드러운 렌더링 제공.

**Tech Stack:** TypeScript, @quiverai/sdk, Widget Protocol v2 (stdin/stdout JSON Lines)

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `widget/quiver/package.json`
- Create: `widget/quiver/tsconfig.json`
- Create: `widget/quiver/src/index.ts`
- Create: `widget/quiver/.env.example`

**Step 1: 디렉토리 생성**

```bash
mkdir -p /home/estelle/estelle2/widget/quiver/src
```

**Step 2: package.json 생성**

```json
{
  "name": "@estelle/widget-quiver",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@quiverai/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**Step 3: tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: .env.example 생성**

```
QUIVERAI_API_KEY=your_api_key_here
```

**Step 5: 빈 index.ts 생성**

```typescript
// QuiverAI Arrow Widget CLI
// Widget Protocol v2 구현 예정

console.log('QuiverAI Widget starting...');
```

**Step 6: 의존성 설치**

Run: `cd /home/estelle/estelle2/widget/quiver && pnpm install`

**Step 7: 커밋**

```bash
cd /home/estelle/estelle2
git add widget/
git commit -m "feat(widget): quiver 위젯 프로젝트 스캐폴딩"
```

---

## Task 2: Widget Protocol 기본 구조 구현

**Files:**
- Modify: `widget/quiver/src/index.ts`

**Step 1: stdin/stdout JSON Lines 처리 구현**

```typescript
import * as readline from 'readline';

// ============================================================================
// Types
// ============================================================================

interface RenderMessage {
  type: 'render';
  view: {
    type: 'script';
    html: string;
    code: string;
    height?: number;
  };
}

interface EventMessage {
  type: 'event';
  data: unknown;
}

interface CompleteMessage {
  type: 'complete';
  result: unknown;
}

interface InputEvent {
  type: 'event';
  data: {
    type: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// Protocol Helpers
// ============================================================================

function render(html: string, code: string, height = 400): void {
  const msg: RenderMessage = {
    type: 'render',
    view: { type: 'script', html, code, height },
  };
  console.log(JSON.stringify(msg));
}

function sendEvent(data: unknown): void {
  const msg: EventMessage = { type: 'event', data };
  console.log(JSON.stringify(msg));
}

function complete(result: unknown): void {
  const msg: CompleteMessage = { type: 'complete', result };
  console.log(JSON.stringify(msg));
  process.exit(0);
}

// ============================================================================
// Main
// ============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line) as InputEvent;
    if (msg.type === 'event') {
      handleClientEvent(msg.data);
    } else if ((msg as { type: string }).type === 'cancel') {
      process.exit(0);
    }
  } catch {
    // JSON 파싱 실패 무시
  }
});

function handleClientEvent(data: { type: string; [key: string]: unknown }): void {
  // TODO: Task 4에서 구현
}

// 초기 UI 렌더링
render('<div>Hello Quiver!</div>', '', 200);
```

**Step 2: 빌드 및 테스트**

Run: `cd /home/estelle/estelle2/widget/quiver && pnpm build`
Expected: dist/index.js 생성

**Step 3: 커밋**

```bash
cd /home/estelle/estelle2
git add widget/quiver/
git commit -m "feat(widget/quiver): Widget Protocol 기본 구조 구현"
```

---

## Task 3: UI HTML/JS 구현

**Files:**
- Modify: `widget/quiver/src/index.ts`

**Step 1: HTML 템플릿 정의**

```typescript
const HTML_TEMPLATE = `
<div id="quiver-widget" style="font-family: system-ui, sans-serif; padding: 16px;">
  <div id="input-section">
    <textarea
      id="prompt-input"
      placeholder="SVG를 설명해주세요... (예: A minimalist logo for a coffee shop)"
      style="width: 100%; height: 80px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; resize: none; font-size: 14px;"
    ></textarea>
    <button
      id="generate-btn"
      style="margin-top: 8px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
    >
      Generate SVG
    </button>
  </div>

  <div id="status" style="margin-top: 12px; font-size: 13px; color: #666; display: none;"></div>

  <div id="svg-container" style="margin-top: 16px; border: 1px solid #eee; border-radius: 8px; min-height: 200px; display: flex; align-items: center; justify-content: center; background: #fafafa;">
    <span style="color: #999;">SVG will appear here</span>
  </div>

  <div id="result-section" style="margin-top: 12px; display: none;">
    <p id="file-path" style="font-size: 12px; color: #666;"></p>
    <button
      id="new-btn"
      style="padding: 8px 16px; background: #f3f4f6; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 13px;"
    >
      New Generation
    </button>
  </div>
</div>
`;
```

**Step 2: JS 코드 정의**

```typescript
const JS_CODE = `
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const statusEl = document.getElementById('status');
const svgContainer = document.getElementById('svg-container');
const resultSection = document.getElementById('result-section');
const filePathEl = document.getElementById('file-path');
const newBtn = document.getElementById('new-btn');

let isGenerating = false;

generateBtn.onclick = () => {
  const prompt = promptInput.value.trim();
  if (!prompt || isGenerating) return;

  isGenerating = true;
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating...';
  promptInput.disabled = true;
  statusEl.style.display = 'block';
  statusEl.textContent = 'Starting...';
  svgContainer.innerHTML = '<span style="color: #999;">Generating...</span>';
  resultSection.style.display = 'none';

  api.sendEvent({ type: 'prompt', text: prompt });
};

newBtn.onclick = () => {
  isGenerating = false;
  generateBtn.disabled = false;
  generateBtn.textContent = 'Generate SVG';
  promptInput.disabled = false;
  promptInput.value = '';
  statusEl.style.display = 'none';
  svgContainer.innerHTML = '<span style="color: #999;">SVG will appear here</span>';
  resultSection.style.display = 'none';
};

api.onEvent = (data) => {
  if (data.type === 'status') {
    statusEl.textContent = data.phase === 'reasoning' ? 'Thinking...' : 'Generating...';
  } else if (data.type === 'svg') {
    if (data.phase === 'draft' || data.phase === 'done') {
      svgContainer.innerHTML = data.data;
    }
    if (data.phase === 'done') {
      isGenerating = false;
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate SVG';
      promptInput.disabled = false;
      statusEl.style.display = 'none';
      resultSection.style.display = 'block';
      filePathEl.textContent = 'Saved to: ' + data.path;
    }
  } else if (data.type === 'error') {
    isGenerating = false;
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate SVG';
    promptInput.disabled = false;
    statusEl.textContent = 'Error: ' + data.message;
    statusEl.style.color = '#ef4444';
  }
};
`;
```

**Step 3: render 호출 수정**

```typescript
// main 함수 끝에서
render(HTML_TEMPLATE, JS_CODE, 450);
```

**Step 4: 빌드 및 테스트**

Run: `cd /home/estelle/estelle2/widget/quiver && pnpm build`

**Step 5: 커밋**

```bash
cd /home/estelle/estelle2
git add widget/quiver/
git commit -m "feat(widget/quiver): SVG 생성 UI 구현"
```

---

## Task 4: QuiverAI API 연동

**Files:**
- Modify: `widget/quiver/src/index.ts`

**Step 1: QuiverAI SDK import 및 초기화**

```typescript
import { QuiverAI } from '@quiverai/sdk';

const client = new QuiverAI({
  bearerAuth: process.env.QUIVERAI_API_KEY,
});
```

**Step 2: handleClientEvent 구현**

```typescript
async function handleClientEvent(data: { type: string; [key: string]: unknown }): Promise<void> {
  if (data.type === 'prompt') {
    const prompt = data.text as string;
    await generateSvg(prompt);
  }
}
```

**Step 3: generateSvg 함수 구현 (스트리밍)**

```typescript
import * as fs from 'fs';
import * as path from 'path';

async function generateSvg(prompt: string): Promise<void> {
  try {
    sendEvent({ type: 'status', phase: 'reasoning' });

    const response = await client.createSVGs.generateSVG({
      model: 'arrow-preview',
      prompt,
      stream: true,
    });

    let finalSvg = '';

    // SSE 스트림 처리
    for await (const event of response) {
      if (event.event === 'reasoning') {
        sendEvent({ type: 'status', phase: 'reasoning' });
      } else if (event.event === 'draft') {
        const svg = event.data?.svg || '';
        sendEvent({ type: 'svg', phase: 'draft', data: svg });
      } else if (event.event === 'content') {
        finalSvg = event.data?.svg || '';
        sendEvent({ type: 'svg', phase: 'draft', data: finalSvg });
      }
    }

    // 파일 저장
    const uploadsDir = path.resolve(process.cwd(), '../../uploads/svg');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `quiver-${Date.now()}.svg`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, finalSvg);

    sendEvent({ type: 'svg', phase: 'done', data: finalSvg, path: filepath });

    // 완료 후 대기 (사용자가 새로 생성하거나 종료할 때까지)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendEvent({ type: 'error', message });
  }
}
```

**Step 4: 빌드**

Run: `cd /home/estelle/estelle2/widget/quiver && pnpm build`

**Step 5: 커밋**

```bash
cd /home/estelle/estelle2
git add widget/quiver/
git commit -m "feat(widget/quiver): QuiverAI API 스트리밍 연동"
```

---

## Task 5: 위젯 종료 처리 및 결과 반환

**Files:**
- Modify: `widget/quiver/src/index.ts`

**Step 1: 상태 관리 추가**

```typescript
let lastSavedPath: string | null = null;
```

**Step 2: generateSvg에서 경로 저장**

```typescript
// 파일 저장 후
lastSavedPath = filepath;
```

**Step 3: 종료 처리 추가**

```typescript
rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.type === 'event') {
      handleClientEvent(msg.data);
    } else if (msg.type === 'cancel') {
      // 정상 종료 시 결과 반환
      complete({
        success: true,
        path: lastSavedPath,
        message: lastSavedPath ? `SVG saved to ${lastSavedPath}` : 'No SVG generated'
      });
    }
  } catch {
    // 무시
  }
});
```

**Step 4: 빌드**

Run: `cd /home/estelle/estelle2/widget/quiver && pnpm build`

**Step 5: 커밋**

```bash
cd /home/estelle/estelle2
git add widget/quiver/
git commit -m "feat(widget/quiver): 위젯 종료 및 결과 반환 처리"
```

---

## Task 6: estelle-widget 스킬 업데이트

**Files:**
- Modify: `/home/estelle/.claude/skills/estelle-widget/skill.md`

**Step 1: quiver 위젯 섹션 추가**

스킬 파일 끝에 다음 섹션 추가:

```markdown
---

## 보유 위젯

### quiver

AI SVG 생성 위젯 (QuiverAI Arrow)

**호출 방법:**
```typescript
mcp__estelle-mcp__run_widget({
  command: "pnpm start",
  cwd: "/home/estelle/estelle2/widget/quiver"
})
```

**기능:**
- 텍스트 프롬프트로 SVG 생성
- 실시간 스트리밍 렌더링
- 자동 파일 저장 (`uploads/svg/quiver-{timestamp}.svg`)

**필요 환경변수:**
- `QUIVERAI_API_KEY`: QuiverAI API 키
```

**Step 2: 커밋**

```bash
git add /home/estelle/.claude/skills/estelle-widget/
git commit -m "docs(skill): estelle-widget에 quiver 위젯 추가"
```

---

## Task 7: 통합 테스트

**Step 1: 환경변수 설정**

```bash
# .env 파일에 API 키 추가 (실제 키 필요)
echo "QUIVERAI_API_KEY=your_actual_key" >> /home/estelle/estelle2/widget/quiver/.env
```

**Step 2: 위젯 빌드**

Run: `cd /home/estelle/estelle2/widget/quiver && pnpm build`

**Step 3: 에스텔에서 테스트**

Claude에게 다음 요청:
```
run_widget으로 quiver 위젯 실행해서 "A simple star icon" SVG 생성해줘
```

**Step 4: 검증 항목**

- [ ] 위젯 UI가 정상 렌더링되는지
- [ ] 프롬프트 입력 후 생성 버튼 동작하는지
- [ ] 실시간 SVG 렌더링이 보이는지
- [ ] 완료 후 파일 경로가 표시되는지
- [ ] X 버튼으로 종료 시 결과가 Claude에게 반환되는지

**Step 5: 최종 커밋**

```bash
cd /home/estelle/estelle2
git add .
git commit -m "feat(widget/quiver): QuiverAI Arrow 위젯 통합 완료"
```

---

## 요약

| Task | 설명 | 예상 시간 |
|------|------|----------|
| 1 | 프로젝트 스캐폴딩 | 5분 |
| 2 | Widget Protocol 기본 구조 | 10분 |
| 3 | UI HTML/JS 구현 | 15분 |
| 4 | QuiverAI API 연동 | 15분 |
| 5 | 종료 처리 및 결과 반환 | 5분 |
| 6 | estelle-widget 스킬 업데이트 | 5분 |
| 7 | 통합 테스트 | 10분 |

**총 예상 시간: 약 65분**
