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

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Zero point decoration check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "맑은 날 오른쪽 위에 사용" }).click()

  await expect(page.getByTestId("journal-slot-top-corner")).toBeVisible()
  const reservedRailGeometry = await page.evaluate(() => {
    const sticker = document.querySelector<HTMLElement>('[data-testid="journal-slot-top-corner"]')
    const content = document.querySelector<HTMLElement>('[data-testid="decorated-journal-content"]')
    if (sticker === null || content === null) return null
    const stickerRect = sticker.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    return {
      stickerBottom: stickerRect.bottom,
      contentTop: contentRect.top,
      documentFits: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  expect(reservedRailGeometry).not.toBeNull()
  expect(reservedRailGeometry?.stickerBottom).toBeLessThanOrEqual(reservedRailGeometry?.contentTop ?? 0)
  expect(reservedRailGeometry?.documentFits).toBe(true)
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

test("keeps three emoji stickers in a reserved rail outside journal text", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "emoji-safe-rail-entry",
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "Emoji safe rail check",
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 4,
      memo: "긴 문장이 여러 줄로 바뀌어도 스티커가 이 글을 가리면 안 됩니다.",
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
        durationMin: { provenance: "EXPLICIT" },
        avgPace: { provenance: "EXPLICIT" },
        rpe: { provenance: "EXPLICIT" },
        memo: { provenance: "EXPLICIT" },
      },
    }]))
  })

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /Emoji safe rail check.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "불꽃 이모지 붙이기" }).click()
  await page.getByRole("button", { name: "메달 이모지 붙이기" }).click()
  await page.getByRole("button", { name: "바나나 이모지 붙이기" }).click()

  await expect(page.getByTestId("journal-slot-body-sticker-1")).toBeVisible()
  await expect(page.getByTestId("journal-slot-body-sticker-2")).toBeVisible()
  await expect(page.getByTestId("journal-slot-body-sticker-3")).toBeVisible()

  const geometry = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('[data-testid="decorated-journal-content"]')
    const rail = document.querySelector<HTMLElement>('[data-testid="journal-sticker-rail"]')
    const stickers = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="journal-slot-body-sticker-"]'))
    if (content === null || rail === null || stickers.length !== 3) return null
    const contentRect = content.getBoundingClientRect()
    const railRect = rail.getBoundingClientRect()
    return {
      contentBottom: contentRect.bottom,
      railTop: railRect.top,
      stickersInsideRail: stickers.every((sticker) => {
        const rect = sticker.getBoundingClientRect()
        return rect.top >= railRect.top && rect.bottom <= railRect.bottom
      }),
      railIgnoresPointers: getComputedStyle(rail).pointerEvents === "none",
      documentFits: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })

  expect(geometry).not.toBeNull()
  expect(geometry?.contentBottom).toBeLessThanOrEqual(geometry?.railTop ?? 0)
  expect(geometry?.stickersInsideRail).toBe(true)
  expect(geometry?.railIgnoresPointers).toBe(true)
  expect(geometry?.documentFits).toBe(true)
})
