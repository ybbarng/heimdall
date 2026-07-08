# heimdall

여러 대상을 주기적으로 폴링해, 변경이 감지되면 Discord로 알려주는 워처 모음.

> 북유럽 신화에서 heimdall은 아스가르드의 파수꾼으로, 온 세상을 지켜보다가 이상이 생기면 알린다.

## 구조

pnpm workspace 모노레포.

```
packages/
└── core/            # @heimdall/core — 도메인 무관 공용 인프라
    ├── storage.ts   # JSON 파일 상태 저장/로드 (제네릭)
    ├── discord.ts   # Discord 웹훅 전송 + dry-run
    └── logger.ts    # 표준 로거 (logs/<워처>-YYYY-MM-DD.log)
apps/
└── scourt/          # 나의사건검색(ssgo) 소송 진행 알림
```

각 워처는 "무엇을 가져오나(fetch)"와 "무엇을 변경으로 볼까(diff)"만 자기 앱에 두고, 상태 저장·알림·로그는 core를 쓴다. 폴링 주기 같은 실시간성 차이는 앱별 설정값으로 흡수한다.

## 로그

모든 워처가 core `createLogger`로 루트 `logs/`에 `<워처>-YYYY-MM-DD.log` 형태의 표준 로그를 남긴다. cron 리다이렉트가 아니라 앱이 로그 위치를 직접 관리한다. `run.sh`는 부트 단계 원시 출력만 `logs/run.log`로 남긴다.

## 개발

```bash
pnpm install          # workspace 전체 설치

pnpm check            # scourt 1회 조회
pnpm start            # scourt 데몬 모드
pnpm dry              # scourt dry-run (미전송·미저장)
```

앱 하나만 다루려면 `pnpm --filter <앱> <스크립트>`.

## 배포

Ubuntu 서버에서 `run.sh` + cron. cron은 `run.sh`만 호출한다.

```
5 * * * * /home/ybbarng/heimdall/run.sh
```

## 새 워처 추가

1. `apps/<이름>/` 에 `package.json`(`@heimdall/core` 의존), `tsconfig.json`, `src/index.ts` 생성
2. fetch·diff 로직만 앱에 구현하고 상태 저장·알림·로그는 core 사용
3. 루트 `package.json`에 필요하면 스크립트 위임 추가
