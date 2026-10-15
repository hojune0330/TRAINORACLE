import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { completeDetailedPlan } from "./plan-flow"
import { openActiveDayReader, openActivePlanCards } from "./active-plan-flow"

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
  // Scope to one candidate's day list; mobile also exposes its date summary.
  const candidateDays = page.getByRole("list", { name: "날짜별 계획 미리보기", exact: true }).first()
  await expect(candidateDays.getByRole("group", { name: /훈련 2개/u })).toHaveCount(3)
  const overview = page.getByLabel("9일 훈련 일정").first()
  await overview.getByRole("button", { name: "달력", exact: true }).click()
  await expect(overview.getByRole("button", {
    name: /8월 25일 화요일/u,
  })).toContainText("기본")
  await expect(overview.getByRole("button", {
    name: /8월 25일 화요일/u,
  })).toHaveAccessibleName(/오전 기초 지구력 · .* · 오후 회복 운동/u)
  await expect(overview.getByRole("button", {
    name: /8월 25일 화요일/u,
  })).toContainText("회복")
  await overview.getByRole("button", { name: "하루씩", exact: true }).click()
  const candidateDay = candidateDays.getByRole("group", {
    name: "8월 25일 화요일 · 훈련 2개",
  }).first()
  await expect(candidateDay).toContainText("오전")
  await expect(candidateDay).toContainText("오후")
  await candidateDay.getByRole("button", { name: "8월 25일 화요일 전체 처방 보기", exact: true }).click()
  const candidateReader = page.getByRole("dialog", { name: /^2026년 8월 25일/u })
  await expect(candidateReader.getByRole("button", { name: "회복 운동 REC 훈련 설명 보기", exact: true })).toBeVisible()
  await candidateReader.getByRole("button", { name: "달력으로 돌아가기", exact: true }).click()
  await page.getByRole("button", { name: /선택하기|이 일정으로 시작/u }).first().click()
  await expect(page.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  await page.reload()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()

  // Then
  await openActivePlanCards(page)
  await expect(page.locator(".active-plan .plan-schedule-preview > li")).toHaveCount(9)
  const activeDays = page.getByRole("list", { name: "날짜별 계획 미리보기", exact: true })
  const listedDay = activeDays.getByRole("group", {
    name: "8월 25일 화요일 · 훈련 2개",
  })
  await expect(listedDay).toContainText("오전")
  await expect(listedDay).toContainText("오후")
  await expect(listedDay).toContainText("걷기 중심 런워크")
  await expect(activeDays.getByRole("group", { name: /훈련 2개/u })).toHaveCount(3)
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toContain("2026-08-17")
  const activeDay = await openActiveDayReader(page, 8)
  await expect(activeDay.locator('[data-session-slot="AM"]')).toBeVisible()
  await expect(activeDay.locator('[data-session-slot="PM"]')).toBeVisible()
  await expect(activeDay.getByRole("button", { name: "회복 운동 REC 훈련 설명 보기", exact: true })).toBeVisible()
  await activeDay.locator('[data-session-slot="PM"]').getByRole("button", { name: "훈련 방법과 이유", exact: true }).click()
  const reader = page.locator(".session-explanation[open]")
  await expect(reader.getByText("9일차 · 오후", { exact: true })).toBeVisible()
  await reader.getByRole("tab", { name: "이유·근거" }).click()
  await expect(reader.getByRole("heading", { name: "회복을 둔 이유", exact: true })).toBeAttached()
  await expect(reader.getByRole("paragraph").filter({ hasText: /대상 종목은 1500m/u })).toBeAttached()
  await reader.getByRole("button", { name: "훈련 일정으로 돌아가기" }).click()
})
