import { expect, test } from "@playwright/test"

test("does not write journal data for a legacy uitest query", async ({ page }) => {
  // Given: a fresh device journal and the former test-only query string.
  await page.goto("/?app=1&uitest=seed")

  // When: the production app finishes its initial render.
  await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()

  // Then: the query must not create a journal entry in browser storage.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("trainoracle.journal.v1")))
    .toBeNull()
})

test("does not expose the P3 active-template fixture in a production build", async ({
  page,
}) => {
  await page.goto("/?p3-pace-fixture=1")

  await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "기준 기록을 고르세요" }),
  ).toHaveCount(0)
  await expect(page.getByText("3분 42초")).toHaveCount(0)
  await expect(page.getByText("3분 30초")).toHaveCount(0)
})
