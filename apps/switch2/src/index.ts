import { readFile } from "node:fs/promises";
import { createLogger, createStorage } from "@heimdall/core";
import { fetchStock } from "./api.js";
import { detectChanges } from "./diff.js";
import { recordEvent } from "./history.js";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadEnv(dryRun: boolean) {
  // 알림을 끄면(ALERTS_ENABLED=false) 전국 재고 수집·지도·통계만 돌고 Discord 전송은 안 한다
  const alertsEnabled = process.env["ALERTS_ENABLED"] !== "false";
  const webhookUrl = process.env["DISCORD_WEBHOOK_URL"];
  // 알림을 켠 상태에서만 웹훅이 필요하다 (dry-run·알림 off면 없어도 됨)
  if (!webhookUrl && !dryRun && alertsEnabled) {
    throw new Error("DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
  }

  // 계층 폴링: 알림 지점은 자주, 전국(지도용)은 드물게
  const notifySeconds = Number(process.env["POLL_NOTIFY_SECONDS"] ?? "60");
  const allSeconds = Number(process.env["POLL_ALL_SECONDS"] ?? "300");
  const failThreshold = Number(process.env["FAIL_ALERT_THRESHOLD"] ?? "5");
  const searchWord = process.env["SEARCH_WORD"] ?? "스위치2";
  const targetNames = (process.env["TARGET_PRODUCTS"] ?? "닌텐도 스위치 2")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    webhookUrl: webhookUrl ?? "",
    alertsEnabled,
    notifySeconds,
    allSeconds,
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
  alertsEnabled: boolean;
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

    const changes = detectChanges(prev?.products, products);
    for (const change of changes) {
      log.info(
        `[${market.name}] ${change.type}: ${change.name} ${change.to.inStock ? `${change.to.qty}개` : "품절"}`,
      );
      // 주간 패턴 시각화용으로 전 지점 변화를 이력에 남긴다
      recordEvent(market, change, dryRun);
      // 알림 대상 지점만 Discord로 보낸다(알림 on일 때). 나머지는 지도용 상태만 갱신
      if (market.notify && config.alertsEnabled) {
        await sendStockNotification(config.webhookUrl, market, change, dryRun);
      }
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

    // 알림 지점만(알림 on일 때), 연속 실패가 임계값에 닿을 때만 오류 알림
    if (market.notify && config.alertsEnabled && failCount === config.failThreshold) {
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

// 한 tier(지점 묶음)를 순차 조회한다. 공유 state 객체를 갱신하고 저장한다.
// 지점 간 짧은 간격으로 버스트를 피한다(어뷰징 방지).
async function pollTier(
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
  const env = loadEnv(dryRun);
  const config: Config = {
    webhookUrl: env.webhookUrl,
    alertsEnabled: env.alertsEnabled,
    failThreshold: env.failThreshold,
    searchWord: env.searchWord,
    targetNames: env.targetNames,
  };

  // 알림 지점은 미취급이어도 항상 폴링한다(입고 시작을 잡기 위해).
  // 비알림 전국은 본체 취급 지점만 폴링한다(미취급은 지도에만 '미취급'으로 표시).
  const allMarkets = await loadMarkets();
  const notifyMarkets = allMarkets.filter((m) => m.notify);
  const restMarkets = allMarkets.filter((m) => !m.notify && m.hasBody !== false);
  const bodyMarkets = [...notifyMarkets, ...restMarkets];

  const state = await storage.load();

  if (dryRun) {
    log.info("=== dry-run 모드: 실제 전송·상태 저장 없음 ===");
  }

  if (once || dryRun) {
    log.info(
      `전국 ${bodyMarkets.length}곳 1회 조회 (알림 대상 ${notifyMarkets.length}곳)`,
    );
    await pollTier("once", bodyMarkets, state, config, dryRun);
    return;
  }

  log.info(
    `계층 폴링 시작: 알림 ${notifyMarkets.length}곳 ${env.notifySeconds}초 / 전국 ${restMarkets.length}곳 ${env.allSeconds}초 · Discord 알림 ${env.alertsEnabled ? "ON" : "OFF(재고 수집만)"}`,
  );
  // 알림이 꺼져 있으면 시작 알림도 보내지 않는다
  if (env.alertsEnabled) {
    await sendStartupNotification(env.webhookUrl, notifyMarkets, dryRun);
  }

  // 즉시 전국 1회 (지도·상태 초기화)
  await pollTier("init", bodyMarkets, state, config, dryRun);

  // Tier A: 알림 지점 자주
  setInterval(() => {
    pollTier("notify", notifyMarkets, state, config, dryRun).catch((err) =>
      log.error(`알림 폴링 오류: ${String(err)}`),
    );
  }, env.notifySeconds * 1000);

  // Tier B: 전국 나머지(지도용) 드물게
  setInterval(() => {
    pollTier("all", restMarkets, state, config, dryRun).catch((err) =>
      log.error(`전국 폴링 오류: ${String(err)}`),
    );
  }, env.allSeconds * 1000);
}

main().catch((err) => {
  log.error(`치명적 오류: ${String(err)}`);
  process.exit(1);
});
