// 전국 롯데마트 지점의 코드·이름·주소·스위치2 본체 취급 여부를 수집해
// docs/markets.md 참조 문서를 갱신한다. markets.json 확장·변경 시 참고용.
//
//   node apps/switch2/scripts/collect-markets.mjs
//
// 재고 수량은 수시로 바뀌므로 문서에는 "본체 취급 여부"(검색 결과에 본체가 뜨는지)만 남긴다.
import { mkdir, writeFile } from "node:fs/promises";

const AREAS = ["서울","경기","인천","강원","충북","충남","대전","경북","경남","대구","부산","울산","전북","전남","광주","기타"];
const SEARCH = "스위치2";
const BODY = "닌텐도스위치2"; // 공백 제거 정규화 후 정확 일치

const norm = (s) => s.replace(/\s+/g, "").toLowerCase();
const stripTags = (h) => h.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function getMarkets(area) {
  const url = `https://company.lottemart.com/mobiledowa/inc/asp/search_market_list.asp?p_area=${encodeURIComponent(area)}&p_type=1&p_werks=0`;
  const html = await (await fetch(url)).text();
  return [...html.matchAll(/<option value="(\d+)"[^>]*>([^<]+)<\/option>/g)]
    .map((m) => ({ code: m[1], name: m[2].trim() }));
}

async function getAddr(area, code) {
  const body = new URLSearchParams({ m_area: area, m_market: code });
  const html = await (await fetch("https://company.lottemart.com/mobiledowa/market/search_shop.asp", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })).text();
  const m = html.match(/주소\s*:\s*<\/span>\s*([^<]+)</);
  return m ? m[1].trim() : "";
}

// 검색 결과에 본체가 있으면 true
async function hasBody(code) {
  const url = `https://company.lottemart.com/mobiledowa/inc/asp/search_product_list.asp?p_market=${code}&p_schWord=${encodeURIComponent(SEARCH)}&page=1`;
  const html = await (await fetch(url)).text();
  for (const [, b] of html.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    const n = b.match(/<div class="prod-name">([\s\S]*?)<\/div>/);
    if (n && norm(stripTags(n[1])) === BODY) return true;
  }
  return false;
}

async function pool(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

// 주소에서 시/군/구 추출 (서울은 구, 그 외는 시/군)
function district(addr) {
  const m = addr.match(/^\S+\s+(\S+?[시군구])/);
  return m ? m[1] : "";
}

const byArea = {};
for (const area of AREAS) {
  const mks = await getMarkets(area);
  byArea[area] = await pool(mks, 8, async (mk) => {
    const [addr, body] = await Promise.all([getAddr(area, mk.code), hasBody(mk.code)]);
    return { ...mk, district: district(addr), addr, body };
  });
  console.error(`${area}: ${byArea[area].length}개`);
}

const today = new Date().toISOString().slice(0, 10);
const total = Object.values(byArea).reduce((n, r) => n + r.length, 0);

let md = `# 롯데마트 지점 참조 (스위치2 재고 워처)

수집일: ${today} · 전국 ${total}개 지점 · \`scripts/collect-markets.mjs\`로 재생성

\`markets.json\`을 바꿀 때 여기서 코드를 찾아 \`{ "code": "…", "name": "…" }\`를 넣거나 뺀다.
**본체** 열이 ✗인 지점(토이저러스·맥스 등 본체 미취급)은 넣어도 알림이 오지 않는다.
재고 수량은 수시로 바뀌므로 여기엔 취급 여부만 적는다. 최신 재고는 \`pnpm --filter switch2 dry\`로 확인.
`;

for (const area of AREAS) {
  const rows = byArea[area];
  if (!rows.length) continue;
  md += `\n## ${area} (${rows.length})\n\n| 코드 | 지점 | 지역 | 주소 | 본체 |\n|---|---|---|---|---|\n`;
  for (const r of rows.sort((a, b) => a.district.localeCompare(b.district, "ko"))) {
    md += `| ${r.code} | ${r.name} | ${r.district} | ${r.addr} | ${r.body ? "✓" : "✗"} |\n`;
  }
}

await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
await writeFile(new URL("../docs/markets.md", import.meta.url), md, "utf-8");
console.error(`\ndocs/markets.md 갱신 완료 (${total}개 지점)`);
