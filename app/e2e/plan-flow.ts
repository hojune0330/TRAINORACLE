import { expect, type Page } from "@playwright/test"

export async function selectNineDayProjection(page: Page): Promise<void> {
  await expect(page.getByRole("heading", {
    name: "이번에 며칠 계획을 받을까요?",
  })).toBeVisible()
  await page.getByRole("button", { name: /^9일 계획 받기/u }).click()
}
