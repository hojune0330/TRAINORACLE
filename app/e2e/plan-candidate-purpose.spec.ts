import { expect, test } from "@playwright/test"
import { selectNineDayProjection } from "./plan-flow"

test.use({ serviceWorkers: "block" })

test("explains the easy-session time difference while keeping the selected purpose identical", async ({ page }, testInfo) => {
  // Given: a mobile athlete starts a new LT-focused plan.
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/ })
    .click()
  await page.getByRole("button", { name: /^1500m/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험이 있어요/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()

  // Then: both choices preserve the selected purpose and explain only the easy-session time difference.
  const comparison = page.getByRole("region", { name: "두 계획 핵심 비교" })
  await expect(comparison.getByText("쉬운 훈련 시간을 범위로 표시해요.")).toBeVisible()
  await expect(comparison.getByText("쉬운 훈련을 가장 짧은 시간으로 표시해요.")).toBeVisible()
  await expect(comparison.getByText(/같은 날·시간대에 같은 시간·RPE 범위/u)).toBeVisible()
  await expect(comparison).not.toContainText("같은 횟수와 RPE로")
  await expect(comparison).toContainText("구체적인 반복과 회복 방법이 정해진 것은 아니에요.")
  await expect(comparison).not.toContainText("보조훈련")
  await expect(comparison).not.toContainText("보조 훈련")
  await expect(comparison.getByText(/지속 페이스 · LT 1일/u)).toHaveCount(1)
  expect(
    await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth),
  ).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("candidate-purpose-320.png"), fullPage: true })
})
