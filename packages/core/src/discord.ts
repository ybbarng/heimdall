export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;
}

export interface DiscordMessage {
  username?: string;
  content?: string;
  embeds?: DiscordEmbed[];
}

/** 알림 종류별 임베드 색상 */
export const COLOR = {
  info: 0x3498db,
  success: 0x2ecc71,
  error: 0xe74c3c,
} as const;

export interface SendOptions {
  /** true면 실제 전송 대신 payload를 console에 출력한다 (로컬 테스트용) */
  dryRun?: boolean;
}

/** Discord 웹훅으로 메시지를 전송한다. 실패 시 예외를 던진다. */
export async function sendDiscord(
  webhookUrl: string,
  message: DiscordMessage,
  opts: SendOptions = {},
): Promise<void> {
  if (opts.dryRun) {
    console.log("[dry-run] Discord 전송 생략:");
    console.log(JSON.stringify(message, null, 2));
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord webhook failed (${res.status}): ${body}`);
  }
}
