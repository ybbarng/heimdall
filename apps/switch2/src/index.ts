import { readFile } from "node:fs/promises";
import { createLogger, createStorage } from "@heimdall/core";
import { fetchStock } from "./api.js";
import { detectChanges } from "./diff.js";
import { recordEvent } from "./history.js";
import type { AppState, Market, MarketState } from "./types.js";

const storage = createStorage<AppState>(
  new URL("../data/state.json", import.meta.url),
  {},
);

// 로그는 모노레포 루트 logs/ 아래 날짜별 파일로 표준화된다
const log = createLogger("switch2", new URL("../../../logs/", import.meta.url));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  // 전국 재고를 폴링해 지도·통계용 state.json/events.jsonl만 갱신한다(알림 없음)
  const pollSeconds = Number(process.env["POLL_SECONDS"] ?? "300");
  const searchWord = process.env["SEARCH_WORD"] ?? "스위치2";
  const targetNames = (process.env["TARGET_PRODUCTS"] ?? "닌텐도 스위치 2")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return { pollSeconds, searchWord, targetNames };
}

async function loadMarkets(): Promise<Market[]> {
  const path = new URL("../markets.json", import.meta.url);
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as Market[];
}

interface Config {
  searchWord: string;
  targetNames: string[];
}

async function checkMarket(
  market: Market,
  prev: MarketState | undefined,
  config: Config,
  dryRun: boolean,
): Promise<MarketState> {
  try {
    const products = await fetchStock(
      market,
      config.searchWord,
      config.targetNames,
    );

    const changes = detectChanges(prev?.products, products);
    for (const change of changes) {
      log.info(
        `[${market.name}] ${change.type}: ${change.name} ${change.to.inStock ? `${change.to.qty}개` : "품절"}`,
      );
      // 주간 패턴 시각화용으로 전 지점 변화를 이력에 남긴다
      recordEvent(market, change, dryRun);
    }

    // 조회 성공: 재고 상태 갱신, 실패 카운트 리셋
    const nextProducts: Record<string, MarketState["products"][string]> = {};
    for (const p of products) nextProducts[p.name] = p.stock;

    return {
      products: nextProducts,
      failCount: 0,
      lastChecked: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failCount = (prev?.failCount ?? 0) + 1;
    log.error(`[${market.name}] 조회 실패(${failCount}회): ${message}`);

    // 이전 재고 상태는 유지하고 실패 카운트만 올린다
    return {
      products: prev?.products ?? {},
      failCount,
      lastChecked: prev?.lastChecked ?? new Date().toISOString(),
    };
  }
}

// 지점 묶음을 순차 조회한다. 공유 state 객체를 갱신하고 저장한다.
// 지점 간 짧은 간격으로 버스트를 피한다(어뷰징 방지).
async function pollMarkets(
  label: string,
  markets: Market[],
  state: AppState,
  config: Config,
  dryRun: boolean,
) {
  for (const market of markets) {
    state[market.code] = await checkMarket(
      market,
      state[market.code],
      config,
      dryRun,
    );
    await sleep(300);
  }

  if (dryRun) {
    log.info(`[${label}] dry-run 상태 저장 생략`);
  } else {
    await storage.save(state);
  }
  log.info(`[${label}] ${markets.length}곳 조회 완료`);
}

async function main() {
  const once = process.argv.includes("--once");
  const dryRun = process.argv.includes("--dry-run");
  const env = loadEnv();
  const config: Config = {
    searchWord: env.searchWord,
    targetNames: env.targetNames,
  };

  // 본체 취급 지점만 폴링한다(미취급은 지도에만 '미취급'으로 표시).
  const allMarkets = await loadMarkets();
  const bodyMarkets = allMarkets.filter((m) => m.hasBody !== false);

  const state = await storage.load();

  if (dryRun) {
    log.info("=== dry-run 모드: 상태 저장 없음 ===");
  }

  if (once || dryRun) {
    log.info(`전국 ${bodyMarkets.length}곳 1회 조회`);
    await pollMarkets("once", bodyMarkets, state, config, dryRun);
    return;
  }

  log.info(`폴링 시작: 전국 ${bodyMarkets.length}곳 ${env.pollSeconds}초 간격`);

  // 즉시 전국 1회 (지도·상태 초기화)
  await pollMarkets("init", bodyMarkets, state, config, dryRun);

  setInterval(() => {
    pollMarkets("poll", bodyMarkets, state, config, dryRun).catch((err) =>
      log.error(`폴링 오류: ${String(err)}`),
    );
  }, env.pollSeconds * 1000);
}

main().catch((err) => {
  log.error(`치명적 오류: ${String(err)}`);
  process.exit(1);
});
