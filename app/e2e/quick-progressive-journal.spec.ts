import { expect, test } from "@playwright/test"

const JOURNAL_KEY = "trainoracle.journal.v1"

test.beforeEach(async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
})

test("finishes a quick journal and deepens the same record without duplication", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await expect(page.getByRole("heading", { name: "오늘 운동은 어떻게 됐나요?" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("quick-journal-start.png"), fullPage: true })

  await page.getByRole("button", { name: "운동을 마쳤어요" }).click()
  await page.getByRole("button", { name: "오후" }).click()
  await page.getByRole("button", { name: /RPE 6,/u }).click()
  await page.getByRole("button", { name: "없어요" }).click()
  await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()

  const quick = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), JOURNAL_KEY)
  expect(quick).toHaveLength(1)
  expect(quick[0]).toMatchObject({
    captureDepth: "QUICK",
    activityOutcome: "COMPLETED",
    activitySlot: "PM",
    rpe: 6,
    painCheckStatus: "NO_SIGNAL_REPORTED",
  })
  expect(quick[0].rpeBand).toBeUndefined()
  const id = quick[0].id as string

  await page.getByRole("button", { name: "일지 더 쓰기" }).click()
  await expect(page.getByText("훈련 후 · 기록", { exact: true })).toBeVisible()
  await expect(page.getByLabel("세션 제목")).toHaveValue("운동 완료")
  await page.getByLabel("거리 (km)").fill("6.2")
  await page.getByRole("button", { name: "수정 저장" }).click()

  const detailed = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), JOURNAL_KEY)
  expect(detailed).toHaveLength(1)
  expect(detailed[0]).toMatchObject({ id, captureDepth: "DETAILED", distanceKm: "6.2" })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("removes spatial quick-journal motion when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await page.getByRole("button", { name: "오늘은 쉬었어요" }).click()

  const stamp = page.locator(".quick-log__stamp")
  await expect(stamp).toBeVisible()
  await expect(stamp).toHaveCSS("animation-name", "none")
})

test("keeps each newly opened choice reachable on a 375x667 phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await page.getByRole("button", { name: "운동을 마쳤어요" }).click()

  const slot = page.getByRole("button", { name: "오전" })
  await expect(slot).toBeInViewport()
  await slot.click()
  await page.getByRole("button", { name: /RPE 7,/u }).click()

  const safety = page.getByRole("heading", { name: "운동 후 불편하거나 아픈 곳이 있나요?" })
  await expect(safety).toBeInViewport()
  await expect(safety).toBeFocused()
})
