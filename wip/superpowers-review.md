# Superpowers 도입 검토

> 검토일: 2025-02-09
> 레포: https://github.com/obra/superpowers

## 개요

**Superpowers** = Claude Code용 소프트웨어 개발 워크플로우 프레임워크
- GitHub 스타: ~47,000+
- 핵심: "스킬" 기반 자동화된 개발 방법론

## 핵심 워크플로우

```
brainstorming → git-worktree → writing-plans → subagent-driven-development → TDD → code-review → finish-branch
```

1. **brainstorming** - 코드 작성 전 아이디어 정제, Socratic 질문으로 요구사항 구체화
2. **using-git-worktrees** - 격리된 브랜치 작업 환경 구성
3. **writing-plans** - 2-5분 단위 태스크로 분할된 상세 구현 계획
4. **subagent-driven-development** - 태스크당 fresh 서브에이전트 + 2단계 리뷰
5. **test-driven-development** - RED-GREEN-REFACTOR 강제
6. **requesting-code-review** - 태스크 간 자동 리뷰 체크포인트
7. **finishing-a-development-branch** - 머지/PR 결정 워크플로우

## 설치 시 포함되는 것

### Skills (14개)
- brainstorming
- dispatching-parallel-agents
- executing-plans
- finishing-a-development-branch
- receiving-code-review
- requesting-code-review
- subagent-driven-development
- systematic-debugging
- test-driven-development
- using-git-worktrees
- using-superpowers
- verification-before-completion
- writing-plans
- writing-skills

### Commands
- `/brainstorm`
- `/execute-plan`
- `/write-plan`

### Hooks
- SessionStart: 세션 시작 시 자동으로 스킬 사용법 주입

## 저희 tdd-flow와 비교

| 항목 | tdd-flow (현재) | Superpowers |
|------|-----------------|-------------|
| TDD 강제 | ✅ | ✅ |
| 서브에이전트 분리 | ✅ (Plan→Test→Impl) | ✅ + **2단계 리뷰** |
| 브레인스토밍 | ❌ | ✅ 체계적 질문 |
| Git Worktree | ❌ | ✅ 격리된 브랜치 |
| 실행 계획 | Plan 단계에서 간단히 | ✅ 2-5분 단위 태스크 |
| 코드 리뷰 | ❌ | ✅ 태스크마다 자동 |
| 디버깅 가이드 | ❌ | ✅ systematic-debugging |

## 인상적인 포인트

### 1. Subagent-Driven Development
- 태스크마다 **새 서브에이전트** 생성 → context 오염 방지
- **2단계 리뷰**: 스펙 준수 리뷰 → 코드 품질 리뷰
- 자동화된 수시간 자율 작업 가능

### 2. TDD "철의 법칙"
> "테스트 없이 프로덕션 코드 없음. 테스트 전에 코드 작성했으면? 삭제하고 처음부터."

- 테스트가 먼저 실패하는 걸 직접 봐야 함
- "나중에 테스트" = TDD 아님
- 변명/합리화 목록까지 정리

### 3. Writing Plans
- 모든 태스크가 2-5분 단위
- 정확한 파일 경로, 완전한 코드, 검증 단계 포함
- "판단력 없는 주니어 엔지니어도 따라할 수 있을 정도로"

## 도입 방안

### 방안 1: 직접 설치 + 테스트
```bash
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```
- 장점: 즉시 체험 가능
- 단점: tdd-flow와 충돌 가능성 (동시 트리거)

### 방안 2: 좋은 것만 차용 (권장)
tdd-flow에 다음 개념 통합:
- [ ] brainstorming 단계 추가
- [ ] 2단계 리뷰 (스펙 준수 → 코드 품질)
- [ ] 더 세분화된 태스크 분할 (2-5분 단위)
- [ ] systematic-debugging 스킬 추가

### 방안 3: 완전 교체
- tdd-flow 제거
- Superpowers로 전환
- 장점: 검증된 시스템
- 단점: 저희 상황에 맞지 않을 수 있음

## 결정 필요 사항

1. 어떤 방안으로 진행할지
2. 방안 2 선택 시, 어떤 개념부터 도입할지 우선순위

## 참고 링크

- 레포: https://github.com/obra/superpowers
- 블로그: https://blog.fsck.com/2025/10/09/superpowers/
- Marketplace: https://github.com/obra/superpowers-marketplace
