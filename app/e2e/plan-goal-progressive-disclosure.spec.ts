import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test("shows only the four currently supported exact plan events", async ({ page }, testInfo) => {
  // Given: a new athlete has opened the plan flow.
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u })
    .click()
  const choices = page.getByRole("group", { name: "계획 종목 선택" })
  await expect(choices.getByRole("button")).toHaveCount(4)
  await expect(choices.getByRole("button", { name: /^800m\b/u })).toBeVisible()
  await expect(choices.getByRole("button", { name: /^1500m\b/u })).toBeVisible()
  await expect(choices.getByRole("button", { name: /^3000m\b/u })).toBeVisible()
  await expect(choices.getByRole("button", { name: /^5000m\b/u })).toBeVisible()
  await expect(choices).not.toContainText("10km")
  await expect(page.getByRole("button", { name: /10km/u })).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath("supported-plan-events.png"),
    fullPage: true,
  })
})
