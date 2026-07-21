# CLAUDE.md (switch2)

롯데마트 모바일 도와센터를 폴링해 닌텐도 스위치2 전국 재고를 모으고 지도·통계로
보여주는 워처. heimdall 모노레포의 앱. 공용 인프라(상태 저장·로거)는
`@heimdall/core`에서 가져온다. Discord 알림은 없다(재고 수집·지도·통계만 한다).

## 주요 구조

```
apps/switch2/
├── src/
│   ├── index.ts    # 진입점. --once 전국 1회 / --dry-run / 기본은 폴링 데몬
│   ├── api.ts      # 지점별 재고 조회 (search_product_list.asp GET)
│   ├── parse.ts    # 부분 HTML → 상품명·재고 파싱 (정규식, 외부 파서 없음)
│   ├── diff.ts     # 이전 재고와 비교해 입고·품절·수량변경 감지
│   ├── history.ts  # 변화 이벤트를 data/events.jsonl에 append (주간 패턴 시각화용)
│   └── types.ts    # 타입 정의
├── scripts/collect-markets.mjs  # 전국 지점 수집 → markets.json(좌표) + docs/markets.md
├── web/index.html  # 전국 재고 지도 대시보드 (Leaflet, state.json 시각화)
├── web/stats.html  # 입고·품절 패턴 (히트맵·지속시간·타임라인, events.jsonl 시각화)
└── markets.json    # 전국 지점 + 좌표 + hasBody
```

core에서 쓰는 것: `createStorage`(상태 저장), `createLogger`(로그).

## 폴링

전국을 한 주기로 조회해 지도·통계용 상태만 갱신한다:

- **본체 취급 지점**을 `POLL_SECONDS`(기본 300초)마다 조회해 `state.json`·`events.jsonl` 갱신
- 본체 미취급(`hasBody:false`) 지점은 폴링하지 않고 지도에만 '미취급'으로 표시
- 지점 간 0.3초 간격으로 조회해 버스트를 피한다(어뷰징 방지)

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

- `.env` (gitignore) — POLL_SECONDS, SEARCH_WORD, TARGET_PRODUCTS
- `markets.json` (커밋됨) — 전국 지점 `[{ code, name, address, lat, lng, hasBody }]`.
  `collect-markets.mjs`가 생성한다
- `data/state.json` (자동 생성) — 지점×상품 마지막 재고 상태. 지도가 이걸 읽는다
- `data/events.jsonl` (자동 생성) — 재고 변화 이력(append-only). 한 줄이 한 이벤트
  `{code,name,t,type,qty}`. type: initial/restock/soldout/qty. 통계 페이지가 이걸 읽는다

## 지점 데이터 생성·갱신

`markets.json`과 `docs/markets.md`는 아래 스크립트로 만든다. 전국 지점을 훑어 주소·본체
취급 여부를 확인하고, 주소를 OpenStreetMap Nominatim으로 지오코딩해 좌표를 채운다
(무료·키 불필요, 1req/s라 ~2.5분).

```bash
node apps/switch2/scripts/collect-markets.mjs
```

- 좌표는 기존 `markets.json`을 캐시로 재사용한다(재실행 시 지오코딩 생략). 새 지점만 조회
- 도로명주소는 "…로 56길"처럼 띄우면 Nominatim이 못 찾으므로 "…로56길"로 붙여 질의한다
- **본체 미취급(hasBody:false)** 지점(토이저러스·맥스 등)은 폴링에서 빠지고 지도엔 '미취급'

## 실행

```bash
pnpm --filter switch2 dry     # dry-run (전국 1회 조회, 미저장)
pnpm --filter switch2 check   # 전국 1회 조회
pnpm --filter switch2 start   # 폴링 데몬 (POLL_SECONDS마다 전국 조회)
```

폴링은 데몬(`start`)에서만 반복된다. byb.kr 서버에서 pm2/systemd로 상시 구동한다.

## 대시보드 (byb.kr)

빌드 없이 뜨는 정적 페이지 두 개다.

- `web/index.html` — 전국 재고 **지도**(CDN Leaflet). `markets.json`(좌표) +
  `state.json`(재고)을 fetch해 지점 위치에 재고 수를 찍고 30초마다 갱신. 지점 클릭 시
  네이버지도 길찾기 링크
- `web/stats.html` — 입고·품절 **패턴**(순수 JS). `events.jsonl` + `markets.json`으로
  주간 입고 히트맵·입고 지속시간·지점별 타임라인을 그린다

배포 시 웹루트(`web/`)에 `markets.json`·`state.json`·`events.jsonl`을 워처 파일로
**symlink** 연결한다(상세는 루트 README). 이력 패턴은 데이터가 며칠~몇 주 쌓여야 의미가 보인다.
