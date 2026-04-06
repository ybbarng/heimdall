import { readFile } from "node:fs/promises";
import { fetchGeneral, fetchProgress } from "./api.js";
import { detectChanges } from "./diff.js";
import {
  sendDiscordNotification,
  sendErrorNotification,
  sendStartupNotification,
} from "./notify.js";
import { loadState, saveState } from "./storage.js";
import type { CaseConfig, CaseState } from "./types.js";

function loadEnv() {
  const webhookUrl = process.env["DISCORD_WEBHOOK_URL"];
  if (!webhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL 환경변수가 설정되지 않았습니다.");
  }

  const pollMinutes = Number(process.env["POLL_INTERVAL_MINUTES"] ?? "60");

  return { webhookUrl, pollMinutes };
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
): Promise<CaseState> {
  const [general, progress] = await Promise.all([
    fetchGeneral(caseConfig),
    fetchProgress(caseConfig),
  ]);

  const changes = detectChanges(prevState, general, progress);

  if (changes) {
    console.log(`[${caseConfig.label}] 변경 감지됨, 알림 발송`);
    await sendDiscordNotification(webhookUrl, caseConfig.label, changes);
  } else if (prevState?.general) {
    console.log(`[${caseConfig.label}] 변경 없음`);
  } else {
    console.log(`[${caseConfig.label}] 초기 상태 저장`);
  }

  return {
    general,
    progress,
    lastChecked: new Date().toISOString(),
  };
}

async function poll(cases: CaseConfig[], webhookUrl: string) {
  const state = await loadState();

  for (const caseConfig of cases) {
    try {
      state[caseConfig.id] = await checkCase(
        caseConfig,
        state[caseConfig.id],
        webhookUrl,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${caseConfig.label}] 오류: ${message}`);
      await sendErrorNotification(webhookUrl, caseConfig.label, message);
    }
  }

  await saveState(state);
}

async function main() {
  const { webhookUrl, pollMinutes } = loadEnv();
  const cases = await loadCases();
  const once = process.argv.includes("--once");

  if (once) {
    console.log(`${cases.length}건 1회 조회`);
    await poll(cases, webhookUrl);
    return;
  }

  console.log(
    `${cases.length}건 모니터링 시작 (${pollMinutes}분 간격)`,
  );
  await sendStartupNotification(
    webhookUrl,
    cases.map((c) => c.label),
  );

  // 즉시 1회 실행
  await poll(cases, webhookUrl);

  // 주기적 실행
  setInterval(
    () => {
      poll(cases, webhookUrl).catch((err) =>
        console.error("폴링 오류:", err),
      );
    },
    pollMinutes * 60 * 1000,
  );
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
