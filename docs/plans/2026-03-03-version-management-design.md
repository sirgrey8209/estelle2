# 버전 관리 시스템 디자인

## 개요

Estelle의 버전을 git에 커밋하여 관리하고, 모든 컴포넌트(Relay/Pylon/Client)가 동일한 버전 파일을 참조하도록 한다.

## 목표

1. 단일 버전 파일(`config/version.json`)을 git에 커밋
2. `/estelle-patch` 스킬에서 버전 증가 + 배포를 일관되게 처리
3. 설정창에 Client/Relay/각 Pylon의 버전 표시
4. Pylon 1번 옆에 계정 전환 버튼 표시

## 버전 파일

**위치:** `config/version.json`

```json
{
  "version": "v0303_3",
  "buildTime": "2026-03-03T03:53:07.731Z"
}
```

**특징:**
- git에 커밋됨 (`.gitignore`에서 제거)
- `config/build-counter.json`은 로컬 카운터로 유지

## `/estelle-patch` 플로우

```
1. 버전 증가
   - config/build-counter.json에서 카운터 읽기/증가
   - config/version.json 업데이트

2. Git 커밋 & 푸시
   - git add config/version.json + 다른 staged 파일들
   - git commit -m "patch: vMMDD_N"
   - git push origin master

3. Updater 트리거
   - npx tsx packages/updater/src/cli.ts trigger all master
   - 모든 머신에서 git pull + pnpm deploy:release
```

## 각 컴포넌트의 버전 로드

| 컴포넌트 | 버전 로드 방식 |
|---------|--------------|
| **Relay** | 시작 시 `config/version.json` 읽기, 메모리에 저장 |
| **Pylon** | 시작 시 `config/version.json` 읽기, Relay 연결 시 전송 |
| **Client** | 빌드 시 Vite define으로 임베드 |

## 프로토콜 변경

### Pylon → Relay (연결 시)

기존 `device:register` 메시지에 `version` 필드 추가:

```typescript
{
  type: 'device:register',
  payload: {
    deviceId: 1,
    version: 'v0303_3'  // 새로 추가
  }
}
```

### Relay → Client (접속 시)

기존 `init` 메시지에 버전 정보 추가:

```typescript
{
  type: 'init',
  payload: {
    relayVersion: 'v0303_3',  // 새로 추가
    pylons: [
      { id: 1, name: 'office', version: 'v0303_3' },
      { id: 2, name: 'home', version: 'v0303_2' }
    ]
  }
}
```

## 설정창 UI

**위치:** 설정창 최상단

```
버전 정보
─────────────────
Client: v0303_3
Relay:  v0303_3
Pylon 1 (office): v0303_3  [LineGames ▼]
Pylon 2 (home):   v0303_2
```

**특징:**
- Pylon은 ID순으로 정렬
- Pylon 1번만 계정 전환 버튼 표시
- 버전 불일치 시 시각적 표시 (예: 빨간색)

## 정리할 것

1. **제거:**
   - `scripts/deploy/` 디렉토리 (또는 단순화)
   - `packages/relay/public/version.json`
   - MCP 도구의 `deploy` 액션 (stage/release/promote)

2. **수정:**
   - `.gitignore`에서 `config/version.json` 제거
   - `/estelle-patch` 스킬에 버전 증가 스크립트 추가
   - `pnpm deploy:release`는 유지 (updater가 호출)

## 구현 순서

1. `config/version.json` 생성 및 `.gitignore` 수정
2. Relay/Pylon에서 버전 파일 로드 로직 추가
3. 프로토콜 메시지에 버전 필드 추가
4. Client 빌드 설정에 버전 임베드
5. Client 설정창 UI 구현
6. `/estelle-patch` 스킬 업데이트
7. 기존 deploy 관련 코드 정리
