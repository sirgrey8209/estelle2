---
name: tdd-flow
description: |
  TDD 방식으로 기능을 구현할 때 사용. 다음 상황에서 자동 실행:
  - "~를 구현해줘", "~를 만들어줘", "~를 추가해줘" 요청
  - "TDD로 ~", "테스트부터 ~" 요청
  - 새로운 함수, 클래스, 모듈 구현 요청
  Plan → Test → Verify → Impl → Refactor 단계를 서브에이전트로 분리 실행하여 context 오염 방지.
argument-hint: "구현하고 싶은 내용"
---

# TDD Flow

TDD 전체 사이클을 서브에이전트로 실행하여 context 분리를 보장하는 워크플로우.

---

## PM 초기 지시문

> 이 스킬이 호출되면, **당신(메인 에이전트)이 PM 역할**을 수행합니다.
>
> **1-PLAN은 PM이 직접 수행합니다** (사용자와 논의 필요).
> **2-TEST부터는 Task 도구로 서브에이전트에게 위임**합니다.
>
> **즉시 수행할 것:**
> 1. `reference/1-plan.md`를 읽고 절차 확인
> 2. 사용자 요청(`$ARGUMENTS`)을 분석하여 요구사항 논의 시작
> 3. 코드베이스 탐색, 플랜 문서 작성, 사용자 승인 요청
> 4. 승인 후 2-TEST부터 서브에이전트 호출 (Task 도구 사용)

---

## 사용법

```
/tdd-flow 구현하고 싶은 내용
```

예시:
```
/tdd-flow PylonState.handlePacket에서 패킷 타입에 따라 적절한 핸들러 호출
/tdd-flow 메시지 스토어에 대화 삭제 기능 추가
/tdd-flow RelayClient 재연결 로직
```

인자: `$ARGUMENTS` 전체가 구현 요청 내용

---

## 단계 구조

```
[1-PLAN]     → 논의 + 플랜 작성 + 승인
[2-TEST]     → 테스트 작성
[3-VERIFY]   → 테스트 검증 + 실패 확인
[4-IMPL]     → 구현 + 통과 확인
[5-REFACTOR] → 리팩토링 + 통과 유지 확인
```

---

## 문서 구조

두 개의 문서를 `wip/` 폴더에 생성한다.

| 문서 | 내용 | 수정 가능 단계 |
|------|------|---------------|
| `[대상]-plan.md` | 구현 목표, 방향, 영향 범위 | 1-PLAN만 |
| `[대상]-tdd.md` | 테스트 케이스, 진행 상태, 파일 경로, 로그 | 모든 단계 |

### plan 문서 템플릿

```markdown
# [대상] 구현 계획

## 구현 목표
[한 문장으로 요약]

## 구현 방향
[어떻게 구현할지 설명]

## 영향 범위
- 수정 필요: ...
- 신규 생성: ...
```

### tdd 문서 템플릿

```markdown
# [대상] TDD

## 상태
📋 1-PLAN

## 테스트 케이스
(2-TEST에서 작성)

## 파일
- 플랜: wip/[대상]-plan.md
- 테스트: (2-TEST에서 기록)
- 구현: (4-IMPL에서 기록)

## 재시도 횟수
- 2-TEST → 3-VERIFY: 0/3
- 4-IMPL: 0/3

## 로그
- [YYMMDD HH:MM] 1-PLAN 시작
```

### 상태 이모지

| 단계 | 이모지 | 의미 |
|------|--------|------|
| 1-PLAN | 📋 | 계획 수립 중 |
| 2-TEST | 🔴 | RED - 실패하는 테스트 작성 |
| 3-VERIFY | 🔍 | 테스트 검증 중 |
| 4-IMPL | 🟢 | GREEN - 구현 완료 |
| 5-REFACTOR | 🔧 | REFACTOR - 코드 품질 개선 |
| 완료 | ✅ | TDD 사이클 완료 |

---

## 단계별 핵심

| 단계 | 핵심 | 금지 | 산출물 |
|------|------|------|--------|
| 1-PLAN | 목표 명확화, **명시적 승인 대기** | 추측으로 진행, 자동 전환 | plan 문서, tdd 문서 |
| 2-TEST | FAILING 테스트, AAA 패턴 | 구현 코드 작성 | 테스트 파일 |
| 3-VERIFY | FIRST 원칙, 실패 확인 | - | - |
| 4-IMPL | 테스트 통과하는 구현 | 테스트 수정 | 구현 파일 |
| 5-REFACTOR | 품질 개선, 통과 유지 | 기능 추가 | - |

