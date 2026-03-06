import * as readline from 'readline';

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
render(HTML_TEMPLATE, JS_CODE, 450);
