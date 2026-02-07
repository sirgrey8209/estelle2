# Safe Release Build Pipeline 구현

## 배경

기존 `build-release.ps1`는 PM2를 먼저 종료하고 release/ 폴더를 삭제한 뒤 재구축하는 방식이었음.
빌드 중간에 실패하면 서비스가 내려간 상태에서 복구가 불가능하고, 모바일에서 에스텔로 조작 중일 때 수동 개입이 어려웠음.

## 변경 내용

### 1. build-release.ps1 전면 재작성

**Phase 구조:**
- Phase 0: 사전 검증 (pnpm, pm2, config)
- Phase 1: TypeScript 빌드 (기존 release/ 가동 중 - 무영향)
- Phase 2: Staging 빌드 (release.staging/)
- Phase 3: Staging 무결성 검증 (필수 파일 + junction 유효성)
- Phase 4: Atomic Swap (pm2 kill → rename 2회)
- Phase 5: PM2 시작 + 헬스체크 (최대 15초, 5회 시도)
- Phase 6: 성공 시 rollback 정리 / 실패 시 자동 롤백

**실패 시 복구 경로:**
- Phase 0~3 실패: staging 삭제, 기존 release/ 무영향
- Phase 4 실패: release.rollback → release 복원
- Phase 5 실패 (헬스체크): 역swap + 이전 버전 PM2 재시작

### 2. 데이터 분리 (release-data/)

- `release/pylon/data/`와 `release/pylon/uploads/`를 빌드 영역 밖 `release-data/`로 분리
- release 폴더 안에서는 junction(심볼릭 링크)으로 연결
- 빌드/swap 시 데이터는 절대 이동하지 않음 → 데이터 손실 위험 제로
- 첫 실행 시 기존 데이터 자동 마이그레이션 (Initialize-DataDir)

### 3. sync-data.ps1 junction 대응

- `release-data/data/` (신규 구조) 우선 감지
- `release/pylon/data` (레거시) 폴백
- junction인 경우에도 투명하게 동작

### 4. .gitignore 업데이트

- `release-data/`, `release.staging/`, `release.rollback/`, `release.failed/` 추가

## 구현 중 발견한 이슈

### Rename-Item Access Denied

- `Rename-Item`은 Windows PowerShell에서 디렉토리 rename 시 간헐적으로 "Access Denied" 발생
- `[System.IO.Directory]::Move()`로 대체하여 해결

### PM2 daemon 폴더 핸들

- `pm2 stop/delete`로는 PM2 God daemon이 여전히 폴더 핸들을 잡고 있음
- `pm2 kill`로 daemon 자체를 종료해야 rename 가능

### Junction 안전 규칙

- `Remove-Item -Recurse`를 junction 포함 폴더에 적용하면 타겟 데이터 삭제됨
- `Remove-DirectorySafe` 함수: 하위 junction을 `cmd /c rmdir`로 먼저 제거 후 폴더 삭제

## 수정 파일

| 파일 | 변경 |
|------|------|
| `scripts/build-release.ps1` | 전면 재작성 (safe pipeline) |
| `scripts/sync-data.ps1` | release-data/ 경로 대응 |
| `.gitignore` | 새 폴더 패턴 추가 |
| `CLAUDE.md` | Release 빌드 섹션 업데이트 |

## 검증 결과

- 정상 빌드: Phase 0~6 통과, PM2 online, Relay 연결 확인
- 데이터 보존: release-data/data/workspaces.json 빌드 전후 동일
- Junction 동작: release/pylon/data, release/pylon/uploads 모두 ReparsePoint 확인
