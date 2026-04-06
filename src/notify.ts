import type { Changes } from "./diff.js";

function formatDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function buildEmbed(caseLabel: string, changes: Changes) {
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

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
    title: `${caseLabel}`,
    color: 0x3498db,
    fields,
    timestamp: new Date().toISOString(),
  };
}

export async function sendDiscordNotification(
  webhookUrl: string,
  caseLabel: string,
  changes: Changes,
): Promise<void> {
  const embed = buildEmbed(caseLabel, changes);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "법원 알리미",
      embeds: [embed],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord webhook failed (${res.status}): ${body}`);
  }
}

export async function sendStartupNotification(
  webhookUrl: string,
  caseLabels: string[],
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "법원 알리미",
      embeds: [
        {
          title: "모니터링 시작",
          color: 0x2ecc71,
          description: caseLabels
            .map((label) => `- ${label}`)
            .join("\n"),
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord webhook failed (${res.status}): ${body}`);
  }
}

export async function sendErrorNotification(
  webhookUrl: string,
  caseLabel: string,
  error: string,
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "법원 알리미",
      embeds: [
        {
          title: `오류: ${caseLabel}`,
          color: 0xe74c3c,
          description: error,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error(`Discord error notification failed: ${res.status}`);
  }
}
