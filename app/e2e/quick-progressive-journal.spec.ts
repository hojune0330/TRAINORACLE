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
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
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
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()

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
  await expect(page.getByRole("heading", { name: "몸에는 어느 정도로 느껴졌나요?" })).toBeFocused()
  await page.getByRole("button", { name: /RPE 7,/u }).click()

  const safety = page.getByRole("heading", { name: "운동 후 불편하거나 아픈 곳이 있나요?" })
  await expect(safety).toBeInViewport()
  await expect(safety).toBeFocused()
})

test("confirms mixed exercises before saving and preserves them when deepening the same journal", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await page.getByRole("button", { name: "운동을 마쳤어요" }).click()
  await page.getByRole("button", { name: "오전", exact: true }).click()
  await page.getByRole("button", { name: /RPE 5,/u }).click()
  await page.getByRole("button", { name: "없어요", exact: true }).click()
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeFocused()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "[]"), JOURNAL_KEY)).toHaveLength(0)
  await page.getByRole("button", { name: "운동 추가·수정" }).click()
  await page.getByRole("button", { name: "운동 추가", exact: true }).click()
  await page.getByRole("button", { name: "반복 달리기", exact: true }).click()
  await page.getByRole("button", { name: "거리·시간·횟수 적기" }).click()
  await page.getByLabel("1번 거리 (m)", { exact: true }).fill("400")
  await page.getByLabel("1번 시간 (초)", { exact: true }).fill("80")
  await page.getByLabel("1번 반복 횟수", { exact: true }).fill("10")
  await page.getByLabel("1번 세트 수", { exact: true }).fill("2")
  await page.getByLabel("1번 반복 회복", { exact: true }).selectOption("TIMED")
  await page.getByLabel("1번 반복 회복 초", { exact: true }).fill("60")
  await page.getByLabel("1번 세트 회복", { exact: true }).selectOption("TIMED")
  await page.getByLabel("1번 세트 회복 초", { exact: true }).fill("180")
  await page.getByRole("button", { name: "글 쓰기", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 남길 말", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "오늘 남길 말", exact: true })).toBeFocused()
  await page.getByRole("button", { name: "운동 내용", exact: true }).click()
  await expect(page.getByLabel("1번 거리 (m)", { exact: true })).toHaveValue("400")
  await expect(page.getByLabel("1번 세트 회복 초", { exact: true })).toHaveValue("180")
  await page.getByRole("button", { name: "내용 반영", exact: true }).click()
  await page.getByRole("button", { name: "운동 추가", exact: true }).click()
  await page.getByRole("button", { name: "근력 운동", exact: true }).click()
  await page.getByRole("button", { name: "내용 반영", exact: true }).click()
  await page.getByRole("button", { name: "기록 요약으로", exact: true }).click()
  await expect(page.getByText(/10회 × 2세트/u)).toBeVisible()
  await expect(page.getByText("근력 운동", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("mixed-exercise-review-320.png"), fullPage: true })
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "[]"), JOURNAL_KEY)
  expect(before).toHaveLength(1)
  expect(before[0].exerciseLog.components).toHaveLength(2)
  expect(before[0].exerciseLog.components[0].rows[0]).toMatchObject({ distanceM: 400, durationSeconds: 80,
    repetitions: 10, sets: 2, recovery: { kind: "TIMED", seconds: 60 }, setRecovery: { kind: "TIMED", seconds: 180 } })
  expect(before[0].exerciseLog.components[1].rows).toEqual([])
  await page.getByRole("button", { name: "일지 더 쓰기" }).click()
  await page.getByRole("button", { name: /^수정 저장/u }).click()
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "[]"), JOURNAL_KEY)
  expect(after).toHaveLength(1)
  expect(after[0].id).toBe(before[0].id)
  expect(after[0].exerciseLog).toEqual(before[0].exerciseLog)
})

test("keeps optional exercise controls usable with doubled text and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await page.getByRole("button", { name: "운동을 마쳤어요" }).click()
  await page.getByRole("button", { name: "시간 미지정", exact: true }).click()
  await page.getByRole("button", { name: "모르겠어요 · RPE는 비워 둘게요", exact: true }).click()
  await page.getByRole("button", { name: "없어요", exact: true }).click()
  await page.getByRole("button", { name: "운동 추가·수정" }).click()
  await page.getByRole("button", { name: "운동 추가", exact: true }).click()
  await page.getByRole("button", { name: "근력 운동", exact: true }).click()
  await page.getByRole("button", { name: "거리·시간·횟수 적기" }).click()
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll<HTMLElement>(".exercise-editor *")]
      .map(element => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }))
    for (const { element, size } of sizes) {
      element.style.fontSize = `${size * 2}px`
    }
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByLabel("1번 중량 (kg)", { exact: true }).fill("60")
  await page.getByRole("button", { name: "내용 반영", exact: true }).click()
  await expect(page.getByText("60kg", { exact: true })).toBeVisible()
})
