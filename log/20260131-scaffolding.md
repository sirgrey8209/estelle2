# 프로젝트 초기 세팅 계획

> estelle2 모노레포 구조 세팅

---

## 목표 구조

```
estelle2/
├── packages/
│   ├── core/                 # 공유 타입, 메시지 스키마
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── relay/                # Relay 서버
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── pylon/                # Pylon 서비스
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── app/                  # Flutter 앱
│       └── (Flutter 프로젝트)
├── doc/                      # 문서 (완료)
├── wip/                      # 진행 중 작업
├── package.json              # 루트 (스크립트, devDependencies)
├── pnpm-workspace.yaml       # 모노레포 설정
├── tsconfig.base.json        # 공유 TS 설정
└── .gitignore
```

---

## 단계별 계획

### 1단계: 루트 설정

**1.1 pnpm 초기화**
```bash
pnpm init
```

**1.2 pnpm-workspace.yaml**
```yaml
packages:
  - 'packages/*'
```

**1.3 루트 package.json**
```json
{
  "name": "estelle2",
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^2.0.0"
  }
}
```

**1.4 tsconfig.base.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

**1.5 .gitignore**
```
node_modules/
dist/
*.log
.DS_Store
```

---

### 2단계: core 패키지

**2.1 폴더 생성**
```
packages/core/
├── src/
│   └── index.ts
├── tests/
│   └── index.test.ts
├── package.json
└── tsconfig.json
```

**2.2 package.json**
```json
{
  "name": "@estelle/core",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

**2.3 tsconfig.json**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**2.4 src/index.ts (빈 시작점)**
```typescript
// @estelle/core
// 공유 타입과 유틸리티

export {};
```

**2.5 tests/index.test.ts (첫 테스트)**
```typescript
import { describe, it, expect } from 'vitest';

describe('core', () => {
  it('should work', () => {
    expect(1 + 1).toBe(2);
  });
});
```

---

### 3단계: relay 패키지

**3.1 폴더 생성**
```
packages/relay/
├── src/
│   └── index.ts
├── tests/
│   └── index.test.ts
├── package.json
└── tsconfig.json
```

**3.2 package.json**
```json
{
  "name": "@estelle/relay",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@estelle/core": "workspace:*"
  }
}
```

**3.3 tsconfig.json**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

---

### 4단계: pylon 패키지

**4.1 폴더 생성**
```
packages/pylon/
├── src/
│   └── index.ts
├── tests/
│   └── index.test.ts
├── package.json
└── tsconfig.json
```

**4.2 package.json**
```json
{
  "name": "@estelle/pylon",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@estelle/core": "workspace:*"
  }
}
```

**4.3 tsconfig.json**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

---

### 5단계: app 패키지 (Flutter)

**5.1 Flutter 프로젝트 생성**
```bash
cd packages
flutter create app --org com.estelle --project-name estelle_app
```

**5.2 기본 구조 정리**
```
packages/app/
├── lib/
│   ├── main.dart
│   ├── core/           # 상수, 유틸
│   ├── data/           # 모델, 서비스
│   ├── state/          # Riverpod Provider
│   └── ui/             # 위젯, 레이아웃
├── test/
├── pubspec.yaml
└── ...
```

**5.3 pubspec.yaml 주요 의존성**
```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_riverpod: ^2.4.0
  web_socket_channel: ^2.4.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
```

**5.4 간단한 연결 테스트 UI**
- Relay 연결 상태 표시
- 간단한 메시지 송수신

---

### 6단계: 검증

```bash
# Node 패키지 의존성 설치
pnpm install

# 전체 빌드 (core, relay, pylon)
pnpm build

# 전체 테스트
pnpm test

# 타입 체크
pnpm typecheck

# Flutter 앱 실행
cd packages/app && flutter run -d chrome
```

---

## 체크리스트

- [x] 루트 package.json
- [x] pnpm-workspace.yaml
- [x] tsconfig.base.json
- [x] .gitignore
- [x] packages/core 세팅
- [x] packages/relay 세팅
- [x] packages/pylon 세팅
- [x] packages/app 세팅 (Flutter)
- [x] pnpm install 성공
- [x] pnpm build 성공
- [x] pnpm test 성공 (23개 테스트 통과)
- [x] flutter run 성공 (Chrome에서 확인)

---

## 예상 소요

파일 생성 + 설정 작성: 약 10개 파일

---

*작성일: 2026-01-31*
