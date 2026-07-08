import { readFile } from "node:fs/promises";
import { createLogger, createStorage } from "@heimdall/core";
import { fetchGeneral, fetchProgress } from "./api.js";
import { detectChanges } from "./diff.js";
import {
  sendDiscordNotification,
  sendErrorNotification,
  sendStartupNotification,
} from "./notify.js";
import type { AppState, CaseConfig, CaseState } from "./types.js";

const storage = createStorage<AppState>(
  new URL("../data/state.json", import.meta.url),
  {},
);

// 로그는 모노레포 루트 logs/ 아래 날짜별 파일로 표준화된다
const log = createLogger("scourt", new URL("../../../logs/", import.meta.url));

function loadEnv(dryRun: boolean) {
  const webhookUrl = process.env["DISCORD_WEBHOOK_URL"];
  // dry-run에서는 실제 전송을 안 하므로 웹훅 URL이 없어도 된다
  if (!webhookUrl && !dryRun) {
    throw new Error("DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
  }

  const pollMinutes = Number(process.env["POLL_INTERVAL_MINUTES"] ?? "60");

  return { webhookUrl: webhookUrl ?? "", pollMinutes };
}

async function loadCases(): Promise<CaseConfig[]> {
  const casesPath = new URL("../cases.json", import.meta.url);
  const raw = await readFile(casesPath, "utf-8");
  return JSON.parse(raw) as CaseConfig[];
}

async function checkCase(
  caseConfig: CaseConfig,
  prevState: CaseState | undefined,
  webhookUrl: string,
  dryRun: boolean,
): Promise<CaseState> {
  const [general, progress] = await Promise.all([
    fetchGeneral(caseConfig),
    fetchProgress(caseConfig),
  ]);

  const changes = detectChanges(prevState, general, progress);

  if (changes) {
    log.info(`[${caseConfig.label}] 변경 감지됨, 알림 발송`);
    await sendDiscordNotification(webhookUrl, caseConfig.label, changes, dryRun);
  } else if (prevState?.general) {
    log.info(`[${caseConfig.label}] 변경 없음`);
  } else {
    log.info(`[${caseConfig.label}] 초기 상태 저장`);
  }

  return {
    general,
    progress,
    lastChecked: new Date().toISOString(),
  };
}

async function poll(cases: CaseConfig[], webhookUrl: string, dryRun: boolean) {
  const state = await storage.load();

  for (const caseConfig of cases) {
    try {
      state[caseConfig.id] = await checkCase(
        caseConfig,
        state[caseConfig.id],
        webhookUrl,
        dryRun,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`[${caseConfig.label}] 오류: ${message}`);
      await sendErrorNotification(webhookUrl, caseConfig.label, message, dryRun);
    }
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
  const { webhookUrl, pollMinutes } = loadEnv(dryRun);
  const cases = await loadCases();

  if (dryRun) {
    log.info("=== dry-run 모드: 실제 전송·상태 저장 없음 ===");
  }

  if (once || dryRun) {
    log.info(`${cases.length}건 1회 조회`);
    await poll(cases, webhookUrl, dryRun);
    return;
  }

  log.info(`${cases.length}건 모니터링 시작 (${pollMinutes}분 간격)`);
  await sendStartupNotification(
    webhookUrl,
    cases.map((c) => c.label),
    dryRun,
  );

  // 즉시 1회 실행
  await poll(cases, webhookUrl, dryRun);

  // 주기적 실행
  setInterval(
    () => {
      poll(cases, webhookUrl, dryRun).catch((err) =>
        log.error(`폴링 오류: ${String(err)}`),
      );
    },
    pollMinutes * 60 * 1000,
  );
}

main().catch((err) => {
  log.error(`치명적 오류: ${String(err)}`);
  process.exit(1);
});
