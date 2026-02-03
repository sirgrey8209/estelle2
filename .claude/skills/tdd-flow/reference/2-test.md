# 2-TEST: 테스트 작성

## 입력
- plan 파일: {{plan파일}}
- tdd 파일: {{tdd파일}}

## 역할
plan 문서의 목표/방향을 바탕으로 **FAILING 테스트**를 작성하라.

---

## 규칙

### 해야 할 것
1. plan 문서 읽고 구현 목표 파악
2. 테스트 코드만 작성 (`.test.ts` 파일)
3. 존재하지 않는 함수/클래스를 호출하는 테스트
4. AAA 패턴 사용 (Arrange-Act-Assert)
5. 테스트 이름: `should_[동작]_when_[조건]`
6. 기존 테스트 확인 - 수정 필요한 것이 있는지

### 포함할 케이스
- 정상 케이스 (happy path)
- 엣지 케이스 (빈 값, null, 경계값)
- 에러 케이스

### 금지
1. 구현 코드 작성
2. 테스트 대상 함수/클래스 구현
3. Mock으로 존재하지 않는 코드 대체
4. import 에러 무시 (의도된 것)

---

## tdd 문서 업데이트

테스트 작성 후 tdd 문서를 업데이트한다:

```markdown
## 상태
🔴 2-TEST

## 테스트 케이스
1. [정상] should_do_something_when_valid_input
2. [정상] should_return_result_when_called
3. [엣지] should_handle_empty_input
4. [에러] should_throw_when_invalid

## 파일
- 플랜: wip/[대상]-plan.md
- 테스트: packages/xxx/src/xxx.test.ts  ← 추가
- 구현: (4-IMPL에서 기록)

## 재시도 횟수
- 2-TEST → 3-VERIFY: 0/3  ← 실패 시 +1
- 4-IMPL: 0/3

## 로그
- [YYMMDD HH:MM] 1-PLAN 승인
- [YYMMDD HH:MM] 2-TEST 시작  ← 추가
```

---

## 출력

- 테스트 파일 경로
- 테스트 케이스 목록
- 테스트 실행 시 실패해야 함 (구현이 없으므로)
