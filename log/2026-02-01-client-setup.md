# Client 패키지 설정 및 연동 테스트

> **날짜**: 2026-02-01
> **작업**: app-rn → client 리네이밍, dev 스크립트 수정, Relay 연결 테스트

---

## 작업 내용

### 1. 패키지 리네이밍

`app-rn` → `client`로 변경:

```
packages/
├── core/      # 공유 타입
├── relay/     # 라우터
├── pylon/     # 서버
└── client/    # Expo 클라이언트 (변경됨)
```

변경된 파일:
- `package.json` - `@estelle/client`, `dev:client` 스크립트
- `CLAUDE.md` - packages/client 참조
- `scripts/dev-server.js` - client 폴더 경로
- `wip/ROADMAP.md` - packages/client 참조

### 2. dev 스크립트 업데이트

Flutter → Expo로 변경:
- `pnpm dev` - Relay + Pylon + Expo 실행
- `pnpm dev:client` - Expo만 실행
- Expo 포트: 10000 (Relay 8081과 충돌 방지)

```js
// packages/client/package.json
"start": "expo start --port 10000"
```

### 3. Relay 연결 구현

`app/_layout.tsx`에 WebSocket 연결 로직 추가:
- 개발 환경: `ws://localhost:8081` 사용
- 인증 후 자동 연결
- 재연결 로직 포함

### 4. 연동 테스트 결과

**성공:**
- Relay 연결 ✅
- 인증 (Device 2) ✅
- UI 렌더링 ✅

**미완료 (Pylon 기능 미구현):**
- desk_list 요청/응답 ❌
- 데스크 목록 표시 ❌

---

## 확인된 이슈

### Pylon 기능 부재

Pylon에 다음 핸들러 미구현:
- `desk_list` → `desk_list_result`
- Claude SDK 세션 관리
- 워크스페이스 CRUD

임시 우회: 인증 후 바로 `setDesksLoaded(true)` 호출

### UI 스타일

기본 동작은 하지만 Flutter 대비 스타일 다듬기 필요:
- 그림자, 라운딩
- 애니메이션
- 폰트/간격 조정

---

## 다음 단계

1. **Pylon 기능 구현** (Phase 2)
   - desk_list 핸들러
   - Claude SDK 연동
   - 메시지 저장/로드

2. **Client UI 개선**
   - NativeWind 스타일 다듬기
   - Flutter와 동등한 UX

---

*작성: 2026-02-01*
