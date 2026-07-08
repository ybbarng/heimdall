# CLAUDE.md (switch2)

롯데마트 모바일 도와센터를 폴링하여 닌텐도 스위치2 재고가 바뀔 때 Discord 웹훅으로
알리는 워처. heimdall 모노레포의 앱. 공용 인프라(상태 저장·Discord 전송·로거)는
`@heimdall/core`에서 가져온다.

## 주요 구조

```
apps/switch2/src/
├── index.ts    # 진입점. --once 1회 조회 / --dry-run 미전송·미저장 / 기본은 폴링 데몬
├── api.ts      # 지점별 재고 조회 (search_product_list.asp GET)
├── parse.ts    # 부분 HTML → 상품명·재고 파싱 (정규식, 외부 파서 없음)
├── diff.ts     # 이전 재고와 비교해 입고·품절·수량변경 감지
├── notify.ts   # 재고 알림 embed 빌드 (core sendDiscord로 전송)
└── types.ts    # 타입 정의
```

core에서 쓰는 것: `createStorage`(상태 저장), `sendDiscord`(전송), `createLogger`(로그).

## 재고 API

세션·쿠키 없이 GET 하나로 지점별 재고 수량까지 나온다:

```
GET https://company.lottemart.com/mobiledowa/inc/asp/search_product_list.asp
    ?p_market=<지점코드>&p_schWord=<검색어>&page=1
```

부분 HTML(`<li>` 목록)을 돌려준다. 각 항목의 `.prod-name`이 상품명, 상세 테이블의
`ㆍ재고 :` 행이 재고(`10 개` 또는 `품절`). 서울 지점 목록은
`search_market_list.asp?p_area=서울&p_type=1&p_werks=0`로 조회한다.

## 설정 파일

- `.env` (gitignore) — DISCORD_WEBHOOK_URL, POLL_INTERVAL_SECONDS, FAIL_ALERT_THRESHOLD,
  SEARCH_WORD, TARGET_PRODUCTS
- `markets.json` (커밋됨) — 감시 지점 목록 `[{ code, name, mapUrl? }]`. 기본은 서울
  동부 + 경기 동부·동남부. 지점을 늘리거나 줄이려면 배열만 고치면 된다. `mapUrl`이
  없으면 지점명으로 네이버지도 검색 링크를 자동 생성한다
- `data/state.json` (자동 생성) — 지점×상품 마지막 재고 상태

## 지점 확장·변경

전국 지점 코드·주소·본체 취급 여부는 `docs/markets.md`에 정리돼 있다. `markets.json`을
바꿀 때 여기서 코드를 찾는다. **본체 미취급(✗)** 지점(토이저러스·맥스 등)은 넣어도 알림이
오지 않는다. 지점이 개편되면 아래로 문서를 다시 만든다(전국 훑어 재고 취급 여부까지 갱신):

```bash
node apps/switch2/scripts/collect-markets.mjs   # docs/markets.md 재생성
```

## 알림 규칙

상태가 유지되는 동안에는 알리지 않아 폴링마다 반복 알림이 나가지 않는다.

- 최초 조회 + 재고 있음 → 재입고 알림
- 품절 → 재고 → 재입고 알림
- 재고 → 품절 → 품절 알림
- 재고 유지 & 수량 변경 → 재고 변동 알림

짧은 주기라 순간 오류가 잦으므로, 연속 실패가 `FAIL_ALERT_THRESHOLD`에 닿을 때만
오류 알림을 1회 보낸다.

## 실행

```bash
pnpm --filter switch2 dry     # dry-run (실제 조회, 미전송·미저장)
pnpm --filter switch2 check   # 1회 조회 (cron용)
pnpm --filter switch2 start   # 데몬 모드 (POLL_INTERVAL_SECONDS 간격)
```

cron은 최소 1분 주기라 30초 감시는 안 된다. 초 단위로 빠르게 감시하려면
`start`(데몬)를 systemd/nohup으로 상시 구동한다.
