import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

const DATE = "2026-07-20"
const ENTRY_ID = "past-revisit"

async function expectJournalContentAtReadingPosition(page: import("@playwright/test").Page) {
  await expect.poll(() => page.getByTestId("decorated-journal-content").evaluate((element) => {
    const scrollRegion = element.closest<HTMLElement>(".app-scroll-region")
    if (scrollRegion === null) return false

    const targetRect = element.getBoundingClientRect()
    const regionRect = scrollRegion.getBoundingClientRect()
    const scrollMargin = Number.parseFloat(window.getComputedStyle(element).scrollMarginTop) || 0
    const aligned = Math.abs(targetRect.top - regionRect.top - scrollMargin) <= 4
    const cannotScrollFurther = scrollRegion.scrollTop >= scrollRegion.scrollHeight - scrollRegion.clientHeight - 2
    const readableWithoutMoreScrolling = targetRect.top >= regionRect.top
      && targetRect.top <= window.innerHeight * 0.35

    return aligned || (cannotScrollFurther && readableWithoutMoreScrolling)
  })).toBe(true)
}

test("revisits a past journal without duplicating it and adds a same-date check-in", async ({ page }) => {
  // Given
  await page.goto("/?app=1")
  await page.evaluate(({ date, entryId }) => {
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: entryId,
      kind: "post-session",
      date,
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "Past revisit session",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    }]))
  }, { date: DATE, entryId: ENTRY_ID })
  await page.reload()
  const detailButton = page.getByRole("button", { name: /Past revisit session.*상세 열기/u })
  await expect(detailButton).toBeVisible()
  await page.locator(".app-scroll-region").evaluate((element) => {
    element.scrollTop = 160
  })

  // When
  await detailButton.click()

  // Then
  await expectJournalContentAtReadingPosition(page)

  // When
  await page.getByTestId(`journal-edit-${ENTRY_ID}`).click()

  // Then
  await expect(page.getByLabel("세션 제목")).toHaveValue("Past revisit session")
  await expect(page.getByLabel("거리 (km)")).toHaveValue("5")

  // When
  await page.getByLabel("거리 (km)").fill("6")
  await page.getByRole("button", { name: /수정 저장/u }).click()

  // Then
  const afterEdit = await page.evaluate(({ date, entryId }) => {
    const raw = window.localStorage.getItem("trainoracle.journal.v1") ?? "[]"
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry) => typeof entry === "object" && entry !== null
      && "date" in entry && "id" in entry && entry.date === date && entry.id === entryId)
  }, { date: DATE, entryId: ENTRY_ID })
  expect(afterEdit).toHaveLength(1)
  expect(afterEdit[0]).toMatchObject({ distanceKm: "6" })

  // When
  await page.getByTestId("journal-add-entry").click()
  await page.getByTestId("entry-choice-evening").click()
  await page.getByRole("button", { name: /^저장/u }).click()

  // Then
  const sameDateEntries = await page.evaluate((date) => {
    const raw = window.localStorage.getItem("trainoracle.journal.v1") ?? "[]"
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry) => typeof entry === "object" && entry !== null && "date" in entry && entry.date === date)
  }, DATE)
  expect(sameDateEntries).toHaveLength(2)
  await expect(page.getByText("Past revisit session")).toBeVisible()
  await expect(page.getByRole("button", { name: "훈련 기록 수정" })).toBeVisible()
  await expect(page.getByRole("button", { name: "하루 마무리 수정" })).toBeVisible()
})

test("swipes between real diary dates and returns the selected page to its content top", async ({ page }) => {
  await page.addInitScript(() => {
    const entry = (id: string, date: string, title: string) => ({
      id,
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title,
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 4,
      memo: "",
    })
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
      entry("swipe-older", "2026-07-20", "스와이프 이전 일지"),
      entry("swipe-newer", "2026-07-22", "스와이프 현재 일지"),
    ]))
  })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: /스와이프 현재 일지.*상세 열기/u }).click()
  await expect(page.getByText("스와이프 현재 일지")).toBeVisible()

  await page.locator(".journal-day-reader").evaluate((element) => {
    const start = new Touch({ identifier: 1, target: element, clientX: 90, clientY: 260 })
    const move = new Touch({ identifier: 1, target: element, clientX: 175, clientY: 262 })
    const end = new Touch({ identifier: 1, target: element, clientX: 255, clientY: 263 })
    element.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [start], changedTouches: [start] }))
    element.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [move], changedTouches: [move] }))
    element.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [end] }))
  })

  await expect(page.getByText("스와이프 이전 일지")).toBeVisible()
  await expect(page.getByText("1 / 2")).toBeVisible()
  await expectJournalContentAtReadingPosition(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("shows each legacy duplicate journal item without a rendering warning", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await page.addInitScript(() => {
    const first = {
      id: "duplicate-revisit-entry",
      kind: "post-session",
      date: "2026-07-20",
      savedAt: "2026-07-20T09:00:00.000Z",
      syncState: "local",
      system: "base",
      title: "First legacy duplicate",
      distanceKm: "5",
      durationMin: "25",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
    }
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
      first,
      { ...first, savedAt: "2026-07-20T18:00:00.000Z", title: "Second legacy duplicate" },
    ]))
  })

  await page.goto("/?app=1")

  await expect(page.getByText("First legacy duplicate")).toBeVisible()
  await expect(page.getByText("Second legacy duplicate")).toBeVisible()
  expect(consoleErrors).toEqual([])
})
