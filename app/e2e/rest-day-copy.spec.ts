import { expect, test } from "@playwright/test"

test("offers a rest-day path without pressuring the athlete to log more", async ({ page }) => {
  await page.addInitScript(() => {
    const date = new Date().toISOString().slice(0, 10)
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "legacy-rest-copy",
      kind: "post-session",
      date,
      savedAt: `${date}T00:00:00.000Z`,
      syncState: "local",
      system: "easy",
      title: "legacy entry",
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 3,
      memo: "",
    }]))
  })
  await page.goto("/?app=1")

  await expect(page.getByText(/쉰 날과 아픈 날도 기록이에요/u)).toBeVisible()
  await expect(page.getByText(/일만 더 쓰면/u)).toHaveCount(0)

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /기록/u }).click()
  await expect(page.getByRole("button", { name: /회복 · 하루 마무리.*쉬는 날도 그대로/u })).toBeVisible()

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /추이/u }).click()
  await expect(page.getByText("훈련한 날도, 쉰 날도")).toBeVisible()
  await expect(page.getByText(/서두르지 않아도 괜찮아요/u)).toBeVisible()
})
