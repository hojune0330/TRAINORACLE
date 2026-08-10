import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test("explains why the conservative plan has no selected-purpose session", async ({ page }, testInfo) => {
  // Given: a mobile athlete starts a new LT-focused plan.
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/ })
    .click()
  await page.getByRole("button", { name: /800m.*1500m/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험이 있어요/u }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()

  // When: the athlete says there is no known current risk.
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()

  // Then: both choices explain their different purpose before either one is saved.
  await expect(page.getByText("고른 목적을 이 계획에 넣었어요.")).toBeVisible()
  await expect(page.getByText("고른 목적을 덜어 낸 대안이에요.")).toBeVisible()
  expect(
    await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth),
  ).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("candidate-purpose-320.png"), fullPage: true })
})
