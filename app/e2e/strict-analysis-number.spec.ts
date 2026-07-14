import { expect, test } from "@playwright/test"

test("excludes a tampered distance with trailing text from the trends total", async ({ page }) => {
  // Given
  const now = new Date()
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
  await page.addInitScript((entryDate) => {
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "tampered-distance",
      kind: "post-session",
      date: entryDate,
      savedAt: `${entryDate}T00:00:00.000Z`,
      syncState: "local",
      system: "easy",
      title: "오염 입력",
      distanceKm: "12abc",
      durationMin: "60",
      avgPace: "5:00",
      rpe: 4,
      memo: "",
    }]))
  }, date)
  await page.goto("/?app=1")

  // When
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /추이/u }).click()

  // Then
  await expect(page.getByText(/0km · 전체 누적/u)).toBeVisible()
  await expect(page.getByText(/12km · 전체 누적/u)).toHaveCount(0)
})
