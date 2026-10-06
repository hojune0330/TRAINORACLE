import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { completeDetailedPlan } from "./plan-flow"
import { openActivePlanCards } from "./active-plan-flow"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === appOrigin
    ? route.continue() : route.abort())
})

async function answerTwoSessionPlanQuestions(page: Page): Promise<void> {
  await completeDetailedPlan(page, { division: /고등부/u, time: /아침에 운동해요/u, twice: true })
}

test("shows a dated AM and PM plan before selection and after reload", async ({ page }) => {
  // Given
  await page.clock.setFixedTime(new Date(2026, 7, 17, 12))
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await answerTwoSessionPlanQuestions(page)
  await page.getByLabel("계획 시작 날짜").fill("2026-08-17")

  // When
  await expect(page.getByRole("group", { name: /훈련 2개/u })).toHaveCount(3)
  const overview = page.getByLabel("9일 훈련 일정").first()
  await expect(overview.getByRole("button", {
    name: /8월 25일 화요일/u,
  })).toContainText("기본")
  await expect(overview.getByRole("button", {
    name: /8월 25일 화요일/u,
  })).toHaveAccessibleName(/오전 기초 지구력 · 오후 회복 운동/u)
  await expect(overview.getByRole("button", {
    name: /8월 25일 화요일/u,
  })).toContainText("회복")
  const candidateDay = page.getByRole("group", {
    name: "8월 25일 화요일 · 훈련 2개",
  }).first()
  await expect(candidateDay).toContainText("오전")
  await expect(candidateDay).toContainText("오후")
  await expect(candidateDay.getByRole("button", { name: "회복 운동 REC 훈련 설명 보기", exact: true })).toBeVisible()
  await page.getByRole("button", { name: /선택하기|이 계획으로 시작하기/u }).first().click()
  await expect(page.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  await page.reload()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()

  // Then
  await openActivePlanCards(page)
  await expect(page.getByLabel("현재 날짜 위치")).toHaveText("1/9")
  for (let day = 1; day < 9; day += 1) {
    await page.getByRole("button", { name: "다음 날짜", exact: true }).click()
  }
  const activeDay = page.getByRole("group", {
    name: "8월 25일 화요일 · 훈련 2개",
  })
  await expect(activeDay).toContainText("오전")
  await expect(activeDay).toContainText("오후")
  await expect(activeDay.getByRole("button", { name: "회복 운동 REC 훈련 설명 보기", exact: true })).toBeVisible()
  await expect(page.getByLabel("9일 훈련 일정")).toContainText("회복")
  await expect(page.getByRole("group", { name: /훈련 2개/u })).toHaveCount(3)
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toContain("2026-08-17")
  await activeDay.getByText("오후 훈련 방법과 기록", { exact: true }).click()
  await activeDay.locator('[data-session-slot="PM"]').getByRole("button", { name: "훈련 방법과 이유", exact: true }).click()
  const reader = page.getByRole("dialog")
  await expect(reader.getByText("9일차 · 오후", { exact: true })).toBeVisible()
  await reader.getByRole("tab", { name: "이유·근거" }).click()
  await expect(reader.getByRole("heading", { name: "회복을 둔 이유", exact: true })).toBeAttached()
  await expect(reader.getByRole("paragraph").filter({ hasText: /대상 종목은 1500m/u })).toBeAttached()
  await reader.getByRole("button", { name: "훈련 일정으로 돌아가기" }).click()
})
