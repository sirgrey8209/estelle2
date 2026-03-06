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
