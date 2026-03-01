#!/bin/bash
# build-deploy.sh - Linux용 빌드/배포 스크립트
#
# 사용법:
#   ./scripts/build-deploy.sh release
#   ./scripts/build-deploy.sh stage
#
# 주요 기능:
#   1. TypeScript 빌드 (pnpm build)
#   2. version.json 생성
#   3. PM2로 relay/pylon 재시작

set -e

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_PATH="$REPO_ROOT/config/environments.json"
COUNTER_PATH="$REPO_ROOT/config/build-counter.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

log_phase() {
    echo -e "\n${CYAN}[$1]${NC} $2"
}

log_detail() {
    echo -e "  ${GRAY}$1${NC}"
}

log_ok() {
    echo -e "  ${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "  ${RED}✗${NC} $1"
}

# JSON 파싱 (jq 사용)
json_get() {
    local file="$1"
    local path="$2"
    jq -r "$path" "$file" 2>/dev/null
}

# =============================================================================
# Prerequisites Check
# =============================================================================

check_prerequisites() {
    log_phase "Phase 0" "Checking prerequisites..."

    # jq
    if ! command -v jq &> /dev/null; then
        log_error "jq not found. Install: sudo apt install jq"
        exit 1
    fi
    log_detail "jq: $(jq --version)"

    # pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm not found. Install: npm install -g pnpm"
        exit 1
    fi
    log_detail "pnpm: $(pnpm -v)"

    # pm2
    if ! command -v pm2 &> /dev/null; then
        log_error "pm2 not found. Install: npm install -g pm2"
        exit 1
    fi
    log_detail "pm2: $(pm2 -v)"

    # config
    if [ ! -f "$CONFIG_PATH" ]; then
        log_error "Config not found: $CONFIG_PATH"
        exit 1
    fi
    log_detail "Config: OK"

    log_ok "Prerequisites OK"
}

# =============================================================================
# Version Generation
# =============================================================================

generate_version() {
    log_phase "Version" "Generating build version..."

    local today=$(date +"%m%d")
    local build_num=1

    # build-counter.json 읽기
    if [ -f "$COUNTER_PATH" ]; then
        local saved_date=$(json_get "$COUNTER_PATH" ".date // \"\"")
        local saved_counter=$(json_get "$COUNTER_PATH" ".counter // 0")

        if [ "$saved_date" = "$today" ]; then
            build_num=$((saved_counter + 1))
        fi
    fi

    # 카운터 저장
    echo "{\"date\":\"$today\",\"counter\":$build_num}" > "$COUNTER_PATH"

    VERSION="v${today}_${build_num}"
    log_detail "Version: ($TARGET)$VERSION"
}

# =============================================================================
# TypeScript Build
# =============================================================================

build_typescript() {
    log_phase "Phase 1" "Building TypeScript packages..."

    cd "$REPO_ROOT"
    pnpm build

    log_ok "TypeScript build completed"
}

# =============================================================================
# Generate version.json
# =============================================================================

generate_version_json() {
    log_phase "Phase 2" "Generating version.json..."

    local relay_public="$REPO_ROOT/packages/relay/public"
    local build_time=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

    # relay/public 디렉토리 확인
    mkdir -p "$relay_public"

    # version.json 생성
    cat > "$relay_public/version.json" << EOF
{"env":"$TARGET","version":"$VERSION","buildTime":"$build_time"}
EOF

    log_detail "Generated: packages/relay/public/version.json"
    log_ok "version.json created"
}

# =============================================================================
# PM2 Restart
# =============================================================================

