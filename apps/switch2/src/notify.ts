import { COLOR, type DiscordEmbed, sendDiscord } from "@heimdall/core";
import type { Change } from "./diff.js";
import type { Market, Stock } from "./types.js";

const USERNAME = "스위치2 재고 알리미";

/** 네이버지도 링크. 지정된 mapUrl이 있으면 그걸, 없으면 지점명 검색 링크를 만든다 */
function mapLink(market: Market): string {
  if (market.mapUrl) return market.mapUrl;
  const query = encodeURIComponent(`롯데마트 ${market.name}`);
  return `https://map.naver.com/p/search/${query}`;
}

/** 재고 상태를 사람이 읽을 문구로 */
function stockText(stock: Stock): string {
  return stock.inStock ? `${stock.qty}개` : "품절";
}

const TITLE: Record<Change["type"], string> = {
  restock: "🎉 재입고",
  soldout: "품절",
  qty: "재고 변동",
};

const COLOR_BY_TYPE: Record<Change["type"], number> = {
  restock: COLOR.success,
  soldout: COLOR.error,
  qty: COLOR.info,
};

function buildEmbed(market: Market, change: Change): DiscordEmbed {
  const before = change.from ? stockText(change.from) : "-";
  const after = stockText(change.to);
  const value =
    change.type === "restock"
      ? `재고 ${after}`
      : `${before} → ${after}`;

  return {
    title: `${TITLE[change.type]} · ${market.name}`,
    color: COLOR_BY_TYPE[change.type],
    fields: [
      { name: change.name, value },
      { name: "위치", value: `[네이버지도로 보기](${mapLink(market)})` },
    ],
    timestamp: new Date().toISOString(),
  };
}

export async function sendStockNotification(
  webhookUrl: string,
  market: Market,
  change: Change,
  dryRun = false,
): Promise<void> {
  await sendDiscord(
    webhookUrl,
    { username: USERNAME, embeds: [buildEmbed(market, change)] },
    { dryRun },
  );
}

export async function sendStartupNotification(
  webhookUrl: string,
  markets: Market[],
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
          description: markets.map((m) => `- ${m.name}`).join("\n"),
          timestamp: new Date().toISOString(),
        },
      ],
    },
    { dryRun },
  );
}

export async function sendErrorNotification(
  webhookUrl: string,
  marketName: string,
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
            title: `오류: ${marketName}`,
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
