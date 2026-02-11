# textComplete 중복 이벤트 버그 수정

## 구현 목표
`handleAssistantMessage`에서 content 배열에 text 블록이 여러 개 있을 때 `textComplete`가 여러 번 emit되어 메시지가 중복 저장되는 버그를 수정한다.

## 문제 분석

### 현재 동작
```typescript
for (const block of content) {
  if (block.type === 'text' && block.text) {
    this.emitEvent(sessionId, {
      type: 'textComplete',
      text: block.text,  // 각 블록마다 개별 emit
    });
  }
}
```

### 문제 시나리오
Claude가 도구 사용 전후로 텍스트를 출력할 때:
```typescript
message.content = [
  { type: 'text', text: '분석 결과...' },
  { type: 'tool_use', ... },
  { type: 'text', text: '결론적으로...' }
]
```
→ `textComplete`가 2번 발생 → 메시지 2개 저장

## 구현 방향
모든 text 블록을 수집하여 **합친 후 한 번만** `textComplete`를 emit한다.

```typescript
// 수정 후
const textBlocks = content
  .filter(block => block.type === 'text' && block.text)
  .map(block => block.text);

if (textBlocks.length > 0) {
  this.emitEvent(sessionId, {
    type: 'textComplete',
    text: textBlocks.join('\n\n'),  // 합쳐서 한 번만
  });
  session.partialText = '';
}

// tool_use는 별도 처리 (기존과 동일)
```

## 테스트 케이스
1. [정상] should_emit_single_textComplete_when_content_has_multiple_text_blocks
2. [정상] should_emit_single_textComplete_when_content_has_only_multiple_text_blocks
3. [정상] should_emit_single_textComplete_even_with_text_before_and_after_multiple_tools
4. [엣지] should_not_emit_textComplete_when_no_text_blocks_exist
5. [엣지] should_not_emit_textComplete_when_text_blocks_are_empty
6. [엣지] should_emit_textComplete_only_with_non_empty_text_blocks
7. [정상] should_clear_partialText_after_emitting_combined_textComplete

## 파일
- 테스트: packages/pylon/tests/claude/claude-manager.test.ts
- 구현: packages/pylon/src/claude/claude-manager.ts

## 진행 로그
- [250210 21:30] 1-PLAN 시작
- [250210 16:54] 2-TEST 시작 - 7개 테스트 케이스 작성, 4개 실패 확인
- [250210 16:56] 3-VERIFY 통과 - FIRST 원칙/목표 반영/완성도 검증 완료
- [250210 16:58] 4-IMPL 완료 (47개 테스트 통과)
- [250210 17:01] 5-REFACTOR 완료 - 리팩토링 불필요 (구현 코드 이미 간결함)
