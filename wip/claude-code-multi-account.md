# Claude Code 멀티 계정 전환

## 배경

Claude Code 구독 계정을 2개(회사/개인) 사용 중이며, 매번 로그인하는 번거로움을 해소하기 위한 방법 정리.

## 핵심 원리

`CLAUDE_CONFIG_DIR` 환경 변수로 설정 디렉토리를 분리하면, 계정별 OAuth 인증이 독립적으로 유지된다.

- 기본 경로: `~/.claude/`
- 구독 계정은 API 키 불가, OAuth 인증만 지원

## 설정 방법

### 1. 최초 로그인 (한 번만)

```powershell
# 회사 계정
$env:CLAUDE_CONFIG_DIR = "$env:USERPROFILE\.claude-company"
claude
# → 회사 계정으로 OAuth 로그인

# 개인 계정
$env:CLAUDE_CONFIG_DIR = "$env:USERPROFILE\.claude-personal"
claude
# → 개인 계정으로 OAuth 로그인
```

### 2. PowerShell 프로필에 함수 등록

`$PROFILE` 파일에 추가:

```powershell
function claude-company { $env:CLAUDE_CONFIG_DIR = "$env:USERPROFILE\.claude-company"; claude $args }
function claude-personal { $env:CLAUDE_CONFIG_DIR = "$env:USERPROFILE\.claude-personal"; claude $args }
```

### 3. 사용

```powershell
claude-work       # 회사 계정으로 실행
claude-personal   # 개인 계정으로 실행
```

## 주의사항

- 각 디렉토리는 완전히 독립 (세션, 설정, 히스토리 모두 분리)
- CLAUDE.md 등 프로젝트 설정은 프로젝트 폴더에 있으므로 계정과 무관하게 공유됨
- 글로벌 설정(`~/.claude/settings.json`)은 각 디렉토리별로 따로 관리해야 함
