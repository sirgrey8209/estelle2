# @estelle/relay

Estelle의 상태 없는 WebSocket 릴레이 서버입니다.

## 개요

Relay는 단순한 메시지 라우터로서:

- 클라이언트(Pylon 및 App) **인증**
- 연결된 기기 간 메시지 **라우팅**
- 정적 파일(Client 웹 앱) **서빙**

**상태 없음** - Relay는 메시지를 해석하거나 저장하지 않습니다.

## 아키텍처

```
┌────────────┐     ┌─────────────────┐     ┌────────────┐
│   Pylon    │────►│     Relay       │◄────│   Client   │
└────────────┘     │  (순수 라우터)   │     └────────────┘
                   └─────────────────┘
                          │
                    정적 파일
                   (Client 앱)
```

## 기능

- **순수 함수** - 인증과 라우팅은 상태 없음
- **WebSocket** - 실시간 양방향 통신
- **정적 서빙** - Client 웹 앱 호스팅
- **Fly.io 지원** - 엣지 배포 설정 완료

## 설정

환경 변수:

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서버 포트 | 3000 |
| `PYLON_TOKEN` | Pylon 인증 토큰 | - |
| `APP_TOKEN` | Client 인증 토큰 | - |

## 개발

```bash
# 테스트 실행
pnpm test

# 개발 서버 시작
pnpm dev

# 빌드
pnpm build
```

## 배포

Relay는 Fly.io에 배포됩니다:

```bash
# 스크립트로 배포
.\scripts\build-deploy.ps1 -Target release
```

## API

### WebSocket 프로토콜

메시지는 JSON 패킷입니다:

```typescript
// 인증
{ "type": "auth", "token": "xxx" }

// 라우팅
{ "type": "message", "to": 1, "payload": {...} }
{ "type": "broadcast", "payload": {...} }
```

### HTTP 엔드포인트

- `GET /` - Client 웹 앱 서빙
- `GET /health` - 헬스 체크
- `GET /version.json` - 빌드 버전 정보
