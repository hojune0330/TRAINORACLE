import { chromium, expect } from "../../../../app/node_modules/@playwright/test/index.mjs"
import { writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const base = process.argv[2] ?? "http://127.0.0.1:4209/"
const publicBuild = new URL(base).hostname === "hojune0330.github.io"
const prefix = publicBuild ? "public" : "local"
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const width of [320, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 812 }, serviceWorkers: "block" })
    const errors = []
    const blocked = []
    await context.route("**/*", route => {
      const request = route.request()
      if (new URL(request.url()).origin === new URL(base).origin && ["GET", "HEAD"].includes(request.method())) return route.continue()
      blocked.push({ origin: new URL(request.url()).origin, method: request.method() })
      return route.abort()
    })
    const page = await context.newPage()
    page.on("pageerror", error => errors.push(error.message))
    try {
      await page.goto(`${base}?app=1&uitest=1`)
      await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
      await page.getByRole("radio", { name: "기록 없이" }).click()
      await page.getByRole("combobox", { name: "종목" }).selectOption("1500")
      await page.getByRole("button", { name: "내 계획 받기", exact: true }).click()
      await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
      await page.getByRole("button", { name: /^3일/u }).click()
      await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
      await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()
      const calendar = page.locator(".month-calendar")
      await expect(calendar).toHaveCount(1)
      await calendar.scrollIntoViewIfNeeded()
      const geometry = await calendar.locator("td button").evaluateAll(buttons => buttons.map(button => {
        const rect = button.getBoundingClientRect()
        return { date: button.dataset.date, x: rect.x, right: rect.right, width: rect.width, height: rect.height }
      }))
      expect(geometry.length).toBeGreaterThanOrEqual(28)
      expect(geometry.every(rect => rect.width >= 44 && rect.height >= 44 && rect.x >= 0 && rect.right <= width)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await calendar.screenshot({ path: fileURLToPath(new URL(`${prefix}-calendar-${width}.png`, import.meta.url)) })
      const date = calendar.locator('td[data-in-range="true"] button').first()
      const dateLabel = await date.getAttribute("aria-label")
      await date.click()
      const reader = page.getByRole("dialog")
      await expect(reader).toBeVisible()
      await expect(reader.locator('[data-session-slot="AM"]')).toBeVisible()
      await reader.getByRole("button", { name: "달력으로 돌아가기", exact: true }).click()
      await expect(reader).not.toBeVisible()
      await expect(date).toBeFocused()
      expect(errors).toEqual([])
      results.push({ width, dateLabel, geometry, errors, blocked, calendarReaderReturn: true })
    } finally { await context.close() }
  }
  await writeFile(new URL(`${prefix}-release-smoke.json`, import.meta.url), JSON.stringify({ base, syntheticOnly: true, accountLogin: false, results }, null, 2))
  console.log(JSON.stringify({ base, widths: results.map(result => result.width), result: "PASS" }))
} finally { await browser.close() }
