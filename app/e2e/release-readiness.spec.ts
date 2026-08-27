import { expect, test } from "@playwright/test"

const RELEASE_QA_PROJECTS = new Set(["desktop-chromium", "touch-narrow"])

test("keeps the local diary usable after the network goes offline", async ({ context, page }, testInfo) => {
  test.skip(!RELEASE_QA_PROJECTS.has(testInfo.project.name), "Release QA uses desktop and 320px")

  // Given: the static shell has been installed and controlled once online.
  await page.goto("/?app=1&uitest=1")
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()

  // When: the athlete loses the network and records a completed session.
  await context.setOffline(true)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "경기기록" }).click()
  await page.getByRole("button", { name: /훈련 후/u }).click()
  await page.getByRole("textbox", { name: "거리 (km)" }).fill("3.2")
  await page.getByRole("textbox", { name: "시간 (분)" }).fill("18")
  await page.getByRole("button", { name: "5", exact: true }).click()
  await page.getByRole("button", { name: /^저장/u }).click()

  // Then: the honest receipt and the local record survive without a server.
  await expect(page.getByRole("status")).toContainText("3.2 km")
  await expect.poll(async () => page.evaluate(() => {
    const journal = window.localStorage.getItem("trainoracle.journal.v1")
    return journal?.includes('"distanceKm":"3.2"') ?? false
  })).toBe(true)
})

test("moves through every main tab by keyboard at 320px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "touch-narrow", "Keyboard and 320px are checked together")

  // Given: the athlete starts on the narrow app surface.
  await page.goto("/?app=1&uitest=1")
  const tabs = page.getByRole("navigation", { name: "주 탭" }).getByRole("button")
  await expect(tabs).toHaveCount(5)
  await tabs.first().focus()

  // When: focus moves only with the keyboard to the Analysis tab.
  for (let index = 0; index < 4; index += 1) {
    await expect(tabs.nth(index)).toBeFocused()
    await page.keyboard.press("Tab")
  }
  await expect(tabs.nth(4)).toBeFocused()
  await page.keyboard.press("Enter")

  // Then: Analysis opens and the viewport remains intact.
  await expect(page.getByRole("heading", { name: "분석" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
