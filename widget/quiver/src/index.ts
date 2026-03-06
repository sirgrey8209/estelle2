import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { QuiverAI } from '@quiverai/sdk';
import { GenerateSVGAcceptEnum } from '@quiverai/sdk/sdk/createsvgs';
import type { EventStream } from '@quiverai/sdk/lib/event-streams';
import type { SvgStreamEvent } from '@quiverai/sdk/sdk/models/shared';

const client = new QuiverAI({
  bearerAuth: process.env.QUIVERAI_API_KEY,
});

let lastSavedPath: string | null = null;

// CLI 인자에서 프롬프트 추출
const prompt = process.argv.slice(2).join(' ');

// ============================================================================
// HTML/JS Templates
// ============================================================================

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
      // 정상 종료 시 결과 반환
      complete({
        success: true,
        path: lastSavedPath,
        message: lastSavedPath ? `SVG saved to ${lastSavedPath}` : 'No SVG generated'
      });
    }
  } catch {
    // JSON 파싱 실패 무시
  }
});

async function handleClientEvent(data: { type: string; [key: string]: unknown }): Promise<void> {
  if (data.type === 'prompt') {
    const prompt = data.text as string;
    await generateSvg(prompt);
  }
}

async function generateSvg(prompt: string): Promise<void> {
  try {
    sendEvent({ type: 'status', phase: 'reasoning' });

    const response = await client.createSVGs.generateSVG(
      {
        model: 'arrow-preview',
        prompt,
        stream: true,
      },
      {
        acceptHeaderOverride: GenerateSVGAcceptEnum.textEventStream,
      }
    );

    // EventStream 타입인지 확인
    const stream = response as EventStream<SvgStreamEvent>;

    let finalSvg = '';

    // SSE 스트림 처리
    for await (const event of stream) {
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

    // filepath를 lastSavedPath에 저장
    lastSavedPath = filepath;

    sendEvent({ type: 'svg', phase: 'done', data: finalSvg, path: filepath });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendEvent({ type: 'error', message });
  }
}

// 초기 UI 렌더링 (프롬프트가 있으면 자동 시작)
const initialJs = prompt
  ? `
    ${JS_CODE}
    // 자동 시작
    document.getElementById('prompt-input').value = ${JSON.stringify(prompt)};
    document.getElementById('generate-btn').click();
  `
  : JS_CODE;

render(HTML_TEMPLATE, initialJs, 450);
