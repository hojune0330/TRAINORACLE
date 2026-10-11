#!/usr/bin/env node
/*
 * Phase-2 design assets (docs/phase2/ASSETS.md). Deterministic SVG, drawn in-house, colours read from
 * colors_and_type.css tokens (game world: --game-*, app chrome: --brand/--ink/--surface/--line).
 *
 *   node app/scripts/phase2-assets/build-assets.mjs          # write SVGs to app/public/phase2/
 *   node app/scripts/phase2-assets/build-assets.mjs --check  # exit 1 if any committed SVG is stale
 *
 * PNG/WebP exports and the contact sheet are rendered by render-assets.spec.ts (Playwright).
 * Character portraits are rendered from the live game rig (anime-runner.ts) by the same spec,
 * so portraits and in-game sprites can never drift apart.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const out = join(root, "app/public/phase2")
const css = readFileSync(join(root, "colors_and_type.css"), "utf8")
const token = name => {
  const match = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{3,8})`, "u").exec(css)
  if (!match) throw new Error(`missing token --${name}`)
  return match[1].toUpperCase()
}
const g = name => token(`game-${name}`)
const OUT = g("outline")

const svg = (size, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`
const star = (cx, cy, r, inner = 0.45, points = 5, rot = -90) => {
  const pts = []
  for (let i = 0; i < points * 2; i++) {
    const a = ((rot + (i * 180) / points) * Math.PI) / 180, rr = i % 2 ? r * inner : r
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`)
  }
  return pts.join(" ")
}
const hash = text => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)

/* ---------- Currency ---------- */
// P coin: app currency. App-chrome palette (brand teal), flat, no glow. 1P = 0.1원 (POINT_STANDARD).
function pCoin() {
  const brand = token("brand"), brandInk = token("brand-ink"), surface = token("surface")
  return svg(64, `
  <circle cx="32" cy="34" r="27" fill="${brandInk}"/>
  <circle cx="32" cy="31" r="27" fill="${brand}" stroke="${brandInk}" stroke-width="2.5"/>
  <circle cx="32" cy="31" r="20.5" fill="none" stroke="${surface}" stroke-opacity=".45" stroke-width="1.5"/>
  <path d="M25 44V18h9.5c5.6 0 9 3.1 9 8s-3.4 8-9 8H31v10z M31 23.2v5.6h3.2c1.9 0 3-1 3-2.8s-1.1-2.8-3-2.8z" fill="${surface}"/>
  <path d="M14 25a19 19 0 0 1 9-10" fill="none" stroke="${surface}" stroke-opacity=".7" stroke-width="2.5" stroke-linecap="round"/>`, "포인트 P")
}
// Medal: game currency. Game palette, ribbon + star, clearly not a coin (no value implied).
function medal() {
  return svg(64, `
  <path d="M20 4h10l6 18h-10z" fill="${g("danger")}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M44 4H34l-6 18h10z" fill="${g("shorts")}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="32" cy="40" r="19" fill="${g("gold-dark")}" stroke="${OUT}" stroke-width="2.8"/>
  <circle cx="32" cy="38.5" r="15" fill="${g("gold")}"/>
  <polygon points="${star(32, 39, 9.5)}" fill="${g("cloud")}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M19 33a14 14 0 0 1 6-8" fill="none" stroke="${g("cloud")}" stroke-width="2.4" stroke-linecap="round"/>`, "게임 메달")
}

