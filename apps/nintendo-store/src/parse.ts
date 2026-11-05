import type { StockResult } from "./types.js";

/**
 * 한국 닌텐도 스토어(Magento 2) 상품 상세 HTML에서 재고 상태를 읽는다.
 *
 * 판별 근거 (2026-11-05 실제 페이지로 확인):
 * - 구매 가능: `<div class="stock available">`, provider 데이터 `"is_salable":"1"`
 * - 품절:      `<div class="stock unavailable">품절`, `"is_salable":""`
 *
 * 두 신호가 서로 다르거나 둘 다 없으면 페이지 구조가 바뀐 것이므로 예외를 던진다.
 * (잘못 읽고 "재입고" 알림을 보내는 것보다 실패로 알리는 편이 낫다)
 */
export function parseKrProduct(html: string): StockResult {
  const stockClass = html.match(/class="stock (available|unavailable)"/)?.[1];
  const salable = html.match(/"is_salable":"(1?)"/)?.[1];

  if (stockClass === undefined && salable === undefined) {
    throw new Error("재고 표시를 찾지 못함 (페이지 구조 변경 의심)");
  }

  const byClass = stockClass === undefined ? undefined : stockClass === "available";
  const bySalable = salable === undefined ? undefined : salable === "1";

  if (byClass !== undefined && bySalable !== undefined && byClass !== bySalable) {
    throw new Error(
      `재고 신호가 서로 다름 (stock=${stockClass}, is_salable="${salable}")`,
    );
  }

  const title =
    html.match(/itemprop="name">([^<]+)</)?.[1]?.trim() ??
    html.match(/<title>([^<]+)/)?.[1]?.trim() ??
    "";
  const priceRaw = html.match(/itemprop="price" content="(\d+)"/)?.[1];

  return {
    available: (byClass ?? bySalable) as boolean,
    title,
    price: priceRaw ? Number(priceRaw) : null,
  };
}
