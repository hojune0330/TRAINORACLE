import { chromium } from "../../../../../app/node_modules/@playwright/test/index.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await fs.readFile(path.join(here, "personas.synthetic.json"), "utf8"));
const baseUrl = "http://127.0.0.1:4209/?app=1";
const tracePath = path.join(here, "actions.jsonl");
const networkPath = path.join(here, "network-policy.json");
await fs.writeFile(tracePath, "", "utf8");
const network = [];
const pageErrors = [];
const blockedTerms = /계정|로그인|동기화|공유|게시|설정|결제|연결|삭제|지우기|초기화|탈퇴|휴지통|내보내기|가져오기|불러오기|업로드/i;
const genericTabs = /^(홈|일지|기록하기|계획|분석|더보기)$/;

function rng(seed) {
  let value = seed >>> 0;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
}

async function visibleState(page) {
  return page.evaluate(() => ({
    text: (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 5000),
    url: location.href,
    scrollY: Math.round(scrollY),
    maxScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    dialogs: document.querySelectorAll('[role="dialog"],dialog[open]').length,
    buttons: [...document.querySelectorAll('button,[role="button"],a[href],summary')]
      .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden")
      .map(e => ({ name: (e.getAttribute("aria-label") || e.innerText || e.getAttribute("title") || "").replace(/\s+/g, " ").trim(), expanded: e.getAttribute("aria-expanded"), pressed: e.getAttribute("aria-pressed"), disabled: e.disabled || e.getAttribute("aria-disabled") === "true" }))
      .slice(0, 80)
  }));
}

