# 릴리즈 세팅 현황

## 완료된 작업

### 1. 포트 정규화
- Relay: 8081 → 8080
- Pylon: 9101 → 9000

### 2. 릴리즈 빌드 구조

```
release/
├── core/
│   ├── dist/           # @estelle/core 빌드 결과
│   └── package.json
├── pylon/
│   ├── dist/           # @estelle/pylon 빌드 결과
│   ├── node_modules/   # 의존성 (복사됨)
│   ├── ecosystem.config.cjs  # PM2 설정
│   └── package.json
├── relay/
│   ├── dist/           # @estelle/relay 빌드 결과
│   ├── node_modules/   # 의존성 (복사됨)
│   ├── Dockerfile      # Fly.io 배포용
│   ├── fly.toml        # Fly.io 설정
│   ├── deploy.ps1      # 배포 스크립트
│   └── package.json
├── client/
│   ├── dist/           # Expo 웹 빌드 결과
│   ├── ecosystem.config.cjs  # PM2 설정
│   └── serve.cjs       # 웹 서버 래퍼
└── install.ps1         # 의존성 설치 스크립트
```

### 3. 빌드 스크립트

```bash
# 릴리즈 빌드 생성
scripts/build-release.ps1
```

스크립트 기능:
- packages/*/dist 복사
- node_modules 복사 (pnpm workspace 호환성 문제 해결)
- PM2 설정 파일 생성 (.cjs 확장자 - ES module 호환)
- Fly.io Dockerfile/fly.toml 생성

### 4. Relay - Fly.io 배포 (완료)

```
URL: https://estelle-relay-v2.fly.dev
Region: nrt (Tokyo)
Machines: 2
```

배포 명령:
```bash
cd release/relay
fly deploy
```

### 5. Pylon - PM2 실행 (완료)

```bash
cd release/pylon
pm2 start ecosystem.config.cjs
```

| 항목 | 값 |
|------|-----|
| 이름 | estelle-pylon |
| 포트 | 9000 |
| 로그 | ~/.pm2/logs/estelle-pylon-*.log |

### 6. Client 웹 서버 - PM2 실행 (완료)

```bash
cd release/client
pm2 start ecosystem.config.cjs
```

| 항목 | 값 |
|------|-----|
| 이름 | estelle-client |
| 포트 | 3000 |
| URL | http://localhost:3000 |

---

### 7. APK 빌드 (완료)

**해결 방법:**

1. `@react-native-community/cli` 설치
2. `@react-native/metro-config` 설치
3. `react-native-vector-icons` 설치
4. `react-native bundle` 명령으로 JS 번들 생성
5. `build.gradle`에 afterEvaluate로 번들 태스크 비활성화
6. `gradlew assembleRelease` 실행

**빌드 명령:**
```bash
# APK 빌드 스크립트
.\scripts\build-apk.ps1

# 또는 수동 실행
pnpm --filter @estelle/client exec react-native bundle \
  --platform android --dev false \
  --entry-file node_modules/expo-router/entry.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

cd packages/client/android
./gradlew assembleRelease
```

**결과:**
```
경로: packages/client/android/app/build/outputs/apk/release/app-release.apk
크기: ~76 MB
```

---

## 과거 시도 기록 (참고용)

#### 준비된 환경

- Android SDK: `C:\Users\LINEGAMES\AppData\Local\Android\Sdk`
- AVD: Pixel6 (Android 34, google_apis, x86_64)
- 에뮬레이터 버전: 36.3.10
- Build Tools: 33.0.1, 34.0.0, 35.0.0, 36.0.0
- NDK: 27.1.12297006

---

## APK 빌드 실패 기록

### 시도 1: gradlew assembleRelease (직접 실행)

**명령어:**
```bash
cd packages/client/android
./gradlew assembleRelease
```

**에러:**
```
Error: Unable to resolve module ./../../node_modules/expo-router/entry.js
from C:\WorkSpace\estelle2/.:

None of these files exist:
  * ..\..\..\..\node_modules\expo-router\entry.js
```

**원인:**
- 모노레포 구조에서 Metro bundler가 실행될 때 cwd가 `android/` 폴더
- expo-router entry point 경로가 상대경로 `../../node_modules/...`로 해석됨
- 실제 node_modules는 `packages/client/node_modules`와 루트 `node_modules`에 분산

**분석:**
- React Native Gradle 빌드 시 `createBundleReleaseJsAndAssets` 태스크가 Metro를 호출
- Metro가 android 폴더 기준으로 경로를 해석하면서 실패

---

### 시도 2: EAS 로컬 빌드

**명령어:**
```bash
cd packages/client
npx eas build --local --platform android --profile preview
```

**에러:**
```
An Expo user account is required to proceed.
Log in to EAS with email or username
Input is required, but stdin is not readable.
```

**원인:**
- EAS 빌드(로컬 포함)는 Expo 계정 로그인 필수
- 비대화형 환경에서 로그인 프롬프트 처리 불가

**해결 필요:**
- `npx eas login` 으로 사전 로그인
- 또는 `EXPO_TOKEN` 환경변수 설정

---

### 시도 3: expo export 후 번들 복사 + gradlew 빌드

**1단계 - 번들 생성 (성공):**
```bash
cd packages/client
npx expo export --platform android
# 성공: dist/_expo/static/js/android/entry-*.hbc 생성
```

**2단계 - 번들 복사:**
```bash
cp -r dist/* android/app/src/main/assets/
```

**3단계 - 번들 생성 태스크 스킵하고 빌드 (실패):**
```bash
cd android
./gradlew assembleRelease -x createBundleReleaseJsAndAssets
```

**에러:**
```
Execution failed for task ':app:packageReleaseResources'.
> Querying the mapped value of flatmap(provider(task 'createBundleReleaseJsAndAssets', ...))
  before task ':app:createBundleReleaseJsAndAssets' has completed is not supported
```

**원인:**
- Gradle 태스크 의존성 그래프에서 `packageReleaseResources`가 `createBundleReleaseJsAndAssets`의 출력을 참조
- `-x` 옵션으로 태스크를 스킵해도 의존성 평가 시점에 출력값 조회 시도
- React Native Gradle Plugin의 태스크 구조상 완전한 스킵 불가

**분석:**
- `expo export`로 생성된 번들은 웹용 (.hbc 파일이지만 경로 구조가 다름)
- Android 네이티브 빌드는 `index.android.bundle` 형식 필요
- 태스크 의존성이 강하게 결합되어 있어 우회 어려움

---

### 시도 4: react-native bundle 명령 직접 실행

**명령어:**
```bash
cd packages/client
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file node_modules/expo-router/entry.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
```

**에러:**
```
⚠️ react-native depends on @react-native-community/cli for cli commands.
To fix update your package.json to include:
  "devDependencies": {
    "@react-native-community/cli": "latest",
  }
```

**원인:**
- Expo 프로젝트는 react-native CLI를 직접 포함하지 않음
- `@react-native-community/cli` 패키지 미설치

**해결 시도 중단:**
- 사용자가 추가 의존성 설치 거부

---

### 시도 5: 에뮬레이터 headless 모드 실행

**명령어:**
```bash
# AVD 생성 (성공)
avdmanager create avd -n Pixel6 -k "system-images;android-34;google_apis;x86_64" -d "pixel_6"

# 에뮬레이터 시작 (실패)
emulator -avd Pixel6 -no-window -no-audio -no-boot-anim &
sleep 30
adb devices
# 결과: List of devices attached (비어있음)
```

**에러:**
- 에뮬레이터 프로세스가 시작 후 즉시 종료
- `tasklist | grep emulator` 결과 프로세스 없음

**원인 추정:**
- Windows에서 headless 모드 실행 시 GPU 가속 문제 가능성
- 백그라운드 실행(`&`)이 Windows bash에서 제대로 동작하지 않음
- HAXM 또는 Hyper-V 가속기 설정 문제 가능성

---

## 근본 원인 분석

### 모노레포 + Expo + React Native 빌드 복잡성

```
estelle2/
├── node_modules/          # 루트 (hoisted)
├── packages/
│   └── client/
│       ├── node_modules/  # 로컬 (심볼릭 링크)
│       └── android/       # 네이티브 프로젝트
│           └── app/
```

**문제점:**
1. pnpm 워크스페이스는 node_modules를 심볼릭 링크로 관리
2. Metro bundler가 android/ 폴더에서 실행되면 상대경로 해석 실패
3. Gradle은 프로젝트 루트를 android/로 인식
4. metro.config.js의 watchFolders/nodeModulesPaths 설정이 Gradle 빌드 시 무시됨

---

## 해결 방안

### 방안 1: Android Studio GUI 빌드 (권장)

1. Android Studio 실행
2. `packages/client/android` 폴더를 프로젝트로 열기
3. Build > Build Bundle(s) / APK(s) > Build APK(s)
4. APK 경로: `android/app/build/outputs/apk/release/app-release.apk`

**장점:** Metro bundler가 올바른 환경에서 실행됨

### 방안 2: EAS 클라우드 빌드

```bash
npx eas login
npx eas build --platform android --profile preview
```

**장점:** 클라우드에서 깨끗한 환경으로 빌드

### 방안 3: 에뮬레이터 GUI 모드 + expo run

```bash
# 1. Android Studio에서 AVD Manager 열기
# 2. Pixel6 에뮬레이터 시작 (GUI)
# 3. 터미널에서:
cd packages/client
npx expo run:android --variant release
```

### 방안 4: metro.config.js 수정 + 환경변수

```javascript
// metro.config.js에 추가
config.projectRoot = projectRoot;
config.resolver.extraNodeModules = {
  'expo-router': path.resolve(workspaceRoot, 'node_modules/expo-router'),
};
```

```bash
# 환경변수 설정 후 빌드
set REACT_NATIVE_PACKAGER_HOSTNAME=localhost
cd packages/client/android
./gradlew assembleRelease
```

---

### 8. GitHub Release 업로드 (완료)

**명령:**
```bash
.\scripts\release-github.ps1 -Version "v2.0.0"
```

**스크립트 기능:**
- gh CLI로 GitHub Release 생성
- APK 파일 자동 업로드
- `-Draft`, `-Prerelease` 옵션 지원

---

## 릴리즈 빌드 스크립트

### 전체 빌드
```bash
# 모든 패키지 빌드 (core, pylon, relay, client)
.\scripts\build-release.ps1

# 옵션
.\scripts\build-release.ps1 -SkipBuild   # TypeScript 빌드 스킵
.\scripts\build-release.ps1 -SkipApk     # APK 빌드 스킵
.\scripts\build-release.ps1 -SkipWeb     # 웹 빌드 스킵
```

### APK만 빌드
```bash
.\scripts\build-apk.ps1
.\scripts\build-apk.ps1 -SkipBundle  # JS 번들 스킵 (이미 있을 때)
```

### GitHub Release
```bash
.\scripts\release-github.ps1 -Version "v2.0.0"
.\scripts\release-github.ps1 -Version "v2.0.0-beta.1" -Prerelease
.\scripts\release-github.ps1 -Version "v2.0.0" -Draft
```

---

## 완료된 작업 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| 포트 정규화 | ✅ | Relay: 8080, Pylon: 9000 |
| 릴리즈 빌드 스크립트 | ✅ | build-release.ps1 |
| Relay 배포 | ✅ | Fly.io |
| Pylon PM2 | ✅ | 포트 9000 |
| Client 웹 서버 | ✅ | PM2, 포트 3000 |
| APK 빌드 | ✅ | build-apk.ps1 |
| GitHub Release | ✅ | release-github.ps1 |

---

## 과거 시도 기록 (참고용)

---

## PM2 관리 명령어

```bash
# 상태 확인
pm2 status

# 로그 보기
pm2 logs

# 재시작
pm2 restart all

# 중지
pm2 stop all

# 부팅 시 자동 시작 설정
pm2 save
pm2 startup
```

---

## 로그

- [260203 22:xx] 포트 정규화 완료
- [260203 22:xx] 릴리즈 빌드 스크립트 생성
- [260203 22:xx] Relay Fly.io 배포 완료
- [260203 22:xx] Pylon PM2 실행 완료
- [260203 22:xx] Client 웹 서버 PM2 실행 완료
- [260203 23:xx] APK 빌드 성공 (react-native bundle + afterEvaluate 해결)
- [260203 23:xx] 릴리즈 스크립트 정비 (build-apk.ps1, release-github.ps1)
