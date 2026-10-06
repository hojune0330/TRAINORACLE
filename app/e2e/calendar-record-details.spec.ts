import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test("same real calendar in journal and cycle, health details on demand, no record mutation", async ({ page }, info) => {
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await page.clock.setFixedTime(new Date(2026, 8, 27, 12))
  await page.addInitScript(() => {
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
      { id: "synthetic-evening", kind: "evening", date: "2026-09-27", savedAt: "2026-09-27T14:00:00Z", syncState: "local",
        sleepH: 7.5, sleepQuality: 4, weightKg: "61.2", restingHr: "55", painParts: { "오른 무릎": 2 }, mood: 3,
        note: "SYNTHETIC_PRIVATE_MEMO", memoPurpose: "PRIVATE_SELF_ONLY",
        fieldProvenance: { sleepH: { provenance: "EXPLICIT" }, weightKg: { provenance: "EXPLICIT" }, restingHr: { provenance: "EXPLICIT" }, painParts: { provenance: "EXPLICIT" }, mood: { provenance: "EXPLICIT" } } },
      { id: "synthetic-race", kind: "race", date: "2026-10-01", savedAt: "2026-10-01T01:00:00Z", syncState: "local",
        stage: "pre", record: "", rank: "", result: "", memo: "", tension: 4, fieldProvenance: { tension: { provenance: "EXPLICIT" } } },
    ]))
  })
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click()
  const before = await page.evaluate(() => localStorage.getItem("trainoracle.journal.v1"))
  await expect(page.getByRole("grid", { name: "2026년 9월 달력" })).toBeVisible()
  const date = page.getByRole("button", { name: /2026년 9월 27일 일요일.*하루 마무리/ })
  await expect(date).toHaveAttribute("aria-current", "date")
  await expect(date).not.toContainText("61.2")
  await date.click()
  const reader = page.getByRole("dialog")
  await expect(reader.getByText("61.2 kg")).toBeVisible()
  await expect(reader.getByText("7.5시간")).toBeVisible()
  await expect(reader.getByText("오른 무릎 2/5")).toBeVisible()
  await expect(reader).not.toContainText("SYNTHETIC_PRIVATE_MEMO")
  await reader.screenshot({ path: info.outputPath("calendar-health-detail.png") })
  await page.goBack()
  await expect(reader).not.toBeVisible()
  await expect(date).toBeFocused()
  await page.getByRole("button", { name: "기록 묶음" }).click()
  await page.getByText("주기 시작일과 표시 기준", { exact: true }).click()
  await page.getByLabel("주기 시작일", { exact: true }).fill("2026-09-27")
  await page.getByText("주기 시작일과 표시 기준", { exact: true }).click()
  await expect(page.getByRole("grid", { name: "2026년 9월 달력" })).toBeVisible()
  await expect(page.getByRole("button", { name: /2026년 10월 1일 목요일.*경기/ })).toContainText("경기")
  for (const width of [320, 375, 1024]) {
    await page.setViewportSize({ width, height: 800 })
    const calendar = page.getByRole("grid")
    await calendar.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const hit = await calendar.getByRole("button", { name: /2026년 9월 27일 일요일/ }).boundingBox()
    expect(hit!.width).toBeGreaterThanOrEqual(43.9)
    await page.locator(".cycle-calendar").screenshot({ path: info.outputPath(`cycle-calendar-${width}.png`) })
  }
  await page.getByRole("button", { name: "다음 달", exact: true }).click()
  await expect(page.getByRole("grid", { name: "2026년 10월 달력" })).toBeVisible()
  await expect(page.getByText("2026-09-27 ~ 2026-10-06 · 10일 구간", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /2026년 10월 1일 목요일.*경기/ }).click()
  await expect(reader.getByRole("heading", { name: /경기 전 기록/ })).toBeVisible()
  await expect(reader.getByText("4/10")).toBeVisible()
  await reader.getByRole("button", { name: "크게 보기 이전 날짜" }).click()
  await expect(reader).toHaveAccessibleName("2026년 9월 30일 수요일")
  await expect(reader.getByText("이날 작성한 일지가 없어요.")).toBeVisible()
  await page.goBack()
  await expect(page.getByRole("grid", { name: "2026년 9월 달력" })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.journal.v1"))).toBe(before)
})
