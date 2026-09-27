import { expect, test } from "@playwright/test"
import { completeQuickPlan } from "./plan-flow"

test.use({ serviceWorkers: "block" })
test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await page.clock.setFixedTime(new Date(2026, 8, 27, 12))
})

test("keyboard leap-date selection returns from the reader to the date, not the page body", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click()
  await page.getByRole("button", { name: /년월과 날짜 이동/ }).click()
  await page.getByLabel("날짜로 이동", { exact: true }).fill("2028-02-29")
  const reader = page.getByRole("dialog", { name: "2028년 2월 29일 화요일" })
  await expect(reader).toBeVisible()
  await reader.getByRole("button", { name: "달력으로 돌아가기" }).click()
  const date = page.getByRole("button", { name: /2028년 2월 29일 화요일/ })
  await expect(date).toBeFocused()
  await page.keyboard.press("ArrowLeft")
  const moved = page.getByRole("button", { name: /2028년 2월 28일 월요일/ })
  await expect(moved).toBeFocused()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Shift+Tab")
  await expect(moved).toBeFocused()
})

test("deleting a diary in the training-day reader refreshes its summary and calendar badge", async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
    id: "synthetic-calendar-delete", kind: "post-session", date: "2026-09-27", savedAt: "2026-09-27T01:00:00Z",
    syncState: "local", system: "base", title: "", memo: "", distanceKm: "3", durationMin: "20", avgPace: "", rpe: 3,
    activitySlot: "AM", painCheckStatus: "NO_SIGNAL_REPORTED", fieldProvenance: {
      distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" },
      rpe: { provenance: "EXPLICIT" }, painCheckStatus: { provenance: "EXPLICIT" },
    },
  }])))
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
  await completeQuickPlan(page, { days: /^매일/u })
  await page.getByRole("button", { name: "이 일정으로 시작" }).click()
  const before = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
  const calendar = page.getByRole("grid", { name: "2026년 9월 달력" })
  const today = calendar.getByRole("button", { name: /2026년 9월 27일 일요일/ })
  await expect(today).toContainText("일지 1")
  await today.click()
  await expect(page.locator(".active-plan__created-toast")).toHaveCount(0)
  const reader = page.getByRole("dialog", { name: "2026년 9월 27일 일요일" })
  await expect(reader.getByText("통증을 느끼지 않았다고 기록했어요")).toBeVisible()
  await reader.getByRole("button", { name: "일지·메모 원문 열기" }).click()
  await reader.getByRole("button", { name: "이 일지 지우기" }).click()
  await page.getByRole("button", { name: "휴지통으로 이동", exact: true }).click()
  await expect(reader.getByTestId("delete-undo-button")).toBeVisible()
  await reader.getByRole("button", { name: "날짜 요약으로", exact: true }).click()
  await expect(reader.getByText("이날 작성한 일지가 없어요.")).toBeVisible()
  await reader.screenshot({ path: info.outputPath("deleted-journal-calendar-reader.png") })
  await reader.getByRole("button", { name: "달력으로 돌아가기" }).click()
  await expect(today).not.toContainText("일지 1")
  await expect(today).toBeFocused()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(before)
})
