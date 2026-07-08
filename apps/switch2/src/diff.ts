import type { Product } from "./parse.js";
import type { Stock } from "./types.js";

export type ChangeType = "restock" | "soldout" | "qty";

export interface Change {
  name: string;
  type: ChangeType;
  /** 이전 재고. 최초 조회면 null */
  from: Stock | null;
  to: Stock;
}

/**
 * 한 지점의 이전 재고와 현재 재고를 비교해 알릴 변화를 뽑는다.
 * 상태가 유지되는 동안(재고 그대로·품절 그대로)에는 아무것도 돌려주지 않아
 * 폴링마다 반복 알림이 나가지 않는다.
 *
 * - 최초 조회 + 재고 있음 → restock (재고 있으면 알림)
 * - 품절 → 재고        → restock
 * - 재고 → 품절        → soldout
 * - 재고 유지 & 수량 변경 → qty
 */
export function detectChanges(
  prev: Record<string, Stock> | undefined,
  current: Product[],
): Change[] {
  const changes: Change[] = [];

  for (const { name, stock } of current) {
    const before = prev?.[name] ?? null;

    if (before === null) {
      // 최초 조회: 이미 재고가 있으면 알린다
      if (stock.inStock) {
        changes.push({ name, type: "restock", from: null, to: stock });
      }
      continue;
    }

    if (!before.inStock && stock.inStock) {
      changes.push({ name, type: "restock", from: before, to: stock });
    } else if (before.inStock && !stock.inStock) {
      changes.push({ name, type: "soldout", from: before, to: stock });
    } else if (before.inStock && stock.inStock && before.qty !== stock.qty) {
      changes.push({ name, type: "qty", from: before, to: stock });
    }
  }

  return changes;
}
