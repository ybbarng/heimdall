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
├── scourt/          # 나의사건검색(ssgo) 소송 진행 알림 (cron)
└── switch2/         # 롯데마트 스위치2 전국 재고 지도·통계 (폴링 데몬 + web/)
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

Ubuntu 서버에서 `run.sh` + cron. `run.sh`에 앱 이름을 넘기면 그 워처만 1회 조회하므로,
crontab에 워처를 따로 등록해 각각 켜고 끌 수 있다. 인자를 생략하면 scourt로 동작한다.

```
5 * * * * /home/ybbarng/heimdall/run.sh scourt
* * * * * /home/ybbarng/heimdall/run.sh switch2
```

### switch2 — 폴링 데몬 + 전국 재고 지도 (byb.kr)

switch2는 전국을 `POLL_SECONDS`(기본 5분)마다 훑어 지도·통계용 상태만 갱신하는
**데몬**이라 cron이 아닌 상시 구동한다(Discord 알림 없음). byb.kr 서버는 pm2를 쓰므로:

```bash
cd /home/ybbarng/heimdall && git pull && pnpm install
cp apps/switch2/.env.example apps/switch2/.env   # 필요하면 POLL_SECONDS 조정(기본값이면 생략 가능)
pm2 restart switch2 || pm2 start pnpm --name switch2 -- --filter switch2 start
pm2 save
```

**전국 재고 지도**(`apps/switch2/web/index.html`)는 nginx로 서빙한다. 페이지가 같은
디렉토리의 `markets.json`·`state.json`을 읽으므로, 웹루트에 두 파일을 symlink로 건다:

nginx root를 `web/`으로 두고, 그 안에 워처 데이터를 symlink로 연결한다(웹루트를 건드리지
않아 sudo 없이 심링크 가능). byb.kr은 apex 아래 경로로 서빙 중이다:

```bash
# web/ 안에 데이터 심링크 (sudo 불필요)
cd /home/ybbarng/heimdall/apps/switch2/web
ln -sf ../markets.json markets.json
ln -sf ../data/state.json state.json
ln -sf ../data/events.jsonl events.jsonl
# (sudo) apex 웹루트에서 web/을 노출
sudo ln -s /home/ybbarng/heimdall/apps/switch2/web /srv/www/main/switch2
```

- 지도: `https://byb.kr/switch2/` · 패턴: `https://byb.kr/switch2/stats.html`
- 워처가 `state.json`·`events.jsonl`을 갱신하면 30초 안에 자동 반영된다

#### switch2 완전 제거 (스위치2 관심이 끝났을 때)

지도·통계까지 다 걷어낼 때 서버에서 아래 순서로 정리한다. 데몬 → 웹 노출 → 코드 순.

```bash
# 1) 데몬 중지·삭제 (pm2 프로세스명 switch2, scourt는 cron이라 무관)
pm2 delete switch2 && pm2 save
# 2) nginx 노출 심링크 제거 (root 소유라 sudo)
sudo rm /srv/www/main/switch2
# 3) 코드·데이터 삭제 (data/ 안에 state.json·events.jsonl 이력이 있으니 필요하면 먼저 백업)
cd /home/ybbarng/heimdall && git rm -r apps/switch2 && rm -rf apps/switch2/data
git commit -m "switch2 워처 제거" && git push
pnpm install    # workspace에서 switch2 정리
```

- web/ 안 데이터 심링크(`markets.json`·`state.json`·`events.jsonl`)는 `apps/switch2`를 지우면 같이 사라진다
- scourt 등 다른 워처는 건드리지 않는다. core는 계속 쓰이므로 `packages/core`는 남긴다

## 새 워처 추가

1. `apps/<이름>/` 에 `package.json`(`@heimdall/core` 의존), `tsconfig.json`, `src/index.ts` 생성
2. fetch·diff 로직만 앱에 구현하고 상태 저장·알림·로그는 core 사용
3. 루트 `package.json`에 필요하면 스크립트 위임 추가
