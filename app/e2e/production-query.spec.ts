import { expect, test } from "@playwright/test"

test("does not write journal data for a legacy uitest query", async ({ page }) => {
  // Given
  await page.goto("/?app=1&uitest=seed")

  // Then
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("trainoracle.journal.v1")))
    .toBeNull()
})
