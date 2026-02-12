import fs from "node:fs";
import path from "node:path";

const OUT_PATH = path.join(process.cwd(), "app", "data", "countryCenters.ts");

// REST Countries (v3.1) — 필요한 필드만 요청
const ENDPOINT =
  "https://restcountries.com/v3.1/all?fields=name,translations,latlng,capitalInfo,cca3";

function pickLatLng(c) {
  // 1) 수도 좌표가 있으면 그걸 우선 (마커가 더 자연스럽습니다)
  const cap = c?.capitalInfo?.latlng;
  if (Array.isArray(cap) && cap.length === 2) return cap;

  // 2) 없으면 나라 중심 좌표(latlng)
  const ll = c?.latlng;
  if (Array.isArray(ll) && ll.length === 2) return ll;

  return null;
}

function pickKoreanName(c) {
  // 한국어 번역(일반명) 우선
  const kor = c?.translations?.kor?.common;
  if (typeof kor === "string" && kor.trim()) return kor.trim();

  // 없으면 영어 common
  const en = c?.name?.common;
  if (typeof en === "string" && en.trim()) return en.trim();

  // 마지막 fallback: cca3
  const code = c?.cca3;
  return typeof code === "string" ? code : "UNKNOWN";
}

async function main() {
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const countries = await res.json();

  const out = {};
  const duplicates = new Map();

  for (const c of countries) {
    const key = pickKoreanName(c);
    const ll = pickLatLng(c);
    if (!ll) continue;

    const [lat, lng] = ll.map((v) => Number(v));

    if (out[key]) {
      duplicates.set(key, (duplicates.get(key) || 1) + 1);
      continue; // 이미 있으면 첫 값을 유지
    }

    out[key] = { lat, lng };
  }

  const content =
`// ✅ 자동 생성 파일입니다. (scripts/generate-country-centers.mjs)
// 필요하면 여기서 수동으로 일부 국가명을 alias 처리해도 됩니다.

export const countryCenters: Record<string, { lat: number; lng: number }> = ${JSON.stringify(out, null, 2)} as const;
`;

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, content, "utf-8");

  console.log(`✅ Generated: ${OUT_PATH}`);
  console.log(`Countries: ${Object.keys(out).length}`);
  if (duplicates.size) {
    console.log("⚠️ Duplicate korean names:", Object.fromEntries(duplicates));
    console.log("→ 필요하면 alias로 분리/조정하세요.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
