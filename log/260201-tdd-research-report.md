# TDD + AI 조사 보고서

> 목적: AI 코딩 어시스턴트(Claude Code, Cursor 등)와 함께 TDD를 효과적으로 수행하기 위한 규칙과 실전 팁 정리

---

## 1. TDD 기본 원칙

### 1.1 Red-Green-Refactor 사이클

| 단계 | 설명 | 핵심 포인트 |
|------|------|-------------|
| 🔴 **Red** | 실패하는 테스트 작성 | 구현 없이 테스트만 작성, 반드시 실패해야 함 |
| 🟢 **Green** | 테스트 통과하는 최소 코드 | 오직 테스트 통과만을 위한 코드, 과잉 구현 금지 |
| 🔵 **Refactor** | 코드 품질 개선 | 테스트는 여전히 통과해야 함, 기술 부채 방지 |

**중요**: Martin Fowler에 따르면 TDD에서 가장 흔한 실수는 **Refactor 단계를 생략**하는 것이다.

### 1.2 FIRST 원칙 (좋은 테스트의 특성)

| 원칙 | 의미 | 설명 |
|------|------|------|
| **F**ast | 빠름 | 유닛 테스트는 밀리초 단위로 실행 |
| **I**ndependent | 독립적 | 테스트 간 의존성 없음 |
| **R**epeatable | 반복 가능 | 어떤 환경에서도 동일한 결과 |
| **S**elf-Validating | 자기 검증 | boolean 결과 (pass/fail) |
| **T**imely | 적시성 | 프로덕션 코드 전에 테스트 작성 |

### 1.3 AAA 패턴

```typescript
it('should calculate total with discount', () => {
  // Arrange - 준비
  const cart = new Cart();
  cart.addItem({ price: 150 });

  // Act - 실행
  const total = cart.calculateTotal();

  // Assert - 검증
  expect(total).toBe(135); // 10% 할인
});
```

---

## 2. AI + TDD의 핵심 문제점

### 2.1 AI의 기본 동작 방식

> "Without explicit instruction, Claude will write implementation code first, then write tests that pass against that implementation."

AI는 **구현 우선 개발**이 기본값이다:
1. 기능 요청 → 구현 코드 작성 → 테스트 작성
2. 이 순서는 TDD의 본질(테스트가 설계를 주도)을 파괴함
3. "자기 숙제 채점하기"가 되어버림

### 2.2 Context 오염 문제

> "When everything runs in one context window, the LLM cannot truly follow TDD."

하나의 컨텍스트에서 모든 작업을 하면:
- 테스트 작성자의 분석이 구현자의 사고에 침투
- 구현 코드 탐색이 리팩토러의 평가를 오염
- 진정한 "테스트 우선"이 불가능

**해결책**: 각 단계를 별도의 프롬프트/에이전트로 분리

### 2.3 AI가 흔히 하는 실수

| 문제 | 원인 | 해결 |
|------|------|------|
| 구현과 테스트 동시 작성 | 효율성 추구 | 명시적으로 "테스트만" 요청 |
| 이미 통과하는 테스트 작성 | 구현을 알고 있음 | "FAILING test" 명시 |
| Mock으로 존재하지 않는 코드 대체 | 컨텍스트 추론 | "TDD 중임" 명시 |
| 과잉 구현 | 미래 요구사항 예측 | "최소 코드만" 강조 |

---

## 3. AI TDD를 위한 필수 규칙

### 3.1 프롬프트 분리 원칙

**절대 하나의 프롬프트에서 Red-Green-Refactor를 모두 요청하지 말 것**

```
❌ 잘못된 예:
"로그인 기능을 TDD로 구현해줘"

✅ 올바른 예:
[프롬프트 1] "로그인 기능의 FAILING 테스트를 작성해줘. 구현하지 마."
[프롬프트 2] "이 테스트를 통과하는 최소 코드를 작성해줘."
[프롬프트 3] "코드를 리팩토링해줘. 테스트는 통과해야 해."
```

