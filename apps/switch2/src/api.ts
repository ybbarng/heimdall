import { type Product, normalize, parseProducts } from "./parse.js";
import type { Market } from "./types.js";

const BASE = "https://company.lottemart.com/mobiledowa/inc/asp/search_product_list.asp";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  Referer: "https://company.lottemart.com/mobiledowa/product/search_product.asp",
};

/**
 * 한 지점에서 검색어에 해당하는 상품 목록과 재고를 조회한다.
 * targetNames가 주어지면 이름이 정확히 일치하는 상품만 남긴다(주변기기 제외).
 */
export async function fetchStock(
  market: Market,
  searchWord: string,
  targetNames: string[],
): Promise<Product[]> {
  const url = `${BASE}?p_market=${encodeURIComponent(market.code)}&p_schWord=${encodeURIComponent(searchWord)}&page=1`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const html = await res.text();
  const products = parseProducts(html);

  const targets = new Set(targetNames.map(normalize));
  return products.filter((p) => targets.has(normalize(p.name)));
}
