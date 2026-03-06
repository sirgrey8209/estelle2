import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { HfInference } from '@huggingface/inference';

// .env 파일 로드 (위젯 디렉토리 기준)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
console.error('Loading .env from:', envPath);
console.error('.env exists:', fs.existsSync(envPath));
config({ path: envPath });
console.error('HF_TOKEN loaded:', process.env.HF_TOKEN ? 'yes (length: ' + process.env.HF_TOKEN.length + ')' : 'no');

const hfToken = process.env.HF_TOKEN;
console.error('Creating HfInference client with token:', hfToken ? hfToken.slice(0, 10) + '...' : 'undefined');

const client = new HfInference(hfToken);

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
      placeholder="이미지를 설명해주세요... (예: A cute cat sitting on a windowsill)"
      style="width: 100%; height: 80px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; resize: none; font-size: 14px;"
    ></textarea>
    <button
      id="generate-btn"
      style="margin-top: 8px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;"
    >
      Generate Image
    </button>
  </div>

  <div id="status" style="margin-top: 12px; font-size: 13px; color: #666; display: none;"></div>

  <div id="image-container" style="margin-top: 16px; border: 1px solid #eee; border-radius: 8px; min-height: 200px; display: flex; align-items: center; justify-content: center; background: #fafafa;">
    <span style="color: #999;">Image will appear here</span>
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
const imageContainer = document.getElementById('image-container');
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
  imageContainer.innerHTML = '<span style="color: #999;">Generating...</span>';
  resultSection.style.display = 'none';

  api.sendEvent({ type: 'prompt', text: prompt });
};

newBtn.onclick = () => {
  isGenerating = false;
  generateBtn.disabled = false;
  generateBtn.textContent = 'Generate Image';
  promptInput.disabled = false;
  promptInput.value = '';
  statusEl.style.display = 'none';
  imageContainer.innerHTML = '<span style="color: #999;">Image will appear here</span>';
  resultSection.style.display = 'none';
};

api.onMessage((data) => {
  if (data.type === 'status') {
    statusEl.textContent = data.message || 'Generating...';
  } else if (data.type === 'image') {
    if (data.phase === 'done') {
      imageContainer.innerHTML = '<img src="' + data.dataUrl + '" style="max-width: 100%; max-height: 400px; border-radius: 4px;" />';
      isGenerating = false;
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Image';
      promptInput.disabled = false;
      statusEl.style.display = 'none';
      resultSection.style.display = 'block';
      filePathEl.textContent = 'Saved to: ' + data.path;
    }
  } else if (data.type === 'error') {
    isGenerating = false;
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Image';
    promptInput.disabled = false;
    statusEl.textContent = 'Error: ' + data.message;
    statusEl.style.color = '#ef4444';
  }
});
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
    await generateImage(prompt);
  }
}

async function generateImage(prompt: string): Promise<void> {
  try {
    sendEvent({ type: 'status', message: 'Generating image...' });

    console.error('Generating image with prompt:', prompt);

    // Hugging Face text-to-image API 호출 (dataUrl로 직접 반환)
    const dataUrl = await client.textToImage({
      model: 'black-forest-labs/FLUX.1-schnell',  // 빠른 모델 사용
      inputs: prompt,
    }, {
      outputType: 'dataUrl',
    });

    console.error('Response type:', typeof dataUrl);
    console.error('Response length:', dataUrl.length);

    // data URL에서 base64 추출하여 파일로 저장
    const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid data URL format');
    }
    const base64Data = base64Match[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // 파일 저장
    const uploadsDir = path.resolve(process.cwd(), '../../uploads/images');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `hf-${Date.now()}.png`;
    const filepath = path.join(uploadsDir, filename);
    fs.writeFileSync(filepath, buffer);

    // filepath를 lastSavedPath에 저장
    lastSavedPath = filepath;

    console.error('Image saved to:', filepath);
    console.error('Image size:', buffer.length, 'bytes');

    sendEvent({ type: 'image', phase: 'done', dataUrl, path: filepath });
  } catch (err) {
    console.error('Error generating image:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    sendEvent({ type: 'error', message });
  }
}

// 초기 UI 렌더링 (프롬프트가 있으면 자동 시작)
const initialJs = prompt
  ? `
    ${JS_CODE}
    // 자동 시작 (한 번만 실행되도록 플래그 체크)
    if (!window.__quiverAutoStarted) {
      window.__quiverAutoStarted = true;
      document.getElementById('prompt-input').value = ${JSON.stringify(prompt)};
      document.getElementById('generate-btn').click();
    }
  `
  : JS_CODE;

render(HTML_TEMPLATE, initialJs, 450);
