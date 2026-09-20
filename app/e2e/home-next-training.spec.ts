import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { completeDetailedPlan } from "./plan-flow"
import { expectActivePlanHeading } from "./active-plan-flow"

test.use({ serviceWorkers: "block" })

async function answerPlanQuestions(page: Page): Promise<void> {
  await completeDetailedPlan(page, { division: /고등부/u })
}

test("shows a saved upcoming training on home and opens its existing plan", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await answerPlanQuestions(page)
  await page.getByLabel("계획 시작 날짜").fill("2099-01-10")
  await page.getByRole("button", { name: /선택하기|이 계획으로 시작하기/u }).first().click()
  await page.getByRole("button", { name: "홈" }).click()

  const nextTraining = page.getByRole("region", { name: "다음 훈련" })
  await expect(nextTraining).toContainText("1월 10일")
  await expect(nextTraining).toContainText("RPE")
  await expect(nextTraining).not.toContainText("목표 페이스")
  await nextTraining.getByRole("button", { name: /^다음 훈련/u }).click()
  await expectActivePlanHeading(page)
})
