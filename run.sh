#!/bin/bash
# cron에서 이 스크립트만 호출하면 된다 (로그 리다이렉트 불필요).
# 앱은 core 로거로 logs/<워처>-YYYY-MM-DD.log 에 구조화 로그를 남기고,
# 이 스크립트는 부트 단계(pnpm/tsx 실패 등) 원시 출력을 logs/run.log 로 남긴다.
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd "$(dirname "$0")"
mkdir -p logs
exec >> "logs/run.log" 2>&1
echo "=== $(date -Iseconds) run 시작 ==="
pnpm check
