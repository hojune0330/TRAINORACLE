import { chromium, expect } from "../../../app/node_modules/@playwright/test/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const origin = process.env.CALENDAR_REVIEW_URL ?? "http://127.0.0.1:4194";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const out = fileURLToPath(new URL("./context-implementation/", import.meta.url));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const observations = [];
const entries = ["2026-07-10", "2026-07-20", "2026-08-09", "2026-10-01"].map(date => ({
  id: `synthetic-${date}`, date, savedAt: "2026-09-30T00:00:00Z", kind: "post-session", syncState: "local",
  title: "Synthetic context record", system: "base", memo: "", rpe: 0, distanceKm: "5", durationMin: "30", avgPace: "",
  fieldProvenance: { system: { provenance: "EXPLICIT" }, distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" } },
}));
async function setup(width) {
  const context = await browser.newContext({ viewport: { width, height: 740 }, serviceWorkers: "block" });
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    if (/react-scan|react-grab/.test(url.pathname)) return route.fulfill({ contentType: "application/javascript", body: "export function scan() {}" });
    return route.continue();
  });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.setFixedTime(new Date(2026, 8, 30, 12));
  await page.goto(`${origin}/?app=1&uitest=1`);
  return { context, page, errors };
}
const tab = (page, name) => page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name, exact: true });
try {
  for (const width of [375, 320]) {
    const { context, page, errors } = await setup(width);
    await page.evaluate(value => localStorage.setItem("trainoracle.journal.v1", JSON.stringify(value)), entries);
    await page.reload();
    await tab(page, "일지").click();
    await expect(page.getByRole("grid")).toHaveAttribute("aria-label", "2026년 8월 달력");
    await expect(page.locator('[data-date="2026-08-09"]')).toHaveAttribute("data-selected", "true");
    const before = await page.evaluate(() => localStorage.getItem("trainoracle.journal.v1"));
    await page.getByRole("button", { name: "이전 달", exact: true }).click();
    await page.locator('[data-date="2026-07-20"]').click();
    await page.getByRole("button", { name: "다음 기록", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("2026년 8월 9일 일요일");
    await page.getByRole("button", { name: "달력으로 돌아가기" }).click();
    await expect(page.locator('[data-date="2026-08-09"]')).toBeFocused();
    await page.locator('[data-date="2026-08-09"]').click();
    await page.getByRole("button", { name: "일지·메모 원문 열기" }).click();
    await expect(page.getByText("Synthetic context record")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("grid")).toHaveAttribute("aria-label", "2026년 8월 달력");
    await page.getByRole("button", { name: "이전 달", exact: true }).click();
    await tab(page, "홈").click();
    await tab(page, "일지").click();
    await expect(page.getByRole("grid")).toHaveAttribute("aria-label", "2026년 7월 달력");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const savedScroll = await page.locator(".app-scroll-region").evaluate(el => { el.scrollTop = 250; return el.scrollTop; });
    assert.ok(savedScroll > 0);
    await expect.poll(() => page.locator(".app-scroll-region").evaluate(el => el.scrollTop)).toBe(savedScroll);
    await page.evaluate(() => document.querySelector(".app-scroll-region").dispatchEvent(new Event("scroll")));
    await tab(page, "홈").click();
    await tab(page, "일지").click();
    await expect.poll(() => page.locator(".app-scroll-region").evaluate(el => el.scrollTop)).toBe(savedScroll);
    await page.getByRole("button", { name: "9.5일 주기", exact: true }).click();
    await page.getByRole("button", { name: "다음 주기", exact: true }).click();
    await page.getByRole("button", { name: "최근 일지가 있는 주기" }).click();
    await expect(page.locator('[data-date="2026-08-09"]')).toHaveAttribute("data-selected", "true");
    await page.getByRole("button", { name: "월간 달력", exact: true }).click();
    await page.getByRole("button", { name: /최근 일지/ }).click();
    await page.locator(".month-calendar").screenshot({ path: `${out}recent-${width}.png` });
    await page.getByText("달력 색상", { exact: true }).click();
    await page.getByRole("checkbox", { name: "달력 움직임 줄이기" }).check();
    await page.getByRole("button", { name: "다음 달", exact: true }).click();
    assert.equal(await page.locator(".month-calendar tbody").evaluate(el => getComputedStyle(el).animationName), "none");
    let seed = width + 20260930;
    const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
    const actions = [];
    for (let i = 0; i < 24; i++) {
      const move = next() % 4;
      if (move < 3) {
        const name = ["이전 달", "다음 달", "오늘"][move];
        await page.getByRole("button", { name, exact: true }).click(); actions.push(name);
      } else {
        const dates = page.locator(".month-calendar button[data-date]");
        const chosen = dates.nth(next() % await dates.count());
        const date = await chosen.getAttribute("data-date");
        await chosen.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        assert.equal(await page.locator(".calendar-reader-transition").evaluate(el => getComputedStyle(el).animationName), "none");
        await page.getByRole("button", { name: "크게 보기 다음 날짜" }).click();
        await page.getByRole("button", { name: "달력으로 돌아가기" }).click(); actions.push(date);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.equal(await page.evaluate(() => localStorage.getItem("trainoracle.journal.v1")), before);
    assert.deepEqual(errors, []);
    observations.push({ width, latestDate: "2026-08-09", originalBrowserBack: true, tabContext: true, savedScroll, scrollRestored: true, cycleRecent: true,
      applicationReducedMotion: true, actions, journalUnchanged: true, pageErrors: errors });
    await context.close();

    const empty = await setup(width), p = empty.page;
    await tab(p, "일지").click();
    await expect(p.getByRole("grid")).toHaveCount(0);
    await p.locator(".calendar-empty-example").screenshot({ path: `${out}empty-${width}.png` });
    const storageBefore = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
    await p.getByRole("button", { name: "예시 둘러보기" }).click();
    await expect(p.getByRole("grid")).toHaveCount(1);
    await p.locator('[data-date="2026-09-29"]').click();
    await expect(p.getByRole("dialog")).toContainText("예시 · 내 기록에 저장되지 않아요");
    await p.getByRole("button", { name: "달력으로 돌아가기" }).click();
    await p.getByRole("button", { name: "내 달력", exact: true }).click();
    await expect(p.getByRole("grid")).toHaveCount(1);
    await expect(p.getByLabel("일지 달력 예시")).toHaveCount(0);
    assert.equal(await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage)))), storageBefore);
    assert.deepEqual(empty.errors, []);
    observations.push({ width, emptyExampleIsolated: true, allStorageUnchangedByExample: true, pageErrors: empty.errors });
    await empty.context.close();
  }
} finally { await browser.close(); }
writeFileSync(`${out}evidence.json`, JSON.stringify({ scope: "local synthetic browser, not production", observations }, null, 2));
console.log(JSON.stringify(observations, null, 2));
