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
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
        durationMin: { provenance: "EXPLICIT" },
        avgPace: { provenance: "EXPLICIT" },
        rpe: { provenance: "EXPLICIT" },
      },
    }]))
  }, date)
  await page.goto("/?app=1")

  // When
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()

  // Then
  const distance = page.getByRole("region", { name: "누적 거리와 변화" })
  await expect(distance.getByLabel(/이번 주, 집계 가능한 거리 기록 없음/u)).toBeVisible()
  await expect(distance.getByText(/집계 기준에 맞지 않아 제외한 기록 1건/u).first()).toBeVisible()
  await expect(page.getByText(/12\s*km/u)).toHaveCount(0)
})
