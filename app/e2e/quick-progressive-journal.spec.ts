import { expect, test } from "@playwright/test"

const JOURNAL_KEY = "trainoracle.journal.v1"

test.beforeEach(async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
})

test("finishes a quick journal and deepens the same record without duplication", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await expect(page.getByRole("heading", { name: "오늘 어떻게 움직였나요?" })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("quick-journal-start.png"), fullPage: true })

  await page.getByRole("button", { name: "계획한 훈련을 했어요" }).click()
  await page.getByRole("button", { name: "오후" }).click()
  await page.getByRole("button", { name: /5~6/u }).click()
  await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()

  const quick = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), JOURNAL_KEY)
  expect(quick).toHaveLength(1)
  expect(quick[0]).toMatchObject({
    captureDepth: "QUICK",
    activityOutcome: "COMPLETED",
    activitySlot: "PM",
    rpeBand: "RPE_5_6",
    rpe: 0,
  })
  const id = quick[0].id as string

  await page.getByRole("button", { name: "일지 더 쓰기" }).click()
  await expect(page.getByText("훈련 후 · 기록", { exact: true })).toBeVisible()
  await expect(page.getByLabel("세션 제목")).toHaveValue("훈련 완료")
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
  await page.getByRole("button", { name: "한 번" }).click()
  await page.getByRole("button", { name: /모르겠어요/u }).click()

  const stamp = page.locator(".quick-log__stamp")
  await expect(stamp).toBeVisible()
  await expect(stamp).toHaveCSS("animation-name", "none")
})
