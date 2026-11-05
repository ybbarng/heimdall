import { readFile } from "node:fs/promises";
import { COLOR, createLogger, createStorage, sendDiscord } from "@heimdall/core";
import { parseKrProduct } from "./parse.js";
import type { AppState, ProductConfig, ProductState } from "./types.js";

/**
 * 닌텐도 스토어 재입고 워처. cron이 몇 분마다 `run.sh nintendo-store`로 1회씩 부른다.
 * 품절 → 구매 가능으로 바뀌면 Discord로 알리고, 다시 품절되면 짧게 알린다.
 *
 * 서버 IP를 다른 개인 앱과 함께 쓰므로, 실패가 이어지면 스스로 조회 간격을 늘린다.
 */

const storage = createStorage<AppState>(
  new URL("../data/state.json", import.meta.url),
  { products: {}, failures: 0 },
);
const log = createLogger(
  "nintendo-store",
  new URL("../../../logs/", import.meta.url),
);

/** 이 횟수만큼 연속 실패하면 한 번 알린다 */
const FAILURE_ALERT_THRESHOLD = 10;
/** 연속 실패 시 건너뛸 최대 시간 */
const MAX_BACKOFF_MINUTES = 60;

const USER_AGENT =
  "Mozilla/5.0 (compatible; heimdall-restock-watcher/1.0; personal use)";

async function loadProducts(): Promise<ProductConfig[]> {
  const raw = await readFile(new URL("../products.json", import.meta.url), "utf-8");
  return JSON.parse(raw) as ProductConfig[];
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // 대기열·점검 페이지로 넘어갔으면 재고 판단을 하지 않는다
  if (new URL(res.url).host !== new URL(url).host) {
    throw new Error(`다른 곳으로 넘어감: ${new URL(res.url).host}`);
  }
  return res.text();
}

function backoffMinutes(failures: number): number {
  // 3번째 실패부터 2, 4, 8 … 분, 최대 60분
  if (failures < 3) return 0;
  return Math.min(2 ** (failures - 2), MAX_BACKOFF_MINUTES);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const webhookUrl = process.env["DISCORD_WEBHOOK_URL"] ?? "";
  const mention = process.env["MENTION"] ?? "";
  if (!webhookUrl && !dryRun) {
    throw new Error("DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
  }
  const send = (msg: Parameters<typeof sendDiscord>[1]) =>
    sendDiscord(webhookUrl, { username: "heimdall · 닌텐도 스토어", ...msg }, { dryRun });

  const state = await storage.load();
  const now = new Date();

  if (state.nextAllowedAt && now < new Date(state.nextAllowedAt) && !dryRun) {
    log.info(`연속 실패 ${state.failures}회로 ${state.nextAllowedAt}까지 건너뜀`);
    return;
  }

  const products = await loadProducts();
  let failed = 0;
  let lastError = "";

  for (const p of products) {
    try {
      const result = parseKrProduct(await fetchHtml(p.url));
      const prev: ProductState | undefined = state.products[p.id];
      // 처음 기록할 때 이미 구매 가능이면 그것도 재입고로 본다 (놓치는 것보다 낫다)
      const changed =
        prev === undefined ? result.available : prev.available !== result.available;
      const price = result.price ? `₩${result.price.toLocaleString("ko-KR")}` : "";

      if (changed && result.available) {
        log.info(`[${p.label}] 재입고 감지 → 알림`);
        await send({
          content: `${mention ? `${mention} ` : ""}🎉 재입고: ${p.label}\n${p.url}`,
          embeds: [
            {
              title: `재입고 — ${result.title || p.label}`,
              description: `[상품 페이지 열기](${p.url})`,
              color: COLOR.success,
              fields: price ? [{ name: "가격", value: price, inline: true }] : [],
              timestamp: now.toISOString(),
            },
          ],
        });
      } else if (changed) {
        log.info(`[${p.label}] 다시 품절 → 알림`);
        await send({
          embeds: [
            {
              title: `다시 품절 — ${result.title || p.label}`,
              color: COLOR.info,
              timestamp: now.toISOString(),
            },
          ],
        });
      } else {
        log.info(
          `[${p.label}] ${result.available ? "구매 가능" : "품절"}${prev ? "" : " (처음 기록)"}`,
        );
      }

      state.products[p.id] = {
        available: result.available,
        lastChecked: now.toISOString(),
        lastChanged: changed ? now.toISOString() : prev?.lastChanged,
      };
    } catch (err) {
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
      log.warn(`[${p.label}] 조회 실패: ${lastError}`);
    }
  }

  if (failed > 0 && failed === products.length) {
    state.failures += 1;
    const wait = backoffMinutes(state.failures);
    state.nextAllowedAt = wait
      ? new Date(now.getTime() + wait * 60_000).toISOString()
      : undefined;
    if (state.failures >= FAILURE_ALERT_THRESHOLD && !state.failureNotified) {
      await send({
        embeds: [
          {
            title: `조회가 ${state.failures}번 연속 실패`,
            description: `${lastError}\n복구될 때까지 최대 ${MAX_BACKOFF_MINUTES}분 간격으로 다시 시도합니다.`,
            color: COLOR.error,
            timestamp: now.toISOString(),
          },
        ],
      });
      state.failureNotified = true;
    }
  } else {
    if (state.failureNotified) {
      await send({
        embeds: [{ title: "조회 복구됨", color: COLOR.info, timestamp: now.toISOString() }],
      });
    }
    state.failures = 0;
    state.nextAllowedAt = undefined;
    state.failureNotified = false;
  }

  if (dryRun) {
    log.info("[dry-run] 상태 저장 생략");
  } else {
    await storage.save(state);
  }
}

main().catch((err) => {
  log.error(`치명적 오류: ${String(err)}`);
  process.exit(1);
});
