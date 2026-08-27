import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test("keeps term help inside 320px and closes it by outside tap and Escape", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "touch-narrow", "320px popover contract")
  const clampLogs: string[] = []
  page.on("console", (message) => {
    if (message.text().startsWith("[POPCLAMP]")) clampLogs.push(message.text())
  })
  await page.addInitScript(() => window.localStorage.clear())
  await page.goto("/?app=1&popover-test=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()

  const note = page.getByRole("note").first()
  await expect(note).toBeVisible()
  const box = await note.boundingBox()
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(320)
  await expect.poll(() => clampLogs.some((line) => line.includes("withinX=true"))).toBe(true)

  await page.getByRole("heading", { name: "준비할 달리기를 골라주세요" }).click()
  await expect(page.getByRole("note")).toHaveCount(0)

  await page.getByRole("button", { name: /준비 목표 설명 보기/u }).click()
  await expect(page.getByRole("note")).toHaveCount(1)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("note")).toHaveCount(0)
})