restart_pm2() {
    log_phase "Phase 3" "Restarting PM2 services..."

    local relay_name=$(json_get "$CONFIG_PATH" ".$TARGET.relay.pm2Name // \"estelle-relay\"")
    local pylon_name=$(json_get "$CONFIG_PATH" ".$TARGET.pylon.pm2Name // \"estelle-pylon\"")
    local relay_port=$(json_get "$CONFIG_PATH" ".$TARGET.relay.port // 8080")
    local pylon_config=$(json_get "$CONFIG_PATH" ".$TARGET.pylon")

    # Pylon 환경변수 구성
    local pylon_index=$(echo "$pylon_config" | jq -r ".pylonIndex // \"1\"")
    local relay_url=$(echo "$pylon_config" | jq -r ".relayUrl // \"ws://localhost:8080\"")
    local config_dir=$(echo "$pylon_config" | jq -r ".configDir // \"~/.claude\"" | sed "s|~|$HOME|")
    local credentials_dir=$(echo "$pylon_config" | jq -r ".credentialsBackupDir // \"~/.claude-credentials\"" | sed "s|~|$HOME|")
    local mcp_port=$(echo "$pylon_config" | jq -r ".mcpPort // 9876")
    local data_dir=$(echo "$pylon_config" | jq -r ".dataDir // \"./release-data\"")
    local default_working_dir=$(echo "$pylon_config" | jq -r ".defaultWorkingDir // \"$HOME\"")
    local env_id=$(json_get "$CONFIG_PATH" ".$TARGET.envId // 0")

    # 절대 경로로 변환
    if [[ "$data_dir" == ./* ]]; then
        data_dir="$REPO_ROOT/${data_dir#./}"
    fi

    # data 디렉토리 생성
    mkdir -p "$data_dir"

    # ESTELLE_ENV_CONFIG JSON 구성
    local env_config=$(cat << ENVJSON
{"envId":$env_id,"pylon":{"pylonIndex":"$pylon_index","relayUrl":"$relay_url","configDir":"$config_dir","credentialsBackupDir":"$credentials_dir","dataDir":"$data_dir","mcpPort":$mcp_port,"defaultWorkingDir":"$default_working_dir"}}
ENVJSON
)

    # Relay 재시작
    local static_dir="$REPO_ROOT/packages/relay/public"
    log_detail "Stopping $relay_name..."
    pm2 delete "$relay_name" 2>/dev/null || true

    log_detail "Starting $relay_name on port $relay_port..."
    PORT=$relay_port STATIC_DIR="$static_dir" \
    pm2 start "$REPO_ROOT/packages/relay/dist/bin.js" \
        --name "$relay_name" \
        --cwd "$REPO_ROOT"

    # Pylon 재시작
    log_detail "Stopping $pylon_name..."
    pm2 delete "$pylon_name" 2>/dev/null || true

    log_detail "Starting $pylon_name..."
    ESTELLE_VERSION="$VERSION" \
    ESTELLE_ENV_CONFIG="$env_config" \
    pm2 start "$REPO_ROOT/packages/pylon/dist/bin.js" \
        --name "$pylon_name" \
        --cwd "$REPO_ROOT"

    # PM2 저장
    pm2 save

    log_ok "PM2 services restarted"
}

# =============================================================================
# Main
# =============================================================================

main() {
    local start_time=$(date +%s)

    # 인자 확인
    TARGET="${1:-release}"
    if [[ "$TARGET" != "release" && "$TARGET" != "stage" && "$TARGET" != "dev" ]]; then
        echo "Usage: $0 [release|stage|dev]"
        echo "  release - Production build (default)"
        echo "  stage   - Staging build"
        echo "  dev     - Development build"
        exit 1
    fi

    echo -e "${CYAN}=== Estelle v2 Build & Deploy ($TARGET) ===${NC}"

    # 실행
    check_prerequisites
    generate_version
    build_typescript
    generate_version_json
    restart_pm2

    # 완료
    local end_time=$(date +%s)
    local elapsed=$((end_time - start_time))

    echo -e "\n${CYAN}=== Build & Deploy Complete ($TARGET) - ${elapsed}s ===${NC}"
    echo -e "${GRAY}"
    echo "  Version:  ($TARGET)$VERSION"
    echo "  Relay:    $(json_get "$CONFIG_PATH" ".$TARGET.relay.pm2Name")"
    echo "  Pylon:    $(json_get "$CONFIG_PATH" ".$TARGET.pylon.pm2Name")"
    echo -e "${NC}"
}

main "$@"