---

## 단계별 프롬프트 레퍼런스

| 단계 | 실행 주체 | 레퍼런스 파일 | 입력 변수 |
|------|----------|--------------|----------|
| 1-PLAN | **PM 직접** | [reference/1-plan.md](reference/1-plan.md) | `{{요청내용}}` |
| 2-TEST | 서브에이전트 | [reference/2-test.md](reference/2-test.md) | `{{plan파일}}`, `{{tdd파일}}` |
| 3-VERIFY | 서브에이전트 | [reference/3-verify.md](reference/3-verify.md) | `{{tdd파일}}`, `{{테스트파일}}` |
| 4-IMPL | 서브에이전트 | [reference/4-impl.md](reference/4-impl.md) | `{{tdd파일}}`, `{{테스트파일}}` |
| 5-REFACTOR | 서브에이전트 | [reference/5-refactor.md](reference/5-refactor.md) | `{{tdd파일}}`, `{{테스트파일}}`, `{{구현파일}}` |

---

## PM(메인 에이전트) 책임

PM은 전체 TDD 사이클을 조율하며 다음을 담당한다:

1. **1-PLAN 직접 수행** - 사용자와 논의, 플랜 작성, 승인 획득
2. **서브에이전트 호출** - 2-TEST부터 Task 도구로 위임
3. **단계 전환 결정** - 각 단계 완료 여부 판단
4. **문서 상태 관리** - tdd 문서의 상태/로그 업데이트
5. **실패 카운터 관리** - tdd 문서에 재시도 횟수 기록

### 서브에이전트 호출 형식

```typescript
// Task 도구 사용
{
  subagent_type: "general-purpose",
  prompt: `
    ${reference_md_content}  // reference/*.md 내용

    ## 변수
    - 대상: ${대상}
    - 기능설명: ${기능설명}
    - plan파일: wip/${대상}-plan.md
    - tdd파일: wip/${대상}-tdd.md
    ...
  `,
  description: "TDD ${단계명}"
}
```

### 변수 치환

PM이 서브에이전트 호출 시 직접 치환한다:

| 변수 | 값 |
|------|-----|
| `{{요청내용}}` | `$ARGUMENTS` 전체 |
| `{{대상}}` | 1-PLAN에서 사용자와 논의 후 결정 |
| `{{plan파일}}` | `wip/[대상]-plan.md` |
| `{{tdd파일}}` | `wip/[대상]-tdd.md` |
| `{{테스트파일}}` | tdd 문서에서 읽어옴 |
| `{{구현파일}}` | tdd 문서에서 읽어옴 |

---

## 테스트 실행 가이드

### 프로젝트 테스트 구조

```
packages/
├── core/tests/       # @estelle/core 테스트
├── relay/tests/      # @estelle/relay 테스트
└── pylon/tests/      # @estelle/pylon 테스트
```

- **테스트 러너**: vitest
- **테스트 위치**: `packages/[패키지명]/tests/` 폴더

### 테스트 명령어

```bash
# 전체 테스트
pnpm test

# 특정 패키지 테스트
pnpm --filter @estelle/core test
pnpm --filter @estelle/relay test
pnpm --filter @estelle/pylon test

# 특정 파일 테스트
pnpm --filter @estelle/pylon test tests/state.test.ts

# watch 모드 (개발 시)
pnpm --filter @estelle/pylon test:watch
```

### 테스트 파일 경로 규칙

| 구현 파일 | 테스트 파일 |
|----------|------------|
| `packages/pylon/src/state.ts` | `packages/pylon/tests/state.test.ts` |
| `packages/pylon/src/utils/logger.ts` | `packages/pylon/tests/utils/logger.test.ts` |
| `packages/core/src/types/message.ts` | `packages/core/tests/types/message.test.ts` |

### 서브에이전트에서 테스트 실행 시

파일 경로에서 패키지를 추론하여 명령어 구성:

```typescript
// 예: 테스트 파일이 packages/pylon/tests/state.test.ts인 경우
const testFile = "packages/pylon/tests/state.test.ts";
const pkg = "@estelle/pylon";  // 경로에서 추론
const relativePath = "tests/state.test.ts";  // packages/pylon/ 제거

// 실행 명령어
`pnpm --filter ${pkg} test ${relativePath}`
```

---

## PM 실행 로직

### 1-PLAN (PM 직접 수행)