### 3.2 명시적 제약 조건

각 단계에서 반드시 포함해야 하는 제약:

#### Red Phase
```
- "Write a FAILING test"
- "Do NOT write implementation yet"
- "The test should fail because the function doesn't exist"
```

#### Green Phase
```
- "Write MINIMUM code to pass"
- "Do NOT modify the tests"
- "Only enough to make tests pass, nothing more"
```

#### Refactor Phase
```
- "Tests must stay green"
- "Focus on [readability/performance/duplication]"
- "Do NOT add new functionality"
```

### 3.3 진행 게이트 (Phase Gates)

각 단계 완료 전 검증:

| 단계 | 진행 조건 |
|------|----------|
| Red → Green | 테스트가 실패함을 확인 (`npm test` 실패) |
| Green → Refactor | 모든 테스트 통과 확인 |
| Refactor → 다음 기능 | 테스트 여전히 통과 + 코드 품질 개선됨 |

---

## 4. 실전 프롬프트 템플릿

### 4.1 Red Phase 템플릿

```
Write a FAILING test for [기능 설명].

Requirements:
- Do NOT write any implementation code
- The test should fail because the function/method doesn't exist
- Use AAA pattern (Arrange-Act-Assert)
- Test name should describe behavior: "should_[동작]_when_[조건]"

Expected behavior: [구체적인 입출력 설명]
```

### 4.2 Green Phase 템플릿

```
Now implement the minimum code to make these tests pass.

Rules:
- Only write enough code to pass the current tests
- Do NOT modify the tests
- Do NOT add extra functionality or edge cases
- Keep iterating until all tests pass
```

### 4.3 Refactor Phase 템플릿

```
Refactor the implementation to improve code quality.

Constraints:
- Tests must stay green after refactoring
- Focus on: [readability / removing duplication / performance]
- Do NOT add new features or change behavior
- Run tests after refactoring to verify
```

### 4.4 복합 기능 처리

여러 기능을 구현할 때:
```
We need to implement features A, B, C.

Process each feature with COMPLETE TDD cycle before moving to next:
1. Feature A: Red → Green → Refactor → Commit
2. Feature B: Red → Green → Refactor → Commit
3. Feature C: Red → Green → Refactor → Commit

Do NOT start Feature B until Feature A's full cycle is complete.
```

---

## 5. 설정 및 자동화

### 5.1 CLAUDE.md TDD 섹션

```markdown
## TDD 개발 원칙

### 필수 워크플로우
1. 기능 요청 시 → 실패하는 테스트 먼저 작성
2. 테스트 실패 확인 후 → 최소 구현
3. 테스트 통과 후 → 리팩토링
4. 각 단계는 별도 요청으로 진행

### 금지 사항
- 테스트와 구현을 동시에 작성하지 않음
- 존재하지 않는 코드에 대한 Mock 사용 금지
- Refactor 단계 생략 금지

### 테스트 작성 규칙
- AAA 패턴 사용 (Arrange-Act-Assert)
- 테스트당 하나의 assertion 권장
- 테스트 이름은 행동 설명: "should_[동작]_when_[조건]"
```

### 5.2 Hook 설정 (자동 테스트 실행)

```yaml
# .claude/hooks.yaml
post_edit:
  - pattern: "**/*.test.ts"
    command: "pnpm test -- --testPathPattern=$FILE"
  - pattern: "**/*.ts"
    command: "pnpm test --watchAll=false"
```

### 5.3 Cursor Rules (.cursor/rules/tdd.mdc)

