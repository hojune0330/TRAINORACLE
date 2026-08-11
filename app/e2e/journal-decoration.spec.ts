import { expect, test } from "@playwright/test"

test("keeps a zero-point starter decoration on the real diary through refresh and undo", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await page.addInitScript(() => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "zero-point-decoration-entry",
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "Zero point decoration check",
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
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
  await page.getByRole("button", { name: /Zero point decoration check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "맑은 날 오른쪽 위에 사용" }).click()

  await expect(page.getByTestId("journal-slot-top-corner")).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    return raw?.includes('"itemId":"STICKER_WEATHER_SUN"') ?? false
  })).toBe(true)

  await page.reload()
  await page.getByRole("button", { name: /Zero point decoration check.*상세 열기/u }).click()
  await expect(page.getByTestId("journal-slot-top-corner")).toBeVisible()

  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "맑은 날 제거" }).click()

  await expect(page.getByTestId("journal-slot-top-corner")).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    return raw?.includes('"itemId":"STICKER_WEATHER_SUN"') ?? false
  })).toBe(false)

  await page.getByRole("button", { name: "꾸미기 되돌리기" }).click()
  await expect(page.getByTestId("journal-slot-top-corner")).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.decorations.v2")
    return raw?.includes('"itemId":"STICKER_WEATHER_SUN"') ?? false
  })).toBe(true)
  expect(consoleErrors).toEqual([])
})
