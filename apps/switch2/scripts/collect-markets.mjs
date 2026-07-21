// 전국 롯데마트 지점의 코드·이름·주소·좌표·스위치2 본체 취급 여부를 수집해
// markets.json(워처·지도용)과 docs/markets.md(참조 문서)를 갱신한다.
//
//   node apps/switch2/scripts/collect-markets.mjs
//
// - markets.json: 전국 지점 { code, name, address, lat, lng, hasBody }
//   · 좌표는 도로명주소를 OpenStreetMap Nominatim으로 지오코딩(무료·키 불필요, 1req/s)
// - docs/markets.md: 사람이 읽는 참조표(본체 취급 여부)
// 재고 수량은 수시로 바뀌므로 여기엔 안 담는다. 최신 재고는 워처 state.json에서.
import { mkdir, readFile, writeFile } from "node:fs/promises";

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

// 주소를 지오코딩용으로 정리해 "시도 시군구 … 도로명 건물번호"까지만 남긴다.
// 도로명(…로/길) 뒤 마지막 건물번호까지 끊어 건물명·동·층 등 꼬리를 버린다.
function cleanAddr(addr) {
  const base = addr.replace(/[(,].*$/, "").trim(); // 괄호·쉼표 이후 제거
  // 마지막 "로|길" + 건물번호(예: "광나루로 56길 85")까지 greedy 매칭
  const road = base.match(/^(.*[로길]\s*\d+(?:-\d+)?)/);
  let out = (road ? road[1] : base.replace(/번지.*$/, "")).replace(/\s+/g, " ").trim();
  // 한국 도로명을 "…로 56길"처럼 띄우면 Nominatim이 못 찾는다 → "…로56길"로 붙인다
  out = out.replace(/([가-힣]+로)\s+(\d+번?길)/g, "$1$2");
  return out;
}

const GEO_UA = "heimdall-switch2-map/1.0 (personal project)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Nominatim 지오코딩. 도로명주소 실패 시 시/군/구 단위로 폴백. 실패하면 null
async function geocode(addr, districtName) {
  const tries = [cleanAddr(addr), districtName].filter(Boolean);
  for (const q of tries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { "User-Agent": GEO_UA } });
      const data = await res.json();
      await sleep(1100); // Nominatim 정책: 1req/s 이하
      if (data[0]) {
        return { lat: Number(data[0].lat), lng: Number(data[0].lon), approx: q === districtName };
      }
    } catch {
      await sleep(1100);
    }
  }
  return null;
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

// 재실행 시 Nominatim 부담을 줄이려 기존 markets.json의 좌표를 캐시로 재사용한다
async function loadCoordCache() {
  try {
    const raw = await readFile(new URL("../markets.json", import.meta.url), "utf-8");
    const cache = {};
    for (const m of JSON.parse(raw)) {
      if (typeof m.lat === "number") cache[m.code] = { lat: m.lat, lng: m.lng };
    }
    return cache;
  } catch {
    return {};
  }
}

// 1) 전국 지점 + 주소 + 본체 취급 여부 수집 (병렬)
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
const allRows = Object.values(byArea).flat();

// 2) 좌표 지오코딩 (순차, 1req/s). 캐시에 있으면 건너뛴다
const cache = await loadCoordCache();
let geocoded = 0;
let approxCount = 0;
let failCount = 0;
for (const r of allRows) {
  if (cache[r.code]) {
    r.lat = cache[r.code].lat;
    r.lng = cache[r.code].lng;
    continue;
  }
  const g = await geocode(r.addr, `${r.district}`);
  if (g) {
    r.lat = g.lat;
    r.lng = g.lng;
    geocoded++;
    if (g.approx) {
      approxCount++;
      console.error(`  ~ 근사좌표(구/군): ${r.name} (${r.code}) ${r.addr}`);
    }
  } else {
    failCount++;
    console.error(`  ✗ 좌표 실패: ${r.name} (${r.code}) ${r.addr}`);
  }
}
console.error(`지오코딩: 신규 ${geocoded} · 근사 ${approxCount} · 실패 ${failCount} · 캐시 ${allRows.length - geocoded - failCount}`);

// 3) markets.json 생성 (전국 + 좌표 + hasBody). 좌표 있는 지점만
const markets = allRows
  .filter((r) => typeof r.lat === "number")
  .map((r) => ({
    code: r.code,
    name: r.name,
    address: r.addr,
    lat: Number(r.lat.toFixed(6)),
    lng: Number(r.lng.toFixed(6)),
    hasBody: r.body,
  }));
await writeFile(
  new URL("../markets.json", import.meta.url),
  `${JSON.stringify(markets, null, 2)}\n`,
  "utf-8",
);
console.error(
  `markets.json: ${markets.length}개 (본체취급 ${markets.filter((m) => m.hasBody).length})`,
);

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
