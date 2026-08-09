import { expect, test } from "@playwright/test"

test("opens a recorded day directly from the monthly journal calendar", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "calendar-session",
      kind: "post-session",
      date: "2026-07-10",
      savedAt: "2026-07-10T09:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "달력 확인 훈련",
      distanceKm: "6",
      durationMin: "30",
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
  })

  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지" }).click()
  await page.getByRole("button", { name: /2026년 7월/u }).click()

  const calendar = page.getByRole("grid", { name: "2026년 7월 달력" })
  await expect(calendar).toBeVisible()
  await expect(calendar.getByRole("button", { name: /2026년 7월 10일.*훈련 후 1건/u })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await calendar.getByRole("button", { name: /2026년 7월 10일.*훈련 후 1건/u }).click()
  await expect(page.getByText("달력 확인 훈련")).toBeVisible()
})
