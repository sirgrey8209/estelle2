# build-release.ps1 변수 스코프 에러

## 현상

`.\scripts\build-release.ps1` 실행 시 Step 4 (Pylon 패키지 복사) 에서 반복적으로 에러 발생:

```
Get-Content : 'Path' 매개 변수값이 null이므로 인수를 해당 매개 변수에 바인딩할 수 없습니다.
위치 C:\WorkSpace\estelle2\scripts\build-release.ps1:92
+ $pylonPkgContent = Get-Content -Path $pylonPkgPath -Raw
+                                      ~~~~~~~~~~~~~
```

## 원인

`$PylonDst` 변수가 80번 줄에서 정상 설정되지만, Copy-Item 호출들(84~88번 줄)을 거친 후 92번 줄에서 참조하면 `$null`이 됨.

- `Write-Host`로 디버그 출력을 중간에 넣으면 정상 동작
- `Join-Path` 대신 문자열 보간(`"$PylonDst\package.json"`)으로 바꿔도 동일 에러
- `$ReleaseDir`로 직접 경로를 구성해도 동일 에러

**정확한 근본 원인은 불명.** Bash 환경에서 PowerShell을 `-File` 옵션으로 실행할 때 발생하는 변수 스코프/평가 순서 이슈로 추정.

## 해결

92번 줄 앞에서 `$PylonDst`를 **재할당**하고, `Write-Host`를 한 줄 넣으면 정상 동작:

```powershell
# workspace:* -> file:../core 변환 (변수 스코프 이슈로 경로 재구성)
$PylonDst = Join-Path $ReleaseDir "pylon"
$pylonPkgPath = "$PylonDst\package.json"
Write-Host "  Pylon package.json: $pylonPkgPath" -ForegroundColor Gray
$pylonPkgContent = Get-Content -Path $pylonPkgPath -Raw
```

## 재현 조건

- Windows PowerShell (5.x)
- Git Bash에서 `powershell.exe -ExecutionPolicy Bypass -File` 으로 실행
- `$ErrorActionPreference = "Stop"` 설정 상태
- Copy-Item 호출 후 변수 참조 시 발생

## 참고

- PowerShell 7 (pwsh)에서는 재현 안 될 수 있음
- 직접 PowerShell 터미널에서 실행하면 재현 안 될 수 있음
- Bash → PowerShell 실행 시 특유의 환경 차이가 원인일 가능성