/* ---------- Ledger reason icons (app chrome, line style) ---------- */
function ledger(kind) {
  const ink = token("ink-2"), brand = token("brand")
  const paths = {
    journal: `<rect x="5" y="3" width="14" height="18" fill="none" stroke="${ink}" stroke-width="1.6"/><path d="M8 8h8M8 12h8M8 16h5" stroke="${ink}" stroke-width="1.6"/><path d="M17 15l3 3-4 1z" fill="${brand}"/>`,
    visit: `<path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="${ink}" stroke-width="1.6"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="${brand}" stroke-width="1.8"/>`,
    streak: `<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1.5 1 2 2 2 3 1-2 1-4 1-7z" fill="none" stroke="${brand}" stroke-width="1.6" stroke-linejoin="round"/>`,
    decoration: `<path d="M4 8l8-4 8 4-8 4z" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 8v8l8 4 8-4V8M12 12v8" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`,
    migration: `<path d="M5 9h12l-3-3M19 15H7l3 3" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="square"/>`,
    offline: `<path d="M3 9a13 13 0 0 1 18 0M6 12.5a8.5 8.5 0 0 1 12 0M9 16a4 4 0 0 1 6 0" fill="none" stroke="${ink}" stroke-width="1.6"/><path d="M4 4l16 16" stroke="${ink}" stroke-width="1.6"/>`,
  }
  return svg(24, paths[kind], { journal: "일지 기록", visit: "방문", streak: "연속 기록", decoration: "꾸미기", migration: "포인트 전환", offline: "오프라인" }[kind])
}

