import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test("reveals the 10 km plan goal only after an athlete asks for it", async ({ page }, testInfo) => {
  // Given: a new athlete has opened the plan flow.
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u })
    .click()
  const choices = page.getByRole("group", { name: "계획 종목 선택" })
  await expect(choices.getByRole("button")).toHaveCount(3)
  await expect(choices).not.toContainText("10km")

  // When: the athlete asks to see the 10 km option.
  await page.getByRole("button", { name: "10km 계획 보기" }).click()

  // Then: it becomes the fourth explicit plan choice without changing the first view.
  await expect(choices.getByRole("button")).toHaveCount(4)
  await expect(choices.getByRole("button", { name: /10km/u })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath("10km-plan-goal-expanded.png"),
    fullPage: true,
  })
})
