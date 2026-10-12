import { expect, test } from "@playwright/test"

test("keeps race task actions visible and saves only corrected pace on mobile", async ({ page }, testInfo) => {
  // Given
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기" }).click()
  await page.getByRole("button", { name: /경기 기록.*경기 전후 기록·컨디션/u }).click()
  const paceMinutes = page.getByRole("spinbutton", { name: "목표 페이스 분" })
  const paceSeconds = page.getByRole("spinbutton", { name: "목표 페이스 초" })
  await paceMinutes.fill("3")
  await paceSeconds.fill("60")
  await paceMinutes.focus()
  await expect.poll(() => paceMinutes.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none")

  // When
  const saveButton = page.getByRole("button", { name: /^저장/u })
  const reviewButton = page.getByRole("button", { name: "지금 입력 확인", exact: true })
  const bottomNavigation = page.getByRole("navigation", { name: "주 탭" })
  await expectActionClearOfNavigation(reviewButton, bottomNavigation)

  await page.getByRole("button", { name: "경기 직후" }).click()
  await expectActionClearOfNavigation(reviewButton, bottomNavigation)
  await page.getByRole("button", { name: "경기 직전" }).click()

  await reviewButton.click()
  await expectActionClearOfNavigation(saveButton, bottomNavigation)
  await saveButton.click()
  await expect(page.getByRole("alert")).toContainText("0부터 59")
  await expect(paceMinutes).toHaveValue("3")
  await expect(paceSeconds).toHaveValue("60")
  await expect(saveButton).toHaveCount(0)
  await expectActionClearOfNavigation(reviewButton, bottomNavigation)
  await page.screenshot({ path: testInfo.outputPath("invalid-pace-input-preserved.png") })

  await paceSeconds.fill("59")
  await reviewButton.click()
  await expectActionClearOfNavigation(saveButton, bottomNavigation)
  await saveButton.click()
  await expect(page.getByRole("region", { name: "오늘 기록을 남겼어요.", exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const entries = JSON.parse(localStorage.getItem("trainoracle.journal.v1") ?? "[]") as { kind: string; goalPace?: { secondsPerKm: number } }[]
    return entries.filter(entry => entry.kind === "race").map(entry => entry.goalPace?.secondsPerKm)
  })).toEqual([239])
  await page.screenshot({ path: testInfo.outputPath("corrected-pace-saved.png") })
})

async function expectActionClearOfNavigation(
  action: import("@playwright/test").Locator,
  bottomNavigation: import("@playwright/test").Locator,
): Promise<void> {
  await action.scrollIntoViewIfNeeded()
  await expect(action).toBeVisible()
  await expect(action).toBeEnabled()
  await expect(action).toHaveCSS("opacity", "1")
  await expect(action).toHaveCSS("pointer-events", "auto")
  const actionBox = await action.boundingBox()
  expect(actionBox).not.toBeNull()
  if (actionBox === null) return
  expect(actionBox.width).toBeGreaterThanOrEqual(44)
  expect(actionBox.height).toBeGreaterThanOrEqual(44)
  // Task entry screens reserve the viewport for the form and hide the tab bar.
  await expect(bottomNavigation).toHaveCount(0)
  const viewport = await action.page().evaluate(() => ({ width: innerWidth, height: innerHeight }))
  expect(actionBox.x).toBeGreaterThanOrEqual(0)
  expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(viewport.width)
  expect(actionBox.y).toBeGreaterThanOrEqual(0)
  expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(viewport.height)
  expect(await action.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2))
  })).toBe(true)
}