```markdown
---
description: TDD 강제 규칙
globs: ["**/*.ts", "**/*.test.ts"]
---

# TDD Rules

## 새 기능 구현 시
1. FAILING 테스트를 먼저 작성
2. TDD 중임을 명시 - mock 구현 회피
3. 테스트 실행하여 FAIL 확인
4. 이 단계에서 구현 코드 작성 금지

## 테스트 통과시키기
1. 테스트 통과를 위한 최소 코드 작성
2. 테스트 수정 금지
3. 모든 테스트 통과할 때까지 반복

## 리팩토링
1. 테스트 통과 후에만 리팩토링
2. 리팩토링 전후 테스트 실행
3. 테스트는 계속 통과해야 함
```

---

## 6. 안티패턴과 해결책

### 6.1 프롬프트 안티패턴

| ❌ 잘못된 프롬프트 | 문제점 | ✅ 올바른 프롬프트 |
|------------------|--------|-------------------|
| "Write tests for this feature" | 구현 먼저 함 | "Write FAILING tests" |
| "Add tests and implementation" | TDD 무의미 | 별도 프롬프트로 분리 |
| "Make sure tests pass" | 구현 우선 유도 | "Write minimal code to pass" |
| "Implement with TDD" | 모호함 | 각 단계별 명시적 요청 |

### 6.2 구조적 안티패턴

| 안티패턴 | 문제점 | 해결책 |
|---------|--------|--------|
| 한 컨텍스트에서 전체 사이클 | Context 오염 | 단계별 분리 또는 서브에이전트 |
| Refactor 생략 | 기술 부채 누적 | 체크리스트로 강제 |
| 여러 기능 동시 TDD | 복잡도 폭발 | 한 기능씩 완전한 사이클 |
| 테스트 수정으로 통과시키기 | 테스트 신뢰도 하락 | "Do NOT modify tests" 명시 |

---

## 7. 효과 및 기대 결과

### 7.1 통계적 효과

| 지표 | 개선율 | 출처 |
|------|--------|------|
| 결함 밀도 감소 | 40~90% | IBM, Microsoft 연구 |
| 개발 시간 (초기) | +15~35% | 업계 평균 |
| 프로덕션 버그 감소 | 40~80% | AI-assisted TDD |
| 장기 유지보수 비용 | 대폭 감소 | 코드 품질 향상 |

### 7.2 AI + TDD 시너지

- **TDD의 약점(시간 비용) 해소**: AI가 보일러플레이트, edge case 빠르게 생성
- **AI의 약점(예측 불가 출력) 해소**: 테스트가 명확한 목표 제공
- **자기 수정 가능**: AI가 테스트 실패를 보고 스스로 코드 수정

---

## 8. 참고 자료

### 8.1 공식 문서 및 가이드
- [Martin Fowler - Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Cursor Agent Best Practices](https://cursor.com/blog/agent-best-practices)
- [Claude Code Ultimate Guide - TDD](https://github.com/FlorianBruniaux/claude-code-ultimate-guide)

### 8.2 실전 사례
- [Forcing Claude Code to TDD](https://alexop.dev/posts/custom-tdd-workflow-claude-code-vue/)
- [Kent Beck - TDD with AI Agents](https://newsletter.pragmaticengineer.com/p/tdd-ai-agents-and-coding-with-kent)

### 8.3 도구 및 템플릿
- [barisercan/cursorrules](https://github.com/barisercan/cursorrules) - TDD용 Cursor Rules
- [awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) - Cursor 설정 모음

---

## 9. 다음 단계

이 보고서를 기반으로 작성할 것들:

1. **CLAUDE.md TDD 섹션 업데이트**
   - 현재 프로젝트에 맞는 TDD 규칙 추가

2. **TDD 전용 프롬프트 템플릿**
   - Red/Green/Refactor 각 단계별 프롬프트
   - 프로젝트 컨텍스트 포함

3. **자동화 설정**
   - Hook 설정으로 테스트 자동 실행
   - 단계 전환 시 검증 자동화

4. **Skill 정의 (선택)**
   - TDD 강제 스킬 생성
   - 트리거 키워드 설정
