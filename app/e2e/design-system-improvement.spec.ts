import { expect, test } from "@playwright/test"
import { openEntry } from "./touch-audit"

test("home navigation remains usable when the bundled font cannot load", async ({ page }) => {
  let blockedFonts = 0
  await page.route(/\.(?:woff2?|ttf)(?:\?.*)?$/u, route => {
    blockedFonts += 1
    return route.abort()
  })
  await page.goto("/?app=1&uitest=1")
  const navigation = page.getByRole("navigation", { name: "주 탭", exact: true })
  await expect(navigation).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  expect(blockedFonts).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await navigation.getByRole("button", { name: "계획", exact: true }).click()
  await expect(page.getByRole("button", { name: /^1500m/u })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("review receipt has one modal-owned copy and a keyboard reachable dismissal", async ({ page }) => {
  await openEntry(page, /경기 직전\/직후/u)
  await page.getByRole("textbox", { name: "경기 메모" }).fill("무릎이 아파")
  await page.getByRole("radio", { name: "훈련 메모" }).click()
  await page.getByRole("button", { name: /^저장/u }).click()
  await expect(page.getByRole("alert")).toBeVisible()
  await page.getByRole("button", { name: /상세 열기/u }).first().click()
  await page.getByRole("button", { name: "일지 꾸미기 열기", exact: true }).click()

  const editor = page.getByRole("dialog", { name: "이 일지 꾸미기", exact: true })
  const dismiss = editor.getByRole("button", { name: "검토 안내 닫기", exact: true })
  await expect(dismiss).toBeVisible()
  await expect(page.locator(".saved-toast")).toHaveCount(1)
  await editor.getByRole("button", { name: "꾸미기 편집기 닫기", exact: true }).focus()

  let reached = false
  for (let step = 0; step < 48; step += 1) {
    await page.keyboard.press("Tab")
    if (await dismiss.evaluate(element => document.activeElement === element)) {
      reached = true
      break
    }
    expect(await editor.evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  expect(reached, "Tab must reach the persistent review receipt dismissal inside the editor").toBe(true)
  await page.keyboard.press("Enter")
  await expect(page.locator(".saved-toast")).toHaveCount(0)
  await expect(editor).toBeVisible()
})
