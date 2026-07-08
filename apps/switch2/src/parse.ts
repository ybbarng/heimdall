import type { Stock } from "./types.js";

export interface Product {
  name: string;
  stock: Stock;
}

/** 상품명을 비교용으로 정규화한다 (공백 제거, 소문자). "닌텐도 스위치 2" == "닌텐도스위치2" */
export function normalize(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

/** 태그를 벗기고 앞뒤 공백을 정리한다 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 재고 표시 문자열을 파싱한다.
 * "10 개" → { inStock: true, qty: 10 }, "품절" → { inStock: false, qty: null }
 */
function parseStock(raw: string): Stock {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length > 0) {
    return { inStock: true, qty: Number(digits) };
  }
  return { inStock: false, qty: null };
}

/**
 * search_product_list.asp가 돌려준 부분 HTML(<li> 목록)을 파싱한다.
 * 외부 파서 없이 정규식으로 상품명과 재고를 추출한다.
 */
export function parseProducts(html: string): Product[] {
  const products: Product[] = [];

  // 각 상품은 하나의 <li> ... </li> 블록
  const liMatches = html.matchAll(/<li>([\s\S]*?)<\/li>/g);
  for (const [, block] of liMatches) {
    const nameMatch = block.match(
      /<div class="prod-name">([\s\S]*?)<\/div>/,
    );
    if (!nameMatch) continue;
    const name = stripTags(nameMatch[1]);

    // 상세 테이블의 "ㆍ재고 :" 행에서 재고 값을 뽑는다
    const stockMatch = block.match(
      /재고\s*:\s*<\/th>\s*<td>([\s\S]*?)<\/td>/,
    );
    if (!stockMatch) continue;
    const stock = parseStock(stripTags(stockMatch[1]));

    products.push({ name, stock });
  }

  return products;
}
