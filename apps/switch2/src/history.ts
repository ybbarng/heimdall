import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Change } from "./diff.js";
import type { Market } from "./types.js";

/** 재고 변화 이벤트 한 건. events.jsonl 한 줄 */
export interface StockEvent {
  code: string;
  name: string;
  /** ISO 타임스탬프 */
  t: string;
  /** initial=최초 관측(입고 시점 불명), restock=품절→재고, soldout=재고→품절, qty=수량 변경 */
  type: "initial" | "restock" | "soldout" | "qty";
  /** 변경 후 재고 수량 (soldout이면 생략) */
  qty?: number;
}

const eventsPath = fileURLToPath(new URL("../data/events.jsonl", import.meta.url));
let ensured = false;

/**
 * 재고 변화를 events.jsonl에 append-only로 기록한다(주간 패턴 시각화용).
 * 최초 관측(from=null)의 재입고는 실제 입고 시점이 아니므로 initial로 구분한다.
 * dry-run에서는 기록하지 않는다.
 */
export function recordEvent(
  market: Market,
  change: Change,
  dryRun: boolean,
): void {
  if (dryRun) return;
  if (!ensured) {
    mkdirSync(dirname(eventsPath), { recursive: true });
    ensured = true;
  }

  const type =
    change.type === "restock" && change.from === null ? "initial" : change.type;
  const event: StockEvent = {
    code: market.code,
    name: market.name,
    t: new Date().toISOString(),
    type,
    ...(change.to.inStock ? { qty: change.to.qty ?? undefined } : {}),
  };
  appendFileSync(eventsPath, `${JSON.stringify(event)}\n`);
}
