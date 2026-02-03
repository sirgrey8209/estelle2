# 4-IMPL: 구현

## 입력
- tdd 파일: {{tdd파일}}
- 테스트 파일: {{테스트파일}}

## 역할
테스트를 **모두 통과**하는 **올바른 형태의 구현**을 작성하라.

---

## 규칙

### 해야 할 것
1. 테스트 파일을 먼저 읽고 요구사항 파악
2. 테스트가 기대하는 인터페이스대로 구현
3. 올바른 형태로 구현:
   - 좋은 설계 원칙 적용
   - 적절한 타입 정의
   - 명확한 네이밍
   - 적절한 에러 처리
4. 프로젝트 컨벤션 준수

### 금지
1. **테스트 수정 금지** - 테스트 파일은 절대 수정하지 않음
2. **하드코딩 금지**:
   ```typescript
   // ❌ 금지
   function add(a, b) { return 3; }

   // ✅ 올바름
   function add(a: number, b: number): number { return a + b; }
   ```
3. **테스트 범위 초과 금지** - 테스트에 없는 추가 기능 구현 금지
4. **트릭 사용 금지** - 테스트만 통과시키는 꼼수 금지

---

## 구현 후 처리

테스트 실행 (파일 경로에서 패키지 추론):
```bash
# 예: packages/pylon/tests/state.test.ts
pnpm --filter @estelle/pylon test tests/state.test.ts
```

- **통과 시**: → 5-REFACTOR로 진행
- **실패 시**: 수정 후 재시도 (최대 3회)
  - 3회 실패 → 사용자에게 보고

---

## tdd 문서 업데이트

테스트 통과 시:

```markdown
## 상태
🟢 4-IMPL

## 파일
- 플랜: wip/[대상]-plan.md
- 테스트: packages/xxx/src/xxx.test.ts
- 구현: packages/xxx/src/xxx.ts  ← 추가

## 재시도 횟수
- 2-TEST → 3-VERIFY: X/3
- 4-IMPL: Y/3  ← 실패 시 +1

## 로그
- [YYMMDD HH:MM] 1-PLAN 승인
- [YYMMDD HH:MM] 2-TEST 완료
- [YYMMDD HH:MM] 3-VERIFY 통과
- [YYMMDD HH:MM] 4-IMPL 완료 (X개 테스트 통과)  ← 추가
```

---

## 출력

- 구현 파일 경로
- 테스트 실행 결과
- 다음 단계 안내