```
1. reference/1-plan.md 읽기
2. PM이 직접 수행 (서브에이전트 사용 안 함):
   - 사용자와 요구사항 논의
   - 코드베이스 탐색
   - 규모 검토 및 분할 제안
3. 문서 생성
   - wip/[대상]-plan.md
   - wip/[대상]-tdd.md (상태: 📋 1-PLAN)
4. 사용자 승인 요청
5. ⚠️ 사용자의 명시적 승인("진행해", "OK", "좋아" 등)이 있을 때만 → 2-TEST
   미승인/피드백 시 → 플랜 수정 후 재요청
```

> **중요**: 1-PLAN은 PM이 직접 수행합니다. 사용자와의 논의가 필요하기 때문입니다.
> 2-TEST부터 서브에이전트를 사용합니다.

### 2-TEST

```
1. reference/2-test.md 읽기
2. Task 도구로 서브에이전트 실행
   - subagent_type: "general-purpose"
   - prompt: 2-test.md + plan파일/tdd파일 경로
   - plan 문서의 목표/방향 참고하여 테스트 작성
3. tdd 문서 업데이트
   - 테스트 케이스 목록 작성
   - 테스트 파일 경로 기록
   - 상태: 🔴 2-TEST
4. → 3-VERIFY
```

### 3-VERIFY

```
1. reference/3-verify.md 읽기
2. Task 도구로 서브에이전트 실행
   - subagent_type: "general-purpose"
   - prompt: 3-verify.md + tdd파일/테스트파일 경로
   - FIRST 원칙 검증, 테스트 품질 검토
3. 검증 통과 시:
   - pnpm test 실행
   - 실패하면 → 4-IMPL (정상)
   - 통과하면 → 2-TEST (테스트가 잘못됨), 재시도 횟수 +1
4. 검증 실패 시:
   - 수정 피드백 제공
   - → 2-TEST, 재시도 횟수 +1
5. 재시도 횟수 3회 도달 → 1-PLAN으로 복귀 (재논의 필요)
```

### 4-IMPL

```
1. reference/4-impl.md 읽기
2. Task 도구로 서브에이전트 실행
   - subagent_type: "general-purpose"
   - prompt: 4-impl.md + tdd파일/테스트파일 경로
   - 테스트 통과하는 구현 작성
3. pnpm test 실행
   - 통과 시:
     - tdd 문서에 구현 파일 경로 기록
     - 상태: 🟢 4-IMPL
     - → 5-REFACTOR
   - 실패 시:
     - tdd 문서 재시도 횟수 +1
     - 재시도 (최대 3회)
     - 3회 실패 → 사용자에게 보고
```

### 5-REFACTOR

```
1. reference/5-refactor.md 읽기
2. tdd 문서 상태 업데이트: 🔧 5-REFACTOR
3. Task 도구로 서브에이전트 실행
   - subagent_type: "general-purpose"
   - prompt: 5-refactor.md + tdd파일/테스트파일/구현파일 경로
   - 코드 품질 개선
4. pnpm test 실행
   - 통과 시:
     - 상태: ✅ 완료
     - → 완료 처리
   - 실패 시:
     - 리팩토링 롤백
     - 상태: ✅ 완료 (리팩토링 스킵)
```

---

## 단계 전환 요약

| 현재 | 성공 | 실패 |
|------|------|------|
| 1-PLAN | **사용자 명시적 승인** → 2-TEST | 피드백 → 플랜 수정 |
| 2-TEST | → 3-VERIFY | → 1-PLAN (3회 실패 시) |
| 3-VERIFY | → 4-IMPL (테스트 실패 확인) | → 2-TEST (테스트 수정) |
| 4-IMPL | → 5-REFACTOR | 재시도 (3회) → 사용자 보고 |
| 5-REFACTOR | → 완료 | 롤백 → 완료 |

---

## 완료 처리

```
✅ TDD 사이클 완료

생성된 파일:
- {{테스트 파일}}
- {{구현 파일}}

테스트 결과: X개 통과

→ 문서를 log/로 이동하시겠습니까?
```

### 문서 이동

두 문서를 통합하여 `log/YYMMDD-[대상].md`로 이동:

```markdown
# [대상]

## 구현 목표
(plan에서)

## 구현 방향
(plan에서)

## 테스트 케이스
(tdd에서)

## 파일
- 테스트: ...
- 구현: ...

## 진행 로그
(tdd에서)
```

이동 후 wip/ 원본 삭제.
