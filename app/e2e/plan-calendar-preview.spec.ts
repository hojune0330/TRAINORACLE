import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { selectNineDayProjection } from "./plan-flow"

test.use({ serviceWorkers: "block" })

async function answerTwoSessionPlanQuestions(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^1500m\b/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 두 번 운동할게요/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()
}

test("shows a dated AM and PM plan before selection and after reload", async ({ page }) => {
  // Given
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await answerTwoSessionPlanQuestions(page)
  await page.getByLabel("계획 시작 날짜").fill("2026-08-17")

  // When
  await expect(page.getByRole("group", { name: /훈련 2개/u })).toHaveCount(3)
  const overview = page.getByLabel("9일 훈련 흐름").first()
  await expect(overview.getByRole("listitem", {
    name: /8월 25일 화요일/u,
  })).toContainText("기초")
  await expect(overview.getByRole("listitem", {
    name: /8월 25일 화요일/u,
  })).toContainText("회복")
  const candidateDay = page.getByRole("group", {
    name: "8월 25일 화요일 · 훈련 2개",
  }).first()
  await expect(candidateDay).toContainText("오전")
  await expect(candidateDay).toContainText("오후")
  await expect(candidateDay).toContainText("오후 회복 운동")
  await page.getByRole("button", { name: /선택하기/u }).first().click()
  await expect(page.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  await page.reload()
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()

  // Then
  const activeDay = page.getByRole("group", {
    name: "8월 25일 화요일 · 훈련 2개",
  })
  await expect(activeDay).toContainText("오전")
  await expect(activeDay).toContainText("오후")
  await expect(activeDay).toContainText("오후 회복 운동")
  await expect(page.getByLabel("9일 훈련 흐름")).toContainText("회복")
  await expect(page.getByRole("group", { name: /훈련 2개/u })).toHaveCount(3)
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toContain("2026-08-17")
})
