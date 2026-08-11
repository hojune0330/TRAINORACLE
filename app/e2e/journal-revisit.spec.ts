import { expect, test } from "@playwright/test"

const DATE = "2026-07-20"
const ENTRY_ID = "past-revisit"

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
  await expect.poll(() => page.locator(".app-scroll-region").evaluate((element) => element.scrollTop)).toBe(0)

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
