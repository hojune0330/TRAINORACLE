import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

test.use({ serviceWorkers: "block" })

async function answerPlanQuestions(page: Page): Promise<void> {
  await page.getByRole("button", { name: /800m.*1500m/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await page.getByRole("button", { name: /날마다 달라요/u }).click()
  await page.getByRole("button", { name: "하루 한 번 운동" }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
}

test("shows a saved upcoming training on home and opens its existing plan", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await answerPlanQuestions(page)
  await page.getByLabel("계획 시작 날짜").fill("2099-01-10")
  await page.getByRole("button", { name: /선택하기/u }).first().click()
  await page.getByRole("button", { name: "홈" }).click()

  const nextTraining = page.getByRole("region", { name: "다음 훈련" })
  await expect(nextTraining).toContainText("1월 10일")
  await expect(nextTraining).toContainText("RPE")
  await expect(nextTraining).not.toContainText("목표 페이스")
  await nextTraining.getByRole("button", { name: /^다음 훈련/u }).click()
  await expect(page.getByRole("heading", { name: /9.5일 계획/u })).toBeVisible()
})
