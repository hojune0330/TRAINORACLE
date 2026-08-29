import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { selectNineDayProjection } from "./plan-flow"

test.use({ serviceWorkers: "block" })

async function answerMinimumPlanQuestions(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^1500m\b/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /날마다 달라요/u }).click()
  await page.getByRole("button", { name: "하루 한 번 운동" }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()
}

test("retries a selected plan save and keeps the plan after reload", async ({ page }) => {
  // Given: the first plan storage write fails in the real browser surface.
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem
    let failedPlanSave = false
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (key === "trainoracle.plan-beta.v1" && !failedPlanSave) {
        failedPlanSave = true
        throw new DOMException("Storage is full", "QuotaExceededError")
      }
      originalSetItem.call(this, key, value)
    }
  })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await answerMinimumPlanQuestions(page)

  // When: the athlete selects a candidate, retries, and returns after a reload.
  await page.getByRole("button", { name: /선택하기/u }).first().click()
  await expect(page.getByRole("alert")).toContainText("계획을 이 기기에 저장하지 못했어요")
  await page.getByRole("button", { name: "계획 다시 저장하기" }).click()
  await expect(page.getByRole("heading", { name: /9일 훈련 계획/u })).toBeVisible()
  await expect.poll(() => page.evaluate(
    () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
  )).not.toBeNull()
  await page.reload()

  // Then: the selected plan is still the active plan, not a candidate-only screen.
  await expect.poll(() => page.evaluate(
    () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
  )).not.toBeNull()
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await expect(page.getByRole("heading", { name: /9일 훈련 계획/u })).toBeVisible()
  await expect(page.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" })).toHaveCount(0)
  await expect(page.getByText("각 훈련을 마친 뒤 완료·휴식·건너뜀·통증 확인 중 하나를 기록해 주세요."))
    .toBeVisible()
})

test("retries a completed-session save without losing the active plan", async ({ page }) => {
  // Given: selecting the plan succeeds, but its first progress update cannot reach local storage.
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem
    let planWriteCount = 0
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (key === "trainoracle.plan-beta.v1") {
        planWriteCount += 1
        if (planWriteCount === 2) {
          throw new DOMException("Storage is full", "QuotaExceededError")
        }
      }
      originalSetItem.call(this, key, value)
    }
  })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await answerMinimumPlanQuestions(page)
  await page.getByRole("button", { name: /선택하기/u }).first().click()

  // When: the athlete records completion, sees the save failure, and retries the same change.
  await page.getByText("오전 훈련 방법과 기록", { exact: true }).first().click()
  await page.getByRole("button", { name: "완료" }).first().click()
  await expect(page.getByRole("alert")).toContainText("계획을 이 기기에 저장하지 못했어요")
  await page.getByRole("button", { name: "진행 상태 다시 저장하기" }).click()

  // Then: the selected plan remains active and its original completion is persisted after reload.
  await expect.poll(() => page.evaluate(
    () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
  )).toContain("COMPLETED")
  await page.reload()
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await page.getByText("오전 훈련 방법과 기록", { exact: true }).first().click()
  await expect(page.getByLabel("DAY 1 오전 진행 기록").getByRole("button", { name: "완료" })).toHaveAttribute("aria-pressed", "true")
})
