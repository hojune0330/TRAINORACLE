import { expect, test } from "@playwright/test"

test("keeps the race save action above the bottom navigation on mobile", async ({ page }) => {
  // Given
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /기록/u }).click()
  await page.getByRole("button", { name: /경기/u }).click()
  const paceMinutes = page.getByRole("spinbutton", { name: "목표 페이스 분" })
  await paceMinutes.fill("3")
  await page.getByRole("spinbutton", { name: "목표 페이스 초" }).fill("60")
  await paceMinutes.focus()
  await expect.poll(() => paceMinutes.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none")

  // When
  const saveButton = page.getByRole("button", { name: /^저장/u })
  const bottomNavigation = page.getByRole("navigation", { name: "주 탭" })
  await expectSaveAboveNavigation(saveButton, bottomNavigation)

  await page.getByRole("button", { name: "경기 직후" }).click()
  await expectSaveAboveNavigation(saveButton, bottomNavigation)
  await page.getByRole("button", { name: "경기 직전" }).click()

  await saveButton.click()
  await expect(page.getByRole("alert")).toContainText("0부터 59")
  await expect(saveButton).toBeVisible()
  await expect(page.getByRole("button", { name: "저장", exact: false })).toHaveCount(1)
})

async function expectSaveAboveNavigation(
  saveButton: import("@playwright/test").Locator,
  bottomNavigation: import("@playwright/test").Locator,
): Promise<void> {
  const saveBox = await saveButton.boundingBox()
  const navigationBox = await bottomNavigation.boundingBox()
  expect(saveBox).not.toBeNull()
  expect(navigationBox).not.toBeNull()
  if (saveBox === null || navigationBox === null) return
  expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(navigationBox.y)
}
