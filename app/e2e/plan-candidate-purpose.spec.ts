import { expect, test } from "@playwright/test"
import { completeDetailedPlan } from "./plan-flow"

test.use({ serviceWorkers: "block" })

test("explains the easy-session time difference while keeping the selected purpose identical", async ({ page }, testInfo) => {
  // Given: a mobile athlete starts a new LT-focused plan.
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await completeDetailedPlan(page, { division: /고등부/u, time: /아침에 운동해요/u })

  // Then: both choices preserve the selected purpose and explain only the easy-session time difference.
  await page.locator("summary", { hasText: "A와 B는 뭐가 달라요?" }).click()
  const comparison = page.getByRole("region", { name: "두 계획 핵심 비교" })
  await expect(comparison.getByText("쉬운 날은 시간 범위로")).toBeVisible()
  await expect(comparison.getByText("쉬운 날은 가장 짧게")).toBeVisible()
  await expect(comparison.getByText(/같은 날·시간대에 같은 시간·RPE 범위/u)).toBeVisible()
  await expect(comparison).not.toContainText("같은 횟수와 RPE로")
  await expect(comparison).toContainText("구체적인 반복과 회복 방법이 정해진 것은 아니에요.")
  await expect(comparison).not.toContainText("보조훈련")
  await expect(comparison).not.toContainText("보조 훈련")
  await expect(comparison.getByText(/조금 힘들게 꾸준히 · LT 1일/u)).toHaveCount(1)
  expect(
    await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth),
  ).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("candidate-purpose-320.png"), fullPage: true })
})
