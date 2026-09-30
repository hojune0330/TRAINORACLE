// Read-only UI baseline. Fresh browser contexts, synthetic records, loopback only.
import { chromium } from "../../../app/node_modules/@playwright/test/index.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("./baseline/", import.meta.url));
mkdirSync(root, { recursive: true });
const baseURL = process.env.CALENDAR_REVIEW_URL ?? "http://127.0.0.1:4194";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const observations = [];
try {
  for (const width of [375, 320]) for (const kind of ["empty", "old-record"]) {
    const context = await browser.newContext({ viewport: { width, height: 667 }, serviceWorkers: "block" });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
      if (/react-scan|react-grab/.test(url.pathname)) return route.fulfill({
        contentType: "application/javascript", body: "export function scan() {}",
      });
      return route.continue();
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(2026, 8, 29, 12));
    if (kind === "old-record") await page.addInitScript(() => {
      localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
        id: "synthetic-calendar-history", kind: "post-session", date: "2025-08-18", savedAt: "2025-08-18T01:00:00Z",
        syncState: "local", system: "base", title: "", memo: "", distanceKm: "3", durationMin: "20", avgPace: "", rpe: 3,
        activitySlot: "AM", painCheckStatus: "NO_SIGNAL_REPORTED", fieldProvenance: {
          distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" },
          rpe: { provenance: "EXPLICIT" }, painCheckStatus: { provenance: "EXPLICIT" },
        },
      }]));
    });
    await page.goto(`${baseURL}/?app=1&uitest=1`);
    await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click();
    const grid = page.getByRole("grid");
    await grid.waitFor({ state: "visible" });
    const firstMonth = await grid.getAttribute("aria-label");
    const screenshot = `${root}${kind}-${width}.png`;
    await page.screenshot({ path: screenshot });
    const before = await page.evaluate(() => localStorage.getItem("trainoracle.journal.v1"));
    const dimensions = await grid.getByRole("button").evaluateAll(nodes => {
      const boxes = nodes.map(node => node.getBoundingClientRect());
      return { minDateTargetWidth: Math.min(...boxes.map(b => b.width)),
        minDateTargetHeight: Math.min(...boxes.map(b => b.height)),
        horizontalPageOverflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    const entry = { kind, firstMonth, viewport: `${width}x667`, dimensions, screenshot: `baseline/${kind}-${width}.png` };
    if (kind === "old-record") {
      entry.oldRecordListPresent = await page.getByRole("button", { name: /2025년 8월/ }).count() > 0;
      await page.getByRole("button", { name: /년월과 날짜 이동/ }).click();
      await page.getByLabel("날짜로 이동", { exact: true }).fill("2025-08-18");
      const dialog = page.getByRole("dialog", { name: "2025년 8월 18일 월요일" });
      await dialog.waitFor({ state: "visible" });
      entry.detailOpens = true;
      await dialog.getByRole("button", { name: "달력으로 돌아가기" }).click();
      entry.returnMonth = await grid.getAttribute("aria-label");
      entry.returnFocused = await page.getByRole("button", { name: /2025년 8월 18일 월요일/ }).evaluate(el => el === document.activeElement);
      await page.screenshot({ path: `${root}old-record-return-${width}.png` });
      await grid.locator("button[data-date='2025-08-18']").click();
      await page.getByRole("dialog").getByRole("button", { name: "크게 보기 다음 날짜" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "달력으로 돌아가기" }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      entry.afterReaderNext = await grid.evaluate(el => ({
        selectedDate: el.querySelector("button[data-selected]")?.getAttribute("data-date"),
        focusedDate: document.activeElement?.getAttribute("data-date"),
      }));
      const tabs = page.getByRole("navigation", { name: "주 탭" });
      await tabs.getByRole("button", { name: "홈", exact: true }).click();
      await tabs.getByRole("button", { name: "일지", exact: true }).click();
      await grid.waitFor({ state: "visible" });
      entry.crossTabReturnMonth = await grid.getAttribute("aria-label");
      await page.getByRole("button", { name: /년월과 날짜 이동/ }).click();
      await page.getByLabel("날짜로 이동", { exact: true }).fill("2025-08-18");
      await page.getByRole("dialog").getByRole("button", { name: "일지·메모 원문 열기" }).click();
      await page.locator(".journal-day-reader").waitFor({ state: "visible" });
      await page.goBack({ waitUntil: "domcontentloaded" });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      entry.originalReaderBrowserBack = {
        url: page.url(), calendarCount: await page.getByRole("grid").count(),
        fullReaderCount: await page.locator(".journal-day-reader").count(),
      };
      await page.screenshot({ path: `${root}original-reader-back-${width}.png` });
    }
    entry.journalUnchangedByNavigation = before === await page.evaluate(() => localStorage.getItem("trainoracle.journal.v1"));
    observations.push(entry);
    await context.close();
  }
} finally { await browser.close(); }
const result = { scope: "current local UI, not proposed feature or live deployment", baseURL,
  devInstrumentationDisabled: ["react-scan", "react-grab"], fixedToday: "2026-09-29", observations };
writeFileSync(`${root}observations.json`, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
