# CLAUDE.md

## 프로젝트 개요

heimdall — 여러 대상을 폴링해 변경 시 Discord로 알리는 워처 모음. pnpm workspace 모노레포.

## 기술 스택

- TypeScript (strict), tsx로 실행 (빌드 없이 소스 직접 실행)
- pnpm workspace
- Node.js 내장 fetch (외부 HTTP 라이브러리 없음)

## 구조

```
packages/core/   # @heimdall/core — 도메인 무관 공용 인프라
  src/storage.ts   # createStorage: JSON 파일 상태 저장/로드 (제네릭)
  src/discord.ts   # sendDiscord: 웹훅 전송 + dry-run 옵션, COLOR 상수
  src/logger.ts    # createLogger: 표준 로거 (console + logs/<워처>-YYYY-MM-DD.log)
apps/scourt/     # 나의사건검색(ssgo) 워처. 상세는 apps/scourt/CLAUDE.md
apps/switch2/    # 롯데마트 스위치2 재고 워처. 상세는 apps/switch2/CLAUDE.md
```

- 앱은 fetch·diff만 자기 안에 두고, 상태 저장·알림·로그는 core에서 가져온다.
- core 패키지는 빌드 없이 소스를 노출한다(`exports` → `./src/index.ts`). tsx 런타임과 tsc가 소스를 직접 참조한다.
- 새 워처는 `apps/<이름>/`에 추가하고 `@heimdall/core`를 `workspace:*`로 의존한다.

## 로그

core `createLogger(name, logDir)`로 표준화. 루트 `logs/<워처>-YYYY-MM-DD.log`에 `[ISO] [워처] LEVEL: 메시지` 포맷으로 남고 console에도 출력된다. 앱이 `new URL("../../../logs/", import.meta.url)`로 루트 logs를 주입한다. cron은 리다이렉트 없이 `run.sh <앱>`만 호출한다(부트 원시 출력은 `logs/run-<앱>.log`).

## 실행

```bash
pnpm check    # scourt 1회 조회 (run.sh가 호출)
pnpm start    # scourt 데몬 모드
pnpm dry      # scourt dry-run (실제 조회, 미전송·미저장)

pnpm --filter switch2 dry     # switch2 dry-run
pnpm --filter switch2 start   # switch2 데몬 (30~60초 간격)
```

## 배포

Ubuntu 서버에서 `run.sh` + cron. cron 환경 PATH 문제로 run.sh 래퍼가 필요(nvm node 경로 지정).
`run.sh <앱>`으로 워처별로 cron에 따로 등록한다. switch2를 초 단위로 돌리려면 cron 대신
데몬 모드(`pnpm --filter switch2 start`)를 systemd/nohup으로 상시 구동한다.
