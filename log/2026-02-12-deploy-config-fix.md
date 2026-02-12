# 배포 설정 통합 작업

## 상태: 완료 ✅

## 문제 배경

Dev 환경은 `ESTELLE_ENV_CONFIG` JSON 방식으로 설정을 전달하지만, Stage/Release 배포 스크립트는 구 버전(개별 환경변수) 방식을 사용하고 있었음.

## 변경 사항

### 1. environments.json 업데이트

**추가된 설정:**

```json
// stage.pylon
"dataDir": "./stage-data"

// release.pylon
"dataDir": "./release-data"

// release.beacon (신규)
{
  "enabled": true,
  "host": "127.0.0.1",
  "port": 9875,
  "env": "release",
  "reconnect": true,
  "reconnectInterval": 3000
}
```

### 2. deploy-common.ps1 수정

`New-EcosystemConfig` 함수를 JSON 방식으로 변경:

- 파라미터 추가: `-DataDir`
- `ESTELLE_ENV_CONFIG` 환경변수에 JSON 문자열 주입
- 개별 환경변수들 제거 (fallback은 bin.ts에서 처리)

### 3. 호출부 수정

- `build-deploy.ps1`: DataDir 파라미터 추가
- `promote-stage.ps1`: DataDir 파라미터 추가

## 테스트 결과

1. [x] PowerShell에서 JSON 문자열 생성 확인 ✅
2. [x] Stage 빌드 테스트 ✅ `(stage)v0212_1`
3. [x] PM2 환경변수 주입 확인 ✅
4. [x] Pylon 시작 시 설정 로드 확인 ✅

## 해결된 이슈

### 이슈 1: PowerShell 파이프라인 버퍼링

**원인**: `$obj | ConvertTo-Json` 방식은 특정 함수 컨텍스트에서 빈 문자열 반환

**해결**:
```powershell
# 변경 전 (파이프라인 - 이슈 발생)
$envConfigJson = ($envConfigObj | ConvertTo-Json -Depth 10 -Compress)

# 변경 후 (직접 호출 - 정상 동작)
$envConfigJson = ConvertTo-Json -InputObject $envConfigObj -Depth 10 -Compress
```

### 이슈 2: JavaScript 문자열 이스케이프

**원인**: JSON을 JS 문자열에 넣을 때 `"` 와 `\` 이스케이프 필요

**해결**:
```powershell
# .Replace() 메서드로 이스케이프 (체이닝 가능)
$envConfigJsonEscaped = $envConfigJson.Replace('\', '\\').Replace('"', '\"')
```

### 이슈 3: PowerShell -replace 체이닝

**원인**: `-replace` 연산자 체이닝 시 빈 문자열 반환

**해결**: `.Replace()` 문자열 메서드 사용 (정규식이 아닌 리터럴 치환)

## 검증된 Stage 설정

```
Relay URL: wss://estelle-relay-v2-stage.fly.dev ✅
Data Dir: C:\WorkSpace\estelle2\stage-data\data ✅
Claude Config Dir: C:\Users\LINEGAMES\.claude-stage ✅
Beacon: 127.0.0.1:9875 (stage) ✅
MCP Port: 9877 ✅
```

## 관련 파일

- `config/environments.json`
- `scripts/deploy-common.ps1`
- `scripts/build-deploy.ps1`
- `scripts/promote-stage.ps1`
- `packages/pylon/src/bin.ts` (설정 로딩)
