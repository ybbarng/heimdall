# nintendo-store

한국 닌텐도 스토어(store.nintendo.co.kr) 상품의 재입고를 Discord로 알리는 워처.

## 동작

- cron이 3분마다 `run.sh nintendo-store`로 1회 조회한다(데몬 아님).
- `products.json`의 상품 상세 페이지를 받아 `src/parse.ts`가 재고를 읽는다.
  - 구매 가능: `class="stock available"` + `"is_salable":"1"`
  - 품절: `class="stock unavailable"` + `"is_salable":""`
  - 둘이 어긋나거나 둘 다 없으면 실패로 본다(구조 변경·점검·대기열 페이지에서 잘못 "재입고" 알림을 보내지 않으려고).
- 품절 → 구매 가능이면 `MENTION`을 붙여 알리고, 다시 품절되면 짧게 알린다. 처음 기록할 때 이미 구매 가능이어도 알린다.
- 모든 상품이 실패하면 연속 실패를 세고, 3번째부터 2·4·8…분(최대 60분) 동안 조회를 건너뛴다. 10번 연속 실패하면 한 번 알리고, 복구되면 알린다. 서버 IP를 다른 개인 앱과 함께 쓰므로 막히지 않게 하려는 것이다.
- 상태: `data/state.json`, 로그: 루트 `logs/nintendo-store-YYYY-MM-DD.log`

## 상품 더하기

`products.json`에 `{ id, label, url }`을 더한다. 한국 스토어(Magento 2) 상세 페이지면 그대로 동작한다.

## 일본 스토어(store-jp.nintendo.com)

지금은 다루지 않는다. 앞단에 Queue-it 대기실(Akamai)이 있어 JavaScript를 실행하지 않는 요청은 대기실 페이지를 받는다(2026-11-05 확인). 대기실을 우회하는 것은 하지 않는다.
대기실이 꺼진 뒤 평범한 요청으로 상세 페이지가 받아지는지 서버에서 다시 보고, 받아지면 일본용 parse를 더한다.

## 실행

```bash
pnpm --filter nintendo-store test   # 판별 로직 시험
pnpm --filter nintendo-store dry    # 실제 조회, 미전송·미저장
pnpm --filter nintendo-store check  # 실제 조회 + 알림 + 저장 (run.sh가 호출)
```
