import { expect, test, type Page } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page, baseURL }, testInfo) => {
  test.skip(!["desktop-chromium", "touch-narrow"].includes(testInfo.project.name), "desktop and 320px navigation boundary only")
  const origin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  // Browser-context-only synthetic records; never the user's browser or account.
  await page.addInitScript(() => {
    const now = new Date()
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-")
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify(Array.from({ length: 8 }, (_, index) => ({
      id: `navigation-synthetic-${index}`, kind: "post-session", date,
      savedAt: `${date}T${String(index + 8).padStart(2, "0")}:00:00.000Z`, syncState: "local", system: "base",
      title: `Navigation synthetic record ${index}`, distanceKm: "5", durationMin: "30", avgPace: "6:00", rpe: 4, memo: "",
      fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" }, avgPace: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" } },
    }))))
  })
})

async function openReader(page: Page): Promise<void> {
  await page.goto("/?app=1")
  await page.getByRole("button", { name: "오늘 기록 보기", exact: true }).click()
  await expect(page.locator(".journal-day-reader")).toBeVisible()
}

async function storedJournal(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("trainoracle.journal.v1"))
}

test("native Back and Escape close decoration layers in order without applying text or replaying on Forward", async ({ page }) => {
  await openReader(page)
  const original = await storedJournal(page)
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  const editor = page.getByRole("dialog", { name: "일지 꾸미기", exact: true })
  await expect(editor).toBeVisible()
  const originalDecoration = await page.evaluate(() => localStorage.getItem("trainoracle.decorations.v3"))
  await editor.getByRole("button", { name: "꾸미기 재료 도구" }).click()
  const drawer = editor.locator(".journal-decoration-toolbar")
  await expect(drawer).toHaveAttribute("data-open", "true")
  await page.goBack()
  await expect(drawer).toHaveAttribute("data-open", "false")
  await expect(editor).toBeVisible()
  await editor.getByRole("button", { name: "글 스티커 도구" }).click()
  await page.getByTestId("journal-text-sticker-input").fill("synthetic unsaved text")
  await page.goBack()
  await expect(page.getByTestId("journal-text-sticker-sheet")).toHaveCount(0)
  await expect(editor).toBeVisible()
  await editor.getByRole("button", { name: "글 스티커 도구" }).click()
  await page.getByTestId("journal-text-sticker-input").fill("synthetic unsaved text")
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("journal-text-sticker-sheet")).toHaveCount(0)
  await expect(editor).toBeVisible()
  await page.goBack()
  await expect(editor).toHaveCount(0)
  await page.goForward()
  await expect(editor).toHaveCount(0)
  expect(await storedJournal(page)).toBe(original)
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.decorations.v3"))).toBe(originalDecoration)
})

test("confirmation Back, quick Forward/Back and Escape never delete or close the underlying reader", async ({ page }) => {
  await openReader(page)
  const original = await storedJournal(page)
  await page.getByRole("button", { name: /Navigation synthetic record 7/u }).click()
  const deleteButton = page.getByRole("button", { name: "이 일지 지우기" }).last()
  await deleteButton.click()
  await expect(page.getByTestId("journal-delete-dialog")).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId("journal-delete-dialog")).toHaveCount(0)
  await expect(page.locator(".journal-day-reader")).toBeVisible()
  await page.goForward()
  await expect(page.getByTestId("journal-delete-dialog")).toHaveCount(0)
  await page.goBack()
  await expect(page.locator(".journal-day-reader")).toBeVisible()
  await deleteButton.click()
  await expect(page.getByTestId("journal-delete-dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("journal-delete-dialog")).toHaveCount(0)
  await expect(deleteButton).toBeFocused()
  expect(await storedJournal(page)).toBe(original)
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.journal.trash.v1"))).toBeNull()
})

test("native POP restores a nonzero reader scroll and keeps it after delayed alignment would have fired", async ({ page }) => {
  await openReader(page)
  const original = await storedJournal(page)
  await page.getByRole("button", { name: /Navigation synthetic record 7/u }).click()
  await page.getByRole("button", { name: "운동 자각도 RPE 설명 보기" }).last().click()
  const more = page.getByRole("link", { name: "왜 이런 이름인가요?" })
  await more.scrollIntoViewIfNeeded()
  const region = page.locator("main.app-scroll-region")
  const before = await region.evaluate(node => node.scrollTop)
  expect(before).toBeGreaterThan(20)
  await more.click()
  await expect(page.getByRole("heading", { name: "운동 자각도RPE", exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.locator(".journal-day-reader")).toBeVisible()
  await expect.poll(async () => Math.abs(await region.evaluate(node => node.scrollTop) - before)).toBeLessThanOrEqual(2)
  // Covers the former 220ms child re-alignment plus the shell's return RAF.
  await page.waitForTimeout(330)
  expect(Math.abs(await region.evaluate(node => node.scrollTop) - before)).toBeLessThanOrEqual(2)
  expect(await storedJournal(page)).toBe(original)
})