/* ---------- Trail effect icons (game world, 96px shop thumbnails) ---------- */
function trail(id) {
  const shoe = `<path d="M50 70c0-8 4-14 10-14h8c4 0 6 3 10 5 5 3 10 4 10 10v3H50z" fill="${g("cloud")}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/><path d="M50 72h38v6H50z" fill="${g("shorts")}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>`
  const fx = {
    stardust: [[30, 52, 7], [16, 66, 5], [36, 74, 4], [12, 44, 3.5]].map(([x, y, r]) => `<polygon points="${star(x, y, r, 0.42)}" fill="${g("gold")}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>`).join(""),
    petals: [[30, 54, 20], [14, 68, -30], [36, 76, 60], [18, 44, -70]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="4" transform="rotate(${a} ${x} ${y})" fill="${g("petal")}" stroke="${OUT}" stroke-width="1.6"/>`).join(""),
    spark: `<path d="M38 40l-12 18h9l-6 18 16-22h-9l6-14z" fill="${g("neon-blue")}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/><path d="M8 58h12M4 66h14M10 74h10" stroke="${g("neon-blue")}" stroke-width="3" stroke-linecap="round"/>`,
    flame: `<path d="M40 78c-12 0-18-7-18-15 0-9 8-12 9-22 5 4 7 8 7 12 3-3 4-7 3-11 7 5 11 12 11 20 0 9-5 16-12 16z" fill="${g("heat")}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/><path d="M40 76c-5 0-8-3-8-7 0-5 4-6 5-10 3 3 4 5 4 8 2-1 3-3 3-5 3 3 4 6 4 9 0 3-3 5-8 5z" fill="${g("danger")}"/>`,
    rainbow: ["danger", "heat", "gold", "good", "neon-blue", "hana-shirt"].map((c, i) => `<path d="M4 ${50 + i * 4.5}H46" stroke="${g(c)}" stroke-width="4.5"/>`).join("") + `<path d="M4 47.5H46V77.5H4" fill="none" stroke="${OUT}" stroke-width="2"/>`,
  }
  const names = { stardust: "별가루", petals: "꽃잎 바람", spark: "번개 스텝", flame: "불꽃 신발", rainbow: "무지개 꼬리" }
  return svg(96, `<rect x="2" y="2" width="92" height="92" rx="20" fill="${g("sky-low")}" stroke="${OUT}" stroke-width="3"/>${fx[id]}${shoe}`, names[id])
}

/* ---------- City stamps (game world, 128px, rubber-stamp look) ---------- */
const CITY = {
  seoul: { name: "SEOUL", ko: "서울", color: "shirt", glyph: "tower" },
  daejeon: { name: "DAEJEON", ko: "대전", color: "shorts", glyph: "hanbit" },
  daegu: { name: "DAEGU", ko: "대구", color: "heat", glyph: "tower83" },
  busan: { name: "BUSAN", ko: "부산", color: "sea", glyph: "bridge" },
  tokyo: { name: "TOKYO", ko: "도쿄", color: "danger", glyph: "tokyo" },
  osaka: { name: "OSAKA", ko: "오사카", color: "good", glyph: "castle" },
  paris: { name: "PARIS", ko: "파리", color: "spike-hill-far", glyph: "eiffel" },
  london: { name: "LONDON", ko: "런던", color: "city-near", glyph: "bigben" },
}
function glyph(kind, color) {
  const s = `fill="none" stroke="${color}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`
  return {
    tower: `<path d="M64 30v8M58 46h12l-2-8h-8zM61 46l-3 38M67 46l3 38M52 84h24" ${s}/>`,
    hanbit: `<path d="M64 32l-8 52h16z" ${s}/><circle cx="64" cy="50" r="7" ${s}/><ellipse cx="64" cy="50" rx="13" ry="4" transform="rotate(-20 64 50)" ${s}/>`,
    tower83: `<path d="M64 30v10M58 52h12l-2-12h-8zM62 52v32M66 52v32M50 84h28" ${s}/>`,
    bridge: `<path d="M34 76h60M48 76V44M80 76V44M34 70q14-4 14-26q16 30 32 0q0 22 14 26" ${s}/>`,
    tokyo: `<path d="M50 84l14-54 14 54M54 68h20M57 56h14M60 44h8" ${s}/>`,
    castle: `<path d="M46 84h36M50 84V70h28v14M44 70h40l-6-8H50zM54 62V52h20v10M50 52h28l-5-7H55zM60 45v-7h8v7" ${s}/>`,
    eiffel: `<path d="M48 84q10-22 14-54h4q4 32 14 54M54 70h20M58 56h12" ${s}/>`,
    bigben: `<path d="M56 84V40h16v44M56 40l8-12 8 12M44 84h40" ${s}/><circle cx="64" cy="52" r="5" ${s}/>`,
  }[kind]
}
function stamp(id) {
  const city = CITY[id], color = g(city.color)
  const rot = (hash(id) % 11) - 5
  // Text on a circle via textPath; Pretendard falls back to system sans in exported PNGs.
  return svg(128, `
  <g transform="rotate(${rot} 64 64)">
    <circle cx="64" cy="64" r="58" fill="${g("cloud")}" stroke="${color}" stroke-width="4"/>
    <circle cx="64" cy="64" r="50" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="3 4"/>
    <defs><path id="arc-${id}" d="M24 64a40 40 0 0 1 80 0"/></defs>
    <text font-family="Pretendard Variable, Pretendard, sans-serif" font-size="13" font-weight="800" letter-spacing="3" fill="${color}"><textPath href="#arc-${id}" startOffset="50%" text-anchor="middle">${city.name}</textPath></text>
    ${glyph(city.glyph, color)}
    <text x="64" y="100" text-anchor="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-size="13" font-weight="900" fill="${color}">${city.ko}</text>
  </g>`, `${city.ko} 스탬프`)
}
const stampEmpty = () => svg(128, `<circle cx="64" cy="64" r="56" fill="none" stroke="${g("rail")}" stroke-width="3" stroke-dasharray="6 6"/><path d="M64 48v32M48 64h32" stroke="${g("rail")}" stroke-width="3" stroke-linecap="round"/>`, "빈 스탬프 칸")

/* ---------- Season emblems (game world, 192px) ---------- */
function season(id) {
  const korea = id === "korea"
  const a = korea ? g("shirt") : g("spike-hill-far"), b = korea ? g("sky-top") : g("spike-sky-low")
  const label = korea ? "SEASON 1" : "SEASON 2", sub = korea ? "KOREA TOUR" : "WORLD TOUR"
  const shoe = `<path d="M66 116c0-12 6-20 15-20h12c6 0 9 4 15 7 7 4 15 6 15 15v4H66z" fill="${g("cloud")}" stroke="${OUT}" stroke-width="4" stroke-linejoin="round"/><path d="M66 119h57v8H66z" fill="${g("belt-lane")}" stroke="${OUT}" stroke-width="4" stroke-linejoin="round"/><path d="M84 103l6 6M92 101l6 6" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`
  const deco = korea
    ? `<circle cx="96" cy="70" r="14" fill="${g("danger")}" stroke="${OUT}" stroke-width="3"/><path d="M82 70a14 14 0 0 0 28 0" fill="${g("shorts")}" stroke="${OUT}" stroke-width="3"/>`
    : `<circle cx="96" cy="70" r="15" fill="${g("sea")}" stroke="${OUT}" stroke-width="3"/><path d="M81 70h30M96 55c-7 8-7 22 0 30M96 55c7 8 7 22 0 30" fill="none" stroke="${OUT}" stroke-width="2.4"/>`
  return svg(192, `
  <path d="M96 8l70 26v52c0 46-32 76-70 96-38-20-70-50-70-96V34z" fill="${a}" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M96 22l56 21v43c0 37-25 61-56 78-31-17-56-41-56-78V43z" fill="${b}"/>
  ${deco}${shoe}
  <path d="M22 132h148l-10 18 10 18H22l10-18z" fill="${g("gold")}" stroke="${OUT}" stroke-width="4" stroke-linejoin="round"/>
  <text x="96" y="148" text-anchor="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-size="15" font-weight="900" fill="${OUT}">${label}</text>
  <text x="96" y="163" text-anchor="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-size="10" font-weight="800" letter-spacing="2" fill="${OUT}">${sub}</text>`, korea ? "시즌 1 코리아 투어 엠블럼" : "시즌 2 월드 투어 엠블럼")
}

/* ---------- Ad badge (app chrome; required "광고" label next to rewarded/interstitial entry points) ---------- */
function adBadge() {
  const ink = token("ink-2"), line = token("line-2"), surface = token("surface")
  return svg(32, `<rect x="1" y="7" width="30" height="18" fill="${surface}" stroke="${line}" stroke-width="1"/><text x="16" y="20.5" text-anchor="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-size="11" font-weight="700" fill="${ink}">광고</text>`, "광고")
}

/* ---------- Empty-state illustration (app chrome line art, 160px) ---------- */
function emptyWallet() {
  const ink = token("ink-3"), brand = token("brand"), line = token("line-2")
  return svg(160, `<rect x="30" y="54" width="100" height="64" fill="none" stroke="${ink}" stroke-width="2"/><path d="M30 70h100" stroke="${line}" stroke-width="2"/><rect x="98" y="80" width="32" height="22" fill="none" stroke="${ink}" stroke-width="2"/><circle cx="110" cy="91" r="3" fill="${ink}"/><circle cx="62" cy="40" r="14" fill="none" stroke="${brand}" stroke-width="2.4"/><path d="M58 46V34h5c2.6 0 4.2 1.5 4.2 3.8S65.6 41.6 63 41.6h-5" fill="none" stroke="${brand}" stroke-width="2.4"/><path d="M84 30l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="none" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"/>`, "빈 포인트 지갑")
}

export const ASSETS = {
  "currency/p-coin.svg": pCoin,
  "currency/medal.svg": medal,
  ...Object.fromEntries(["journal", "visit", "streak", "decoration", "migration", "offline"].map(k => [`icons/ledger-${k}.svg`, () => ledger(k)])),
  ...Object.fromEntries(["stardust", "petals", "spark", "flame", "rainbow"].map(k => [`trails/trail-${k}.svg`, () => trail(k)])),
  ...Object.fromEntries(Object.keys(CITY).map(k => [`stamps/stamp-${k}.svg`, () => stamp(k)])),
  "stamps/stamp-empty.svg": stampEmpty,
  "seasons/season-korea.svg": () => season("korea"),
  "seasons/season-world.svg": () => season("world"),
  "icons/ad-badge.svg": adBadge,
  "illustrations/empty-wallet.svg": emptyWallet,
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check")
  const stale = []
  for (const [path, make] of Object.entries(ASSETS)) {
    const file = join(out, path), content = make()
    if (check) { if (!existsSync(file) || readFileSync(file, "utf8").replace(/\r\n/gu, "\n") !== content) stale.push(path) }
    else { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content) }
  }
  if (!check) writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "manifest.json"), `${JSON.stringify(Object.keys(ASSETS), null, 2)}\n`)
  if (check && stale.length) { console.error(`stale assets:\n${stale.join("\n")}\nRun: node app/scripts/phase2-assets/build-assets.mjs`); process.exit(1) }
  console.log(`${check ? "checked" : "wrote"} ${Object.keys(ASSETS).length} SVG assets in app/public/phase2/`)
}
