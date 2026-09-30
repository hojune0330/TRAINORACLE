// Bounded, read-only random navigation against the existing local application.
import { chromium, expect } from "../../../app/node_modules/@playwright/test/index.mjs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const runs = [];
try {
  for (const config of [{ width: 375, motion: "no-preference", seed: 9029 }, { width: 320, motion: "reduce", seed: 1701 }]) {
    const context = await browser.newContext({ viewport: { width: config.width, height: 667 }, reducedMotion: config.motion, serviceWorkers: "block" });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (!["localhost", "127.0.0.1"].includes(url.hostname)) return route.abort();
      if (/react-scan|react-grab/.test(url.pathname)) return route.fulfill({ contentType: "application/javascript", body: "export function scan() {}" });
      return route.continue();
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(2026, 8, 29, 12));
    await page.goto("http://127.0.0.1:4194/?app=1&uitest=1");
    await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click();
    await expect(page.getByRole("grid")).toBeVisible();
    const initialStorage = await page.evaluate(() => ({ journal: localStorage.getItem("trainoracle.journal.v1"), plan: localStorage.getItem("trainoracle.plan-beta.v1") }));
    let random = config.seed;
    const next = max => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % max; };
    const steps = [];
    for (let i = 0; i < 40; i++) {
      const choice = next(7);
      const grid = page.getByRole("grid");
      await expect(grid).toBeVisible();
      if (choice < 3) {
        const name = ["이전 달", "다음 달", "오늘"][choice];
        await page.getByRole("button", { name, exact: true }).click();
        steps.push({ action: name, month: await grid.getAttribute("aria-label") });
      } else if (choice === 3) {
        const buttons = grid.locator("button[data-date]");
        const count = await buttons.count();
        expect(count).toBeGreaterThanOrEqual(28);
        const button = buttons.nth(next(count));
        const date = await button.getAttribute("data-date");
        await button.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(grid.locator(`button[data-date='${date}']`)).toBeFocused();
        steps.push({ action: "open-escape", date });
      } else if (choice === 4) {
        const button = grid.locator("button[data-date]").nth(7);
        await button.focus();
        const direction = next(2) ? "ArrowLeft" : "ArrowRight";
        await page.keyboard.press(direction);
        await expect(grid.locator("button[data-date]:focus")).toHaveCount(1);
        steps.push({ action: "keyboard", direction });
      } else if (choice === 5) {
        const name = next(2) ? "이전 달" : "다음 달";
        await page.getByRole("button", { name, exact: true }).dblclick();
        steps.push({ action: "double-month", name, month: await grid.getAttribute("aria-label") });
      } else {
        await grid.locator("button[data-date]").nth(10).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.getByRole("dialog").getByRole("button", { name: "크게 보기 다음 날짜" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "달력으로 돌아가기" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        steps.push({ action: "reader-next-return", month: await grid.getAttribute("aria-label") });
      }
      await expect(grid).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      expect(await page.evaluate(() => ({ journal: localStorage.getItem("trainoracle.journal.v1"), plan: localStorage.getItem("trainoracle.plan-beta.v1") }))).toEqual(initialStorage);
    }
    runs.push({ ...config, steps });
    await context.close();
  }
} finally { await browser.close(); }
const result = { status: "PASS", scope: "existing local UI in fresh anonymous contexts; not new feature, real accounts or mobile hardware", transitions: runs.reduce((sum, run) => sum + run.steps.length, 0), runs };
writeFileSync(fileURLToPath(new URL("./browser-random-evidence.json", import.meta.url)), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ status: result.status, scope: result.scope, transitions: result.transitions, runs: runs.map(({ steps, ...rest }) => ({ ...rest, steps: steps.length })) }, null, 2));
