import { chromium, expect } from "../../../app/node_modules/@playwright/test/index.mjs";
import { completeQuickPlan, refinePlan } from "../../../app/e2e/plan-flow.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const baseURL = process.env.CALENDAR_REVIEW_URL ?? "http://127.0.0.1:4194";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname));
const out = fileURLToPath(new URL("./color-implementation/", import.meta.url));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const observations = [];
const session = (id, date, system, slot, extra = {}) => ({
  id, kind: "post-session", date, savedAt: `${date}T01:00:00Z`, syncState: "local", system,
  title: "", memo: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, activitySlot: slot,
  fieldProvenance: { system: { provenance: "EXPLICIT" } }, ...extra,
});
const entries = [
  session("basic", "2026-09-27", "base", "AM"), session("recovery", "2026-09-27", "rest", "PM"),
  session("plyo", "2026-09-28", "", "PM", { fieldProvenance: {}, exerciseLog: { version: 1, source: "SELF_REPORTED",
    components: [{ id: "jump", kind: "PLYOMETRIC", name: "", rows: [{ id: "r", contacts: 12 }] }] } }),
  session("legacy", "2026-09-29", "base", "AM", { fieldProvenance: {} }),
  session("mixed", "2026-09-26", "base", "PM", { exerciseLog: { version: 1, source: "SELF_REPORTED", components: [
    { id: "run", kind: "RUNNING", name: "", rows: [] }, { id: "jump", kind: "PLYOMETRIC", name: "", rows: [] },
  ] } }),
  { id: "race", kind: "race", date: "2026-09-30", savedAt: "2026-09-30T01:00:00Z", syncState: "local",
    stage: "pre", record: "", rank: "", result: "", memo: "" },
];
async function randomBrowse(calendar, page, seed) {
  const actions = [];
  const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  for (let i = 0; i < 20; i++) {
    const action = next() % 4;
    if (action < 3) {
      const label = ["이전 달", "다음 달", "오늘"][action];
      await calendar.getByRole("button", { name: label, exact: true }).click();
      actions.push(label);
    } else {
      const dates = calendar.locator("button[data-date]");
      const target = dates.nth(next() % await dates.count());
      actions.push(await target.getAttribute("data-date"));
      await target.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "달력으로 돌아가기", exact: true }).click();
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await calendar.getByRole("button", { name: "오늘", exact: true }).click();
  return actions;
}
try {
  for (const width of [375, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 740 }, serviceWorkers: "block" });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
      if (/react-scan|react-grab/.test(url.pathname)) return route.fulfill({ contentType: "application/javascript", body: "export function scan() {}" });
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 8, 30, 12));
    await page.goto(`${baseURL}/?app=1&uitest=1`);
    await page.evaluate(data => localStorage.setItem("trainoracle.journal.v1", JSON.stringify(data)), entries);
    await page.reload();
    await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click();
    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();
    await expect(grid.locator('[data-date="2026-09-27"] [data-tone="base"]')).toBeVisible();
    await expect(grid.locator('[data-date="2026-09-27"] [data-tone="recovery"]')).toBeVisible();
    await expect(grid.locator('[data-date="2026-09-28"] [data-tone="neural"]')).toBeVisible();
    await expect(grid.locator('[data-date="2026-09-29"] [data-tone="unknown"]')).toBeVisible();
    await expect(grid.locator('[data-date="2026-09-30"] [data-tone="race"]')).toBeVisible();
    await expect(grid.locator('[data-date="2026-09-26"] .calendar-training-mark')).toHaveCount(1);
    await expect(grid.locator('[data-date="2026-09-26"] [data-tone="base"]')).toHaveText("오후기본플라이오 포함");
    const before = await page.evaluate(() => localStorage.getItem("trainoracle.journal.v1"));
    await page.locator(".month-calendar").screenshot({ path: `${out}journal-${width}.png` });
    await grid.locator('[data-date="2026-09-27"]').click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "달력으로 돌아가기" }).click();
    await expect(grid.locator('[data-date="2026-09-27"]')).toBeFocused();
    await page.getByRole("button", { name: "다음 달", exact: true }).click();
    await expect(grid).toHaveAttribute("aria-label", "2026년 10월 달력");
    await page.getByRole("button", { name: "이전 달", exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("trainoracle.journal.v1")), before);
    const journal = await grid.locator(".calendar-training-mark").evaluateAll(nodes => nodes.map(node => ({
      tone: node.getAttribute("data-tone"), text: node.textContent, background: getComputedStyle(node).backgroundColor,
    })));
    const journalActions = await randomBrowse(page.locator(".month-calendar"), page, 20260930 + width);
    assert.equal(await page.evaluate(() => localStorage.getItem("trainoracle.journal.v1")), before);
    await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click();
    await completeQuickPlan(page, { days: /^매일/u });
    await refinePlan(page, "하루 두 번", /하루 두 번 운동할게요/u);
    await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click();
    const plan = page.locator(".plan-training-flow .month-calendar");
    await expect(plan).toBeVisible();
    await expect(plan.locator('[data-tone="main"]').first()).toBeVisible();
    await expect(plan.locator('[data-tone="recovery"]').first()).toBeVisible();
    await expect(plan.locator('[data-date="2026-09-26"] .calendar-training-mark')).toHaveCount(1);
    await expect(plan.locator('[data-date="2026-09-26"] [data-tone="base"]')).toHaveText("일지 · 오후기본플라이오 포함");
    const mainDate = await plan.locator('button[data-date]:has([data-tone="main"])').first().getAttribute("data-date");
    await expect(plan.locator(`button[data-date="${mainDate}"] [data-tone="recovery"]`)).toBeVisible();
    const storedPlan = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"));
    await plan.screenshot({ path: `${out}plan-${width}.png` });
    await plan.getByRole("button", { name: "다음 달", exact: true }).click();
    await plan.screenshot({ path: `${out}plan-october-${width}.png` });
    await plan.getByRole("button", { name: "이전 달", exact: true }).click();
    const dimensions = await plan.locator("td button").evaluateAll(nodes => ({
      minWidth: Math.min(...nodes.map(n => n.getBoundingClientRect().width)),
      minHeight: Math.min(...nodes.map(n => n.getBoundingClientRect().height)),
      overflow: document.documentElement.scrollWidth > innerWidth,
      clippedLabels: [...document.querySelectorAll(".calendar-training-mark__label")].filter(n => n.scrollWidth > n.clientWidth + 1).length,
    }));
    assert.ok(dimensions.minWidth >= 44 && dimensions.minHeight >= 44);
    assert.equal(dimensions.overflow, false);
    assert.equal(dimensions.clippedLabels, 0);
    const planActions = await randomBrowse(plan, page, 307 + width);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await plan.getByRole("button", { name: "다음 달", exact: true }).click();
    const motion = await plan.locator("tbody").evaluate(n => getComputedStyle(n).animationName);
    assert.equal(motion, "none");
    await plan.getByRole("button", { name: "이전 달", exact: true }).click();
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll(".month-calendar *")].map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
      for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
    });
    await plan.screenshot({ path: `${out}plan-large-text-${width}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1")), storedPlan);
    assert.deepEqual(errors, []);
    observations.push({ width, journal, dimensions, mainAndRecoveryDate: mainDate, journalActions, planActions, reducedMotionAnimation: motion,
      doubledCalendarTextOverflow: false, recordAndPlanUnchangedByBrowsing: true, pageErrors: errors });
    await context.close();
  }
} finally { await browser.close(); }
writeFileSync(`${out}evidence.json`, JSON.stringify({ scope: "local synthetic browser; not production or real athlete data", observations }, null, 2));
console.log(JSON.stringify(observations, null, 2));
