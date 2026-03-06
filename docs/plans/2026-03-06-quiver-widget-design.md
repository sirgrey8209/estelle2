# QuiverAI Arrow 위젯 설계

## 개요

QuiverAI Arrow API를 활용하여 에스텔에서 AI SVG 생성 기능을 제공하는 위젯.

## 목표

- 텍스트 프롬프트로 SVG 생성
- SSE 스트리밍으로 실시간 SVG 렌더링
- 생성된 SVG 파일 저장 및 전송

## 구조

```
estelle2/
├── widget/
│   └── quiver/                    # QuiverAI SVG 생성 위젯 (독립 프로젝트)
│       ├── package.json           # 독립 의존성 (@quiverai/sdk)
│       ├── tsconfig.json
│       ├── src/
│       │   └── index.ts           # CLI 진입점 (Widget Protocol v2)
│       └── dist/
```

## 흐름

```
Claude → run_widget 호출
    ↓
위젯 CLI 시작
    ↓
1. render: SVG 뷰어 UI 렌더링 (프롬프트 입력 + 빈 SVG 영역)
    ↓
2. 사용자 프롬프트 입력 → event로 CLI에 전달
    ↓
3. QuiverAI API 호출 (stream: true)
    ↓
4. SSE 이벤트마다 event로 SVG 데이터 전송 → Client JS가 SVG 영역만 업데이트
    ↓
5. 완료 시 파일 저장 + complete 메시지
```

## 메시지 프로토콜

### CLI → Client

| 타입 | 메시지 | 설명 |
|------|--------|------|
| `render` | `{ type: 'script', html, code }` | 초기 UI 렌더링 |
| `event` | `{ type: 'status', phase: 'reasoning' }` | 추론 중 상태 |
| `event` | `{ type: 'svg', phase: 'draft', data: '...' }` | 초안 SVG 스트리밍 |
| `event` | `{ type: 'svg', phase: 'done', data: '...', path: '...' }` | 완료 + 파일 경로 |
| `complete` | `{ success: true, path: '...' }` | 세션 종료 |

### Client → CLI

| 타입 | 메시지 | 설명 |
|------|--------|------|
| `event` | `{ type: 'prompt', text: '...' }` | 사용자 프롬프트 입력 |
| `cancel` | - | 위젯 종료 요청 |

## UI 구성

### 초기 상태
- 프롬프트 입력창
- 생성 버튼
- 빈 SVG 캔버스 영역

### 생성 중
- 프롬프트 입력 비활성화
- 진행 상태 표시 (reasoning → draft → content)
- SVG 실시간 렌더링

### 완료
- 최종 SVG 표시
- 파일 저장 경로 표시
- 다운로드 버튼
- 새로 생성 버튼

## 파일 저장

- 위치: `estelle2/uploads/svg/` 또는 `data/svg/`
- 파일명: `quiver-{timestamp}.svg`
- 완료 후 경로를 Claude에게 반환

## estelle-widget 스킬 추가

```markdown
### quiver
- 용도: AI SVG 생성 (QuiverAI Arrow)
- 호출: run_widget(command: "pnpm start", cwd: "/home/estelle/estelle2/widget/quiver")
- 기능: 텍스트 프롬프트 → 실시간 SVG 생성 → 파일 저장
```

## 기술 스택

- TypeScript
- @quiverai/sdk (QuiverAI 공식 SDK)
- Widget Protocol v2 (stdin/stdout JSON Lines)

## API 설정

- API Key: 환경변수 `QUIVERAI_API_KEY`
- Rate Limit: 조직당 60초에 20 요청
- 모델: `arrow-preview`

## 향후 확장

- `vectorize_image`: 이미지 → SVG 변환
- `edit_svg`: 기존 SVG 수정
- PNG/JPEG 내보내기 (Pro 플랜 필요)
