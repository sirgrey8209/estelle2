# Linux 환경 분석 결과 (Windows 비교용)

## 현재 Linux 상태

| 항목 | 값 |
|------|-----|
| `release/pylon/node_modules` | **심볼릭 링크** → `../../packages/pylon/node_modules` |
| `release/pylon/node_modules/@estelle/core` | **심볼릭 링크** → `../../../core` (= `release/core`) |
| `release/core/dist` | executor가 매번 최신으로 복사 ✅ |
| `release/node_modules/@estelle/core` | executor가 매번 최신으로 복사 ✅ |
| pylon 상태 | 정상 동작 중 |

## 핵심 차이점 (추정)

| 환경 | `release/pylon/node_modules` | `@estelle/core` |
|------|------------------------------|-----------------|
| **Linux** | 심볼릭 링크 → `packages/pylon/node_modules` | 심볼릭 링크 (항상 최신) |
| **Windows** | 물리적 디렉토리 (pnpm install로 생성) | 물리적 복사본 (stale) |

## 문제 원인

1. **Windows에서 심볼릭 링크가 안 먹혀서** `release/pylon/`에서 `pnpm install` 실행
2. pnpm이 `file:../core` 의존성을 **물리적 복사본**으로 설치
3. **executor.ts는 `release/pylon/node_modules/@estelle/core`를 업데이트 안 함**
4. Node.js ESM이 가장 가까운 `node_modules`를 먼저 찾음 → stale 복사본 선택

```
release/pylon/dist/pylon.js에서 import '@estelle/core'
  1순위: release/pylon/node_modules/@estelle/core  ← stale 복사본 (여기서 멈춤)
  2순위: release/node_modules/@estelle/core        ← 최신 (여기까지 안 감)
```

## Windows에서 확인할 것

```powershell
# 1. release/pylon/node_modules가 심볼릭인지 물리적 디렉토리인지
dir release\pylon\node_modules

# 2. @estelle/core가 심볼릭인지 물리적인지
dir release\pylon\node_modules\@estelle\

# 3. core의 widget.js에 isWidgetClaimPayload가 있는지
findstr "isWidgetClaimPayload" release\pylon\node_modules\@estelle\core\dist\types\widget.js

# 4. 최신 core에는 있는지 비교
findstr "isWidgetClaimPayload" release\core\dist\types\widget.js
```

## 해결 방안

### 방안 A: executor.ts에서 stale copy 삭제 (간단)

```typescript
// executor.ts Step 6에 추가
for (const pkg of ['pylon', 'relay']) {
  const staleDir = path.join(releaseDir, pkg, 'node_modules', '@estelle');
  if (fs.existsSync(staleDir)) {
    fs.rmSync(staleDir, { recursive: true });
    log(`  Removed stale release/${pkg}/node_modules/@estelle`);
  }
}
```

→ Node.js가 `release/node_modules/@estelle/core`로 fallback

### 방안 B: Windows에서 심볼릭 링크 재생성 (근본 해결)

```powershell
# 관리자 권한 필요
rmdir /s /q release\pylon\node_modules
mklink /D release\pylon\node_modules ..\..\packages\pylon\node_modules
```

## 질문

1. Windows에서 `release/pylon/node_modules`가 물리적 디렉토리인지 확인 필요
2. 왜 `pnpm install`을 해야 했는지? (심볼릭 링크 권한 문제?)
3. 심볼릭 링크로 통일할 수 있는지, 아니면 방안 A로 가야 하는지?

---

*분석일: 2026-03-06*
*Linux pylon uptime: 43분, 0 restarts*
