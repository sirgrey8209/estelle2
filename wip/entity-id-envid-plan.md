# EntityId envId 확장 구현 계획

## 구현 목표
EntityId에 envId 2비트를 추가하여 환경(release=0, stage=1, dev=2)을 구분하고, 기존 release entityId와 호환성 유지

## 구현 방향

### 비트 레이아웃 변경
```
현재 (21비트):
[pylonId: 4비트][workspaceId: 7비트][conversationId: 10비트]

변경 (23비트):
[envId: 2비트][pylonId: 4비트][workspaceId: 7비트][conversationId: 10비트]
```

### envId 값
- `0` = release (기존 entityId와 동일 → 호환성 유지)
- `1` = stage
- `2` = dev

### 핵심 포인트
- `envId=0`이면 기존 entityId와 값이 같음 (앞에 `00` 비트가 붙는 것이므로)
- `encodeEntityId(envId, pylonId, workspaceId, conversationId)` 형태로 변경
- `decodeEntityId()` 반환에 `envId` 추가
- 기존 레거시 함수는 `envId=0` 기본값으로 호환성 유지

## 영향 범위
- 수정 필요:
  - `packages/core/src/utils/entity-id.ts` - 인코딩/디코딩 로직
  - `packages/core/tests/utils/entity-id.test.ts` - 테스트
- 신규 생성: 없음
