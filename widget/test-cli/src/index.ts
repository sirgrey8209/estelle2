import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function render(view: object) {
  console.log(JSON.stringify({ type: 'render', view }));
}

function complete(result: unknown, reason: string) {
  // 종료 페이지 렌더링 (모든 클라이언트에 브로드캐스트됨)
  render({
    type: 'script',
    html: `
      <div style="padding: 20px; font-family: sans-serif; text-align: center;">
        <h3 style="margin: 0 0 10px 0; color: #27ae60;">✓ 위젯 종료됨</h3>
        <p style="margin: 0; color: #666;">종료 사유: ${reason}</p>
      </div>
    `,
    code: '',
    height: 80
  });
  console.log(JSON.stringify({ type: 'complete', result }));
  // stdout 버퍼가 flush될 때까지 대기 후 종료
  setTimeout(() => process.exit(0), 100);
}

// CLI → Client 이벤트 전송 (서버에서 클라이언트로)
function sendEvent(data: unknown) {
  console.log(JSON.stringify({ type: 'event', data }));
}

// 이벤트 핸들러
rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.type === 'event') {
      const data = msg.data;
      if (data.type === 'close') {
        clearInterval(timer);
        complete({ closed: true, reason: 'user_close_button' }, '닫기 버튼 클릭');
      }
    } else if (msg.type === 'cancel') {
      clearInterval(timer);
      complete({ closed: true, reason: 'x_button' }, '취소 버튼 클릭');
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
      <h3 style="margin: 0 0 15px 0;">서버 시간 위젯</h3>
      <div id="time" style="font-size: 24px; font-weight: bold; padding: 20px; background: #f0f0f0; border-radius: 8px; text-align: center;">
        로딩 중...
      </div>
      <p id="updateCount" style="margin-top: 10px; color: #666; text-align: center;">
        업데이트: 0회
      </p>
      <button id="closeBtn" style="margin-top: 15px; padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
        닫기
      </button>
    </div>
  `,
  code: `
    let updateCount = 0;
    const timeEl = document.getElementById('time');
    const countEl = document.getElementById('updateCount');

    // 서버에서 오는 이벤트 수신
    api.onEvent((data) => {
      if (data.type === 'time_update') {
        timeEl.textContent = data.time;
        updateCount++;
        countEl.textContent = '업데이트: ' + updateCount + '회';
      }
    });

    document.getElementById('closeBtn').onclick = () => {
      api.sendEvent({ type: 'close' });
    };
  `,
  height: 220
});

// 5초마다 서버 시간 전송
const timer = setInterval(() => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  sendEvent({ type: 'time_update', time: timeStr });
}, 5000);

// 즉시 첫 번째 시간 전송
const now = new Date();
const timeStr = now.toLocaleTimeString('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});
sendEvent({ type: 'time_update', time: timeStr });
