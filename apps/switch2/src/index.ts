import { readFile } from "node:fs/promises";
import { createLogger, createStorage } from "@heimdall/core";
import { fetchStock } from "./api.js";
import { detectChanges } from "./diff.js";
import {
  sendErrorNotification,
  sendStartupNotification,
  sendStockNotification,
} from "./notify.js";
import type { AppState, Market, MarketState } from "./types.js";

const storage = createStorage<AppState>(
  new URL("../data/state.json", import.meta.url),
  {},
);

// 로그는 모노레포 루트 logs/ 아래 날짜별 파일로 표준화된다
const log = createLogger("switch2", new URL("../../../logs/", import.meta.url));

function loadEnv(dryRun: boolean) {
  const webhookUrl = process.env["DISCORD_WEBHOOK_URL"];
  // dry-run에서는 실제 전송을 안 하므로 웹훅 URL이 없어도 된다
  if (!webhookUrl && !dryRun) {
    throw new Error("DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
  }

  const pollSeconds = Number(process.env["POLL_INTERVAL_SECONDS"] ?? "60");
  const failThreshold = Number(process.env["FAIL_ALERT_THRESHOLD"] ?? "5");
  const searchWord = process.env["SEARCH_WORD"] ?? "스위치2";
  // 감시 대상 상품명(정확 일치). 기본은 본체만. 콤마로 여러 개 지정 가능
  const targetNames = (process.env["TARGET_PRODUCTS"] ?? "닌텐도 스위치 2")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    webhookUrl: webhookUrl ?? "",
    pollSeconds,
    failThreshold,
    searchWord,
    targetNames,
  };
}

async function loadMarkets(): Promise<Market[]> {
  const path = new URL("../markets.json", import.meta.url);
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as Market[];
}

interface Config {
  webhookUrl: string;
  failThreshold: number;
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

    if (products.length === 0) {
      log.warn(`[${market.name}] 감시 대상 상품이 검색 결과에 없음`);
    }

    const changes = detectChanges(prev?.products, products);
    for (const change of changes) {
      log.info(
        `[${market.name}] ${change.type}: ${change.name} ${change.to.inStock ? `${change.to.qty}개` : "품절"}`,
      );
      await sendStockNotification(config.webhookUrl, market, change, dryRun);
    }
    if (changes.length === 0) {
      log.info(`[${market.name}] 변화 없음`);
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

    // 짧은 주기의 순간 오류로 시끄러워지지 않게, 연속 실패가 임계값에 닿을 때만 알린다
    if (failCount === config.failThreshold) {
      await sendErrorNotification(
        config.webhookUrl,
        market.name,
        `연속 ${failCount}회 조회 실패: ${message}`,
        dryRun,
      );
    }

    // 이전 재고 상태는 유지하고 실패 카운트만 올린다
    return {
      products: prev?.products ?? {},
      failCount,
      lastChecked: prev?.lastChecked ?? new Date().toISOString(),
    };
  }
}

async function poll(markets: Market[], config: Config, dryRun: boolean) {
  const state = await storage.load();

  for (const market of markets) {
    state[market.code] = await checkMarket(
      market,
      state[market.code],
      config,
      dryRun,
    );
  }

  // dry-run에서는 로컬 상태 파일을 건드리지 않는다
  if (dryRun) {
    log.info("[dry-run] 상태 저장 생략");
  } else {
    await storage.save(state);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  const dryRun = process.argv.includes("--dry-run");
  const env = loadEnv(dryRun);
  const markets = await loadMarkets();
  const config: Config = {
    webhookUrl: env.webhookUrl,
    failThreshold: env.failThreshold,
    searchWord: env.searchWord,
    targetNames: env.targetNames,
  };

  if (dryRun) {
    log.info("=== dry-run 모드: 실제 전송·상태 저장 없음 ===");
  }

  if (once || dryRun) {
    log.info(`${markets.length}개 지점 1회 조회`);
    await poll(markets, config, dryRun);
    return;
  }

  log.info(
    `${markets.length}개 지점 모니터링 시작 (${env.pollSeconds}초 간격)`,
  );
  await sendStartupNotification(env.webhookUrl, markets, dryRun);

  // 즉시 1회 실행
  await poll(markets, config, dryRun);

  // 주기적 실행
  setInterval(() => {
    poll(markets, config, dryRun).catch((err) =>
      log.error(`폴링 오류: ${String(err)}`),
    );
  }, env.pollSeconds * 1000);
}

main().catch((err) => {
  log.error(`치명적 오류: ${String(err)}`);
  process.exit(1);
});
