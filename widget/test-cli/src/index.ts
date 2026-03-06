import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function render(view: object) {
  console.log(JSON.stringify({ type: 'render', view }));
}

function complete(result: unknown) {
  console.log(JSON.stringify({ type: 'complete', result }));
  process.exit(0);
}

// 이벤트 핸들러
rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.type === 'event') {
      const data = msg.data;
      if (data.type === 'close') {
        // 닫기 버튼 (cancel 아님)
        complete({ closed: true, reason: 'user_close_button' });
      }
    } else if (msg.type === 'cancel') {
      // X 버튼
      complete({ closed: true, reason: 'x_button' });
    }
  } catch (e) {
    // ignore
  }
});

// 초기 렌더링
render({
  type: 'script',
  html: `
    <div style="padding: 20px; font-family: sans-serif;">
      <h3 style="margin: 0 0 15px 0;">버튼 테스트</h3>
      <div style="display: flex; gap: 10px; margin-bottom: 15px;">
        <button id="btn1" style="padding: 10px 20px; cursor: pointer;">버튼 1</button>
        <button id="btn2" style="padding: 10px 20px; cursor: pointer;">버튼 2</button>
        <button id="btn3" style="padding: 10px 20px; cursor: pointer;">버튼 3</button>
      </div>
      <div id="result" style="padding: 10px; background: #f0f0f0; border-radius: 4px; min-height: 20px;">
        버튼을 클릭하세요
      </div>
      <button id="closeBtn" style="margin-top: 15px; padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">
        닫기
      </button>
    </div>
  `,
  code: `
    const result = document.getElementById('result');

    document.getElementById('btn1').onclick = () => {
      result.textContent = '버튼 1 클릭됨';
      api.sendEvent({ type: 'button_click', button: 1 });
    };

    document.getElementById('btn2').onclick = () => {
      result.textContent = '버튼 2 클릭됨';
      api.sendEvent({ type: 'button_click', button: 2 });
    };

    document.getElementById('btn3').onclick = () => {
      result.textContent = '버튼 3 클릭됨';
      api.sendEvent({ type: 'button_click', button: 3 });
    };

    document.getElementById('closeBtn').onclick = () => {
      api.sendEvent({ type: 'close' });
    };
  `,
  height: 200
});
