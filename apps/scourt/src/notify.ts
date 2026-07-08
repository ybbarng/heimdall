import { COLOR, type DiscordEmbed, sendDiscord } from "@heimdall/core";
import type { Changes } from "./diff.js";

const USERNAME = "법원 알리미";

function formatDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function buildEmbed(caseLabel: string, changes: Changes): DiscordEmbed {
  const fields: NonNullable<DiscordEmbed["fields"]> = [];

  for (const item of changes.newProgressItems) {
    fields.push({
      name: `(신규) ${formatDate(item.progYmd)} 진행`,
      value: item.progCtt + (item.progRslt ? ` (${item.progRslt})` : ""),
    });
  }

  for (const doc of changes.newSubmissions) {
    fields.push({
      name: `(신규) ${formatDate(doc.ofdocRcptYmd)} 서류 제출`,
      value: `${doc.content1}${doc.content2}${doc.content3}`,
    });
  }

  for (const change of changes.generalChanges) {
    fields.push({
      name: `(변경) ${change.field}`,
      value: `${String(change.from)} → ${String(change.to)}`,
      inline: true,
    });
  }

  return {
    title: caseLabel,
    color: COLOR.info,
    fields,
    timestamp: new Date().toISOString(),
  };
}

export async function sendDiscordNotification(
  webhookUrl: string,
  caseLabel: string,
  changes: Changes,
  dryRun = false,
): Promise<void> {
  await sendDiscord(
    webhookUrl,
    {
      username: USERNAME,
      embeds: [buildEmbed(caseLabel, changes)],
    },
    { dryRun },
  );
}

export async function sendStartupNotification(
  webhookUrl: string,
  caseLabels: string[],
  dryRun = false,
): Promise<void> {
  await sendDiscord(
    webhookUrl,
    {
      username: USERNAME,
      embeds: [
        {
          title: "모니터링 시작",
          color: COLOR.success,
          description: caseLabels.map((label) => `- ${label}`).join("\n"),
          timestamp: new Date().toISOString(),
        },
      ],
    },
    { dryRun },
  );
}

export async function sendErrorNotification(
  webhookUrl: string,
  caseLabel: string,
  error: string,
  dryRun = false,
): Promise<void> {
  // 오류 알림 자체가 실패해도 폴링은 계속되어야 하므로 예외를 삼킨다
  try {
    await sendDiscord(
      webhookUrl,
      {
        username: USERNAME,
        embeds: [
          {
            title: `오류: ${caseLabel}`,
            color: COLOR.error,
            description: error,
            timestamp: new Date().toISOString(),
          },
        ],
      },
      { dryRun },
    );
  } catch (err) {
    console.error(`Discord error notification failed: ${String(err)}`);
  }
}
