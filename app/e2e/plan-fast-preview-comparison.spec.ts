import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { completeQuickPlan, openPlanOptions, openPlanRefinement, refinePlan } from "./plan-flow"

test.use({ serviceWorkers: "block" })

async function openPlan(page: Page): Promise<void> {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "바로 시작하기" })
    .getByRole("button", { name: /^훈련 계획/u })
    .click()
}

async function answerFirstThree(page: Page, review = false): Promise<void> {
  await completeQuickPlan(page, { review })
}

test("creates unsaved candidates after four explicit answers and exposes optional refinement", async ({ page }) => {
  await openPlan(page)
  await answerFirstThree(page)

  await expect(page.getByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
  await expect(page.getByRole("button", { name: "이 일정으로 시작" })).toHaveCount(1)
  await expect(page.getByRole("button", { name: /선택하기|이 계획으로 시작하기/u })).toHaveCount(0)
  await expect(page.locator(".plan-candidate")).toHaveCount(2)
  await expect(page.getByTestId("plan-refine")).not.toHaveAttribute("open")
  await expect.poll(() => page.evaluate(
    () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
  )).toBeNull()

  await openPlanRefinement(page, "훈련 종류")
  await expect(page.getByRole("heading", {
    name: "더 하고 싶은 훈련이 있나요?",
  })).toBeVisible()
})

test("labels default settings after fresh safety and lets the athlete explicitly refine them", async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("trainoracle.plan-beta.previous-intake.v1", JSON.stringify({
      eventGroup: "FIVE_K",
      eventDistanceM: 5000,
      competitionDivision: "OPEN",
      experienceBand: "DEVELOPING",
      availableDayCount: 6,
      requestedFrameLength: 10,
      trainingTimePreference: "EVENING",
      secondSessionMode: "RECOVERY_PM_ALLOWED",
    }))
  })
  await openPlan(page)

  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await expect(page.locator(".plan-candidate")).toHaveCount(2)
  await expect.poll(() => page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()
  await openPlanRefinement(page, "훈련 종류")

  await expect(page.getByRole("heading", {
    name: "더 하고 싶은 훈련이 있나요?",
  })).toBeVisible()
  await expect(page.locator(".plan-candidate")).toHaveCount(0)
})

test("reuses a fully explicit returning intake to create two candidates", async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("trainoracle.plan-beta.previous-intake.v1", JSON.stringify({
      eventGroup: "FIVE_K",
      eventDistanceM: 5000,
      competitionDivision: "OPEN",
      experienceBand: "DEVELOPING",
      trainingFocus: "VO2_INTENT",
      selectedDetailedTemplateRef: null,
      availableDayCount: 6,
      requestedFrameLength: 10,
      trainingTimePreference: "EVENING",
      secondSessionMode: "RECOVERY_PM_ALLOWED",
    }))
  })
  await openPlan(page)

  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()
  await page.getByTestId("plan-refine").locator("summary").click()
  await expect(page.getByRole("button", { name: /달력 길이 바꾸기.*10일/u })).toBeVisible()
  await expect(page.getByRole("button", { name: /하루 두 번 바꾸기.*함/u })).toBeVisible()

  await expect(page.locator(".plan-candidate")).toHaveCount(2)
  await expect(page.getByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
})

test("blocks review-risk before any preview or candidates", async ({ page }) => {
  await openPlan(page)
  await answerFirstThree(page, true)

  await expect(page.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "계획 형태 미리보기" })).toHaveCount(0)
  await expect(page.locator(".plan-candidate")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /선택하기|이 계획으로 시작하기/u })).toHaveCount(0)
})

test("moves the single expanded schedule between candidates and allows collapse", async ({ page }) => {
  await openPlan(page)
  await answerFirstThree(page)
  await refinePlan(page, "훈련 종류", /조금 힘들게 꾸준히.*LT/u)
  await refinePlan(page, "시간대", /아침에 운동해요/u)
  await openPlanOptions(page, true)

  const candidateA = page.getByRole("button", { name: "계획안 A 일정 접기" })
  const candidateB = page.getByRole("button", { name: "계획안 B 일정 펼치기" })
  await expect(candidateA).toHaveAttribute("aria-expanded", "true")
  await expect(candidateB).toHaveAttribute("aria-expanded", "false")
  await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(1)

  await candidateB.click()
  await expect(page.getByRole("button", { name: "계획안 A 일정 펼치기" }))
    .toHaveAttribute("aria-expanded", "false")
  await expect(page.getByRole("button", { name: "계획안 B 일정 접기" }))
    .toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(1)

  await page.getByRole("button", { name: "계획안 B 일정 접기" }).click()
  await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(0)
})
