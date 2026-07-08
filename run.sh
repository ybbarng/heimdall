#!/bin/bash
# cron에서 이 스크립트를 호출한다. 인자로 앱 이름을 주면 그 워처만 1회 조회한다.
#   ./run.sh          → scourt (기본, 하위호환)
#   ./run.sh switch2  → switch2
# 앱은 core 로거로 logs/<워처>-YYYY-MM-DD.log 에 구조화 로그를 남기고,
# 이 스크립트는 부트 단계(pnpm/tsx 실패 등) 원시 출력을 logs/run-<앱>.log 로 남긴다.
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd "$(dirname "$0")"
APP="${1:-scourt}"
mkdir -p logs
exec >> "logs/run-$APP.log" 2>&1
echo "=== $(date -Iseconds) [$APP] run 시작 ==="
pnpm --filter "$APP" check