async function candidates(page, profile, seen, failedPairs, step, random) {
  const raw = await page.evaluate(() => {
    const visible = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none";
    const allClicks = [...document.querySelectorAll('button,[role="button"],a[href],summary')];
    const clicks = allClicks.filter(visible).map(e => ({ kind: "click", index: allClicks.indexOf(e), name: (e.getAttribute("aria-label") || e.innerText || e.getAttribute("title") || "").replace(/\s+/g, " ").trim(), tag: e.tagName, href: e.getAttribute("href"), disabled: e.disabled || e.getAttribute("aria-disabled") === "true", expanded: e.getAttribute("aria-expanded"), pressed: e.getAttribute("aria-pressed"), cls: String(e.className || "") }));
    const allFields = [...document.querySelectorAll('textarea,[contenteditable="true"],input[type="search"]')];
    const fields = allFields.filter(visible).map(e => ({ kind: "fill", index: allFields.indexOf(e), name: `${e.getAttribute("aria-label") || e.getAttribute("placeholder") || e.getAttribute("name") || e.id || e.tagName}`.trim(), tag: e.tagName, value: e.value || e.innerText || "" }));
    return { clicks, fields, scrollY, maxScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight) };
  });
  const out = [];
  for (const c of raw.clicks) {
    if (!c.name || c.disabled || blockedTerms.test(c.name) || (c.href && !c.href.startsWith("/") && !c.href.startsWith("#"))) continue;
    if (genericTabs.test(c.name) && (c.pressed === "true" || /active|selected|current/i.test(c.cls))) continue;
    const pair = `${c.name}::${(await visibleState(page)).text.slice(0, 80)}`;
    if (failedPairs.has(pair)) continue;
    let score = 4 - (seen.get(c.name) || 0) * 4;
    if (genericTabs.test(c.name)) score -= 2;
    for (const term of profile.interests) if (c.name.toLowerCase().includes(term.toLowerCase())) score += 7;
    if (c.expanded === "false") score += 2;
    if (c.expanded === "true") score -= 1;
    score += random() * 1.25;
    out.push({ ...c, score, reason: profile.interests.some(term => c.name.toLowerCase().includes(term.toLowerCase())) ? `화면에 보인 '${c.name}'가 현재 관심사와 맞아 눌러 봄` : "새로 보인 조작 요소라 어디로 이어지는지 확인" });
  }
  for (const f of raw.fields) {
    if (f.value || blockedTerms.test(f.name)) continue;
    let score = 2 - (seen.get(`fill:${f.name}`) || 0) * 5;
    const words = /기록|일지|메모|느낌|훈련|내용|본문|search/i;
    if (words.test(f.name)) score += 9;
    for (const term of profile.interests) if (f.name.toLowerCase().includes(term.toLowerCase())) score += 4;
    out.push({ ...f, score: score + random(), reason: `비어 있는 '${f.name}' 입력칸이 보여 합성 문장으로 경험을 살펴봄` });
  }
  if (raw.scrollY < raw.maxScroll - 80) {
    out.push({ kind: "scroll", name: "아래 내용 더 보기", score: 1.5 + (profile.interests.some(x => /일지|예시|설명|날짜|기록/.test(x)) ? 2 : 0), reason: "첫 화면 아래에 이어지는 항목이 보여 더 읽어 봄" });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

for (const profile of fixture.profiles) {
  const random = rng(Number(profile.id.slice(1)) * 9173);
  const context = await (await chromium.launch({ headless: true })).newContext({
    viewport: profile.viewport,
    serviceWorkers: "block",
    locale: "ko-KR",
    reducedMotion: "reduce"
  });
  const browser = context.browser();
  const page = await context.newPage();
  const seen = new Map();
  const failedPairs = new Set();
  page.on("pageerror", error => pageErrors.push({ persona: profile.id, error: String(error) }));
  await context.route("**/*", async route => {
    const request = route.request();
    const u = new URL(request.url());
    const allowed = u.origin === "http://127.0.0.1:4209" && ["GET", "HEAD"].includes(request.method());
    network.push({ persona: profile.id, method: request.method(), origin: u.origin, path: u.pathname, decision: allowed ? "allow-local-read" : "block" });
    if (allowed) await route.continue(); else await route.abort("blockedbyclient");
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(here, `${profile.id}-start.png`), fullPage: true });
  let meaningful = 0;
  let attempts = 0;
  while (meaningful < profile.targetActions && attempts < profile.targetActions * 3) {
    attempts += 1;
    const before = await visibleState(page);
    const options = await candidates(page, profile, seen, failedPairs, meaningful, random);
    const choice = options[0];
    if (!choice) {
      const fallback = await page.getByRole("button").allTextContents();
      const next = fallback.map(x => x.trim()).find(x => x && !blockedTerms.test(x) && !seen.has(x));
      if (!next) break;
      const locator = page.getByRole("button", { name: next, exact: true }).first();
      await locator.click({ timeout: 2500 }).catch(() => {});
      seen.set(next, (seen.get(next) || 0) + 1);
      meaningful += 1;
      const after = await visibleState(page);
      await fs.appendFile(tracePath, JSON.stringify({ persona: profile.id, actionNo: meaningful, type: "click", target: next, reason: "현재 화면에서 아직 눌러 보지 않은 항목을 선택", before: before.text, after: after.text, urlBefore: before.url, urlAfter: after.url }) + "\n");
      continue;
    }
    const key = choice.kind === "fill" ? `fill:${choice.name}` : choice.name;
    if (choice.kind === "click") {
      const pair = `${choice.name}::${before.text.slice(0, 80)}`;
      try {
        await page.locator('button,[role="button"],a[href],summary').nth(choice.index).click({ timeout: 2500 });
        seen.set(key, (seen.get(key) || 0) + 1);
      } catch {
        failedPairs.add(pair);
        continue;
      }
    } else if (choice.kind === "fill") {
      const value = /search/i.test(choice.name) ? "훈련" : profile.entryText;
      try {
        await page.locator('textarea,[contenteditable="true"],input[type="search"]').nth(choice.index).fill(value, { timeout: 2500 });
        seen.set(key, (seen.get(key) || 0) + 1);
      } catch {
        continue;
      }
    } else {
      await page.evaluate(() => window.scrollBy({ top: Math.max(240, Math.floor(innerHeight * 0.72)), behavior: "instant" }));
    }
    await page.waitForTimeout(180);
    const after = await visibleState(page);
    const moved = Math.abs(after.scrollY - before.scrollY) > 80;
    const changed = after.text !== before.text || after.url !== before.url || after.dialogs !== before.dialogs || moved || choice.kind === "fill";
    if (!changed) failedPairs.add(`${choice.name}::${before.text.slice(0, 80)}`);
    else meaningful += 1;
    await fs.appendFile(tracePath, JSON.stringify({ persona: profile.id, actionNo: meaningful, type: choice.kind, target: choice.name, reason: choice.reason, meaningful: changed, before: before.text, after: after.text, urlBefore: before.url, urlAfter: after.url, scrollBefore: before.scrollY, scrollAfter: after.scrollY }) + "\n");
    if (meaningful > 0 && meaningful % 4 === 0) await page.screenshot({ path: path.join(here, `${profile.id}-step-${String(meaningful).padStart(2, "0")}.png`), fullPage: true });
  }
  const finalState = await visibleState(page);
  const keys = await page.evaluate(() => ({ localStorageKeys: Object.keys(localStorage), sessionStorageKeys: Object.keys(sessionStorage) }));
  await page.screenshot({ path: path.join(here, `${profile.id}-end.png`), fullPage: true });
  await fs.appendFile(tracePath, JSON.stringify({ persona: profile.id, type: "stop", reason: meaningful >= profile.targetActions ? "관심을 따라 둘러볼 만큼 살펴봐 여기서 멈춤" : "더 진행할 수 있는 안전한 화면 조작을 찾지 못해 멈춤", meaningfulActions: meaningful, finalScreen: finalState.text, localKeys: keys.localStorageKeys, sessionKeys: keys.sessionStorageKeys }) + "\n");
  await context.close();
  await browser?.close();
}

await fs.writeFile(networkPath, JSON.stringify({ policy: "Only same-origin GET/HEAD on 127.0.0.1:4209 allowed; all other requests blocked", requests: network, pageErrors }, null, 2), "utf8");
console.log(JSON.stringify({ personas: fixture.profiles.map(p => p.id), tracePath, networkPath, requestCounts: Object.groupBy(network, x => x.decision), pageErrors }, null, 2));
