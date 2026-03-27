# slack-ws-tunnel Design

SSE(Secure Service Edge) 도입으로 회사 PC에서 외부 WebSocket 연결이 차단될 가능성에 대비한 WebSocket-over-Slack 터널 라이브러리.

## 개요

Estelle의 Pylon ↔ Relay WebSocket 연결을 Slack을 통해 투명하게 중계하는 독립 라이브러리. 양쪽 엔드포인트에서 일반 WebSocket처럼 동작하며, Estelle 코드 변경 없이 사용 가능.

## 아키텍처

```
[회사 PC]                                           [외부 서버]

Pylon →ws→ [slack-ws-tunnel]              [slack-ws-tunnel] →ws→ Relay
           mode: listen                    mode: connect
           로컬 WS 서버 (:8080)            Relay에 WS 클라이언트 접속
           ↓                               ↑
           Slack Bot A (Socket Mode)       Slack Bot B (Socket Mode)
           chat.postMessage 송신           chat.postMessage 송신
           message_metadata 수신           message_metadata 수신
           ↓                               ↑
           ══════════ Private Channel ══════════
```

- **listen 모드**: 로컬 WS 서버를 열어 Pylon 접속을 받음
- **connect 모드**: Slack에서 터널 개통 신호를 받으면 대상 Relay에 WS 클라이언트로 접속
- Pylon과 Relay는 Slack의 존재를 모름. 일반 WebSocket으로만 인식

## 독립 프로젝트

Estelle2 외부에 별도 Node.js 프로젝트로 구성. pm2 서비스로 실행.

## 메시지 프로토콜

### 인코딩 파이프라인

```
송신: [ws_msg1, ws_msg2, ...] → JSON.stringify → gzip → base64 → Slack metadata
수신: Slack metadata → base64 decode → gunzip → JSON.parse → ws.send 개별 전달
```

### Slack 메시지 형태

데이터 메시지:
```typescript
chat.postMessage({
  channel: CHANNEL_ID,
  text: ' ',
  metadata: {
    event_type: 'wst',
    event_payload: {
      d: 'base64...',   // 데이터
      s: '0'            // 시퀀스 번호
    }
  }
})
```

분할 전송 (대용량):
```typescript
metadata: {
  event_type: 'wst',
  event_payload: {
    d: 'base64...',
    s: '42',
    c: '0',   // chunk index
    t: '3'    // total chunks
  }
}
```

제어 메시지:
```typescript
metadata: {
  event_type: 'wst_ctrl',
  event_payload: { cmd: 'tunnel_open' }  // 또는 'tunnel_close'
}
```

## 쓰로틀링

Slack 채널당 1건/초 하드 리밋에 맞춘 즉시 전송 + 배치 전략:

```
메시지 도착
  → 마지막 전송으로부터 1초 이상 경과?
     ├─ Yes → 즉시 flush (레이턴시 최소화)
     └─ No  → 버퍼에 적재, 1초 도달 시 flush

flush:
  → 버퍼의 메시지들을 배열로 묶음
  → gzip → base64
  → 40KB 초과 시 분할
  → Slack 전송, 시퀀스 번호 증가
```

한산할 때는 즉시 전송으로 실시간에 가깝고, 몰릴 때는 자동으로 묶어서 전송.

## 연결 수명 관리

```
[listen 모드]
  시작 → WS 서버 오픈 → 대기
  Pylon 접속 → Slack으로 tunnel_open 전송
  메시지 교환...
  Pylon 끊김 → Slack으로 tunnel_close 전송 → 재접속 대기

[connect 모드]
  시작 → Slack 이벤트 대기
  tunnel_open 수신 → 대상 Relay에 WS 접속
  메시지 교환...
  tunnel_close 수신 → Relay WS 연결 끊기 → 다시 대기
```

## Slack 통신 방식

양쪽 모두 Socket Mode로 이벤트 수신, chat.postMessage로 송신.

- Socket Mode: 아웃바운드 HTTPS만 사용하므로 SSE 통과
- Slack Bot 2개 사용: 자기 메시지 필터링을 위해 분리
- Private Channel: 봇 2개만 참여, 외부 노출 없음

## 설정

### 설정 파일 (config.json)

```json
{
  "mode": "listen",
  "slack": {
    "botToken": "xoxb-...",
    "appToken": "xapp-...",
    "channelId": "C0123456"
  },
  "listen": {
    "port": 8080
  },
  "connect": {
    "target": "ws://relay.example.com:8080"
  }
}
```

### 슬랙 채널 커맨드 (런타임 제어)

```
listen <port>              → WS 서버 시작
connect <ws-url>           → WS 클라이언트 대상 설정
stop                       → 터널 중지
status                     → 현재 상태 출력
set throttle <ms>          → 쓰로틀 간격 변경
set compression <on|off>   → 압축 토글
```

### pm2 실행

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'slack-ws-tunnel',
    script: 'dist/index.js',
    env: {
      CONFIG_PATH: './config.json'
    }
  }]
}
```

## 기술 스택

- Node.js + TypeScript
- `ws` — WebSocket 서버/클라이언트
- `@slack/bolt` — Slack Socket Mode + Web API
- `zlib` (Node built-in) — gzip 압축
- pm2 — 프로세스 관리
