import assert from "node:assert/strict";
import { test } from "node:test";
import { parseKrProduct } from "./parse.js";

// 2026-11-05 실제 페이지에서 필요한 부분만 잘라 둔 것
const SOLD_OUT = `
<span class="base" data-ui-id="page-title-wrapper" itemprop="name">시간의 오카리나 젤다의 전설</span>
<div class="product-info-stock-sku">
  <div class="stock unavailable" title="Availability"><span>품절</span></div>
</div>
<meta itemprop="price" content="59800" />
{"items":{"18198":{"is_salable":"","name":"x"}}}
`;

const IN_STOCK = `
<span class="base" data-ui-id="page-title-wrapper" itemprop="name">젤다의 전설 시간의 오카리나</span>
<div class="stock available" title="Availability"><span>구매 가능</span></div>
<meta itemprop="price" content="88000" />
<button id="product-addtocart-button">장바구니</button>
{"items":{"1":{"is_salable":"1"}}}
`;

test("품절 페이지는 available=false", () => {
  const r = parseKrProduct(SOLD_OUT);
  assert.equal(r.available, false);
  assert.equal(r.title, "시간의 오카리나 젤다의 전설");
  assert.equal(r.price, 59800);
});

test("재고 있는 페이지는 available=true", () => {
  const r = parseKrProduct(IN_STOCK);
  assert.equal(r.available, true);
  assert.equal(r.price, 88000);
});

test("재고 표시가 없으면 예외 (대기열·점검 페이지 등)", () => {
  assert.throws(() => parseKrProduct("<html>점검 중</html>"), /재고 표시/);
});

test("두 신호가 어긋나면 예외", () => {
  const broken = IN_STOCK.replace('"is_salable":"1"', '"is_salable":""');
  assert.throws(() => parseKrProduct(broken), /서로 다름/);
});
