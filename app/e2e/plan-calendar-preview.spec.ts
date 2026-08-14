import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

test.use({ serviceWorkers: "block" })

async function answerTwoSessionPlanQuestions(page: Page): Promise<void> {
  await page.getByRole("button", { name: /800m.*1500m/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 두 번 운동할게요/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
}

test("shows a dated AM and PM plan before selection and after reload", async ({ page }) => {
  // Given
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await answerTwoSessionPlanQuestions(page)
  await page.getByLabel("계획 시작 날짜").fill("2026-08-17")

  // When
  await expect(page.getByRole("group", { name: /훈련 2개/u })).toHaveCount(6)
  const overview = page.getByLabel("9.5일 달력 요약").first()
  await expect(overview.getByRole("listitem", {
    name: "8월 25일 화요일 · 훈련 2개",
  })).toContainText("오전")
  await expect(overview.getByRole("listitem", {
    name: "8월 25일 화요일 · 훈련 2개",
  })).toContainText("오후")
  const candidateDay = page.getByRole("group", {
    name: "8월 25일 화요일 · 훈련 2개",
  }).first()
  await expect(candidateDay).toContainText("오전")
  await expect(candidateDay).toContainText("오후")
  await expect(candidateDay).toContainText("오후 회복 운동")
  await page.getByRole("button", { name: /선택하기/u }).first().click()
  await page.reload()
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()

  // Then
  const activeDay = page.getByRole("group", {
    name: "8월 25일 화요일 · 훈련 2개",
  })
  await expect(activeDay).toContainText("오전")
  await expect(activeDay).toContainText("오후")
  await expect(activeDay).toContainText("오후 회복 운동")
  await expect(page.getByRole("group", { name: /훈련 2개/u })).toHaveCount(3)
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toContain("2026-08-17")
})
