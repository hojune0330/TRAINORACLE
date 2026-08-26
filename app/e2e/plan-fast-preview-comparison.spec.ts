import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { selectNineDayProjection } from "./plan-flow"

test.use({ serviceWorkers: "block" })

async function openPlan(page: Page): Promise<void> {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u })
    .click()
}

async function answerFirstThree(page: Page, review = false): Promise<void> {
  await page.getByRole("button", { name: /^1500m\b/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", {
    name: review
      ? /통증.*부상.*몸 이상이 있거나 잘 모르겠어요/u
      : /통증은 없고 몸 상태는 평소와 같아요/u,
  }).click()
}

test("shows an unsaved, non-selectable preview after the required direction answers and a clear current-risk answer", async ({ page }) => {
  await openPlan(page)
  await answerFirstThree(page)

  await expect(page.getByRole("heading", { name: "계획 형태 미리보기" })).toBeVisible()
  await expect(page.getByText(
    /훈련일.*첫 계획 길이.*7.*9.*10.*훈련 목적.*시간.*하루 한 번.*두 번/u,
  )).toBeVisible()
  await expect(page.getByRole("button", { name: /선택하기/u })).toHaveCount(0)
  await expect(page.locator(".plan-candidate")).toHaveCount(0)
  await expect.poll(() => page.evaluate(
    () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
  )).toBeNull()

  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await expect(page.getByRole("heading", {
    name: "이번 주기에 어떤 훈련을 더 넣고 싶나요?",
  })).toBeVisible()
})

test("asks for the missing focus and explicit detail mode after fresh safety", async ({ page }) => {
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
  const remaining = page.getByText(/남은 선택 2개/u)
  await expect(remaining).toContainText("훈련 목적")
  await expect(remaining).toContainText("훈련 상세 방식")
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()

  await expect(page.getByRole("heading", {
    name: "이번 주기에 어떤 훈련을 더 넣고 싶나요?",
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
  await expect(page.getByText(/남은 선택 0개/u)).toContainText("저장된 선택을 그대로 다시 사용할 수 있어요")
  await expect(page.getByText(/남은 선택 0개/u)).toContainText("후보는 아직 만들지 않았어요")
  await page.getByRole("button", { name: "계획 후보 만들기" }).click()
  await page.getByRole("button", { name: "날짜 없이 계획 후보 보기" }).click()

  await expect(page.locator(".plan-candidate")).toHaveCount(2)
  await expect(page.getByRole("heading", { name: "두 계획에서 하나를 골라보세요" })).toBeVisible()
})

test("blocks review-risk before any preview or candidates", async ({ page }) => {
  await openPlan(page)
  await answerFirstThree(page, true)

  await expect(page.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "계획 형태 미리보기" })).toHaveCount(0)
  await expect(page.locator(".plan-candidate")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /선택하기/u })).toHaveCount(0)
})

test("moves the single expanded schedule between candidates and allows collapse", async ({ page }) => {
  await openPlan(page)
  await answerFirstThree(page)
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획 후보 보기" }).click()

  const candidateA = page.getByRole("button", { name: "후보 A 일정 접기" })
  const candidateB = page.getByRole("button", { name: "후보 B 일정 펼치기" })
  await expect(candidateA).toHaveAttribute("aria-expanded", "true")
  await expect(candidateB).toHaveAttribute("aria-expanded", "false")
  await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(1)

  await candidateB.click()
  await expect(page.getByRole("button", { name: "후보 A 일정 펼치기" }))
    .toHaveAttribute("aria-expanded", "false")
  await expect(page.getByRole("button", { name: "후보 B 일정 접기" }))
    .toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(1)

  await page.getByRole("button", { name: "후보 B 일정 접기" }).click()
  await expect(page.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveCount(0)
})
