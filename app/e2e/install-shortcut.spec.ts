import { expect, test } from "@playwright/test"
import { undersizedInteractiveTargets } from "./touch-audit"

async function openMore(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByTestId("install-shortcut-menu").click()
  await expect(page.getByTestId("install-shortcut-dialog")).toBeVisible()
}

test("shortcut is optional after a real quick save and dismissal survives reload", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await expect(page.getByTestId("install-shortcut-suggestion")).toHaveCount(0)
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await page.getByRole("button", { name: "오늘은 쉬었어요" }).click()
  await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()
  await page.getByRole("button", { name: "완료", exact: true }).click()
  await expect(page.getByTestId("install-shortcut-suggestion")).toBeVisible()
  await expect(page.getByTestId("install-shortcut-dialog")).toHaveCount(0)
  await page.getByTestId("install-shortcut-dismiss").click()
  await expect(page.getByTestId("install-shortcut-suggestion")).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId("install-shortcut-suggestion")).toHaveCount(0)
  await openMore(page)
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("install-shortcut-dialog")).not.toBeVisible()
  await expect(page.getByTestId("install-shortcut-menu")).toBeFocused()
})

test("native install capability is called only by the user's install click", async ({ page }, info) => {
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.evaluate(() => {
    const state = { calls: 0 }
    Object.assign(window, { shortcutProbe: state })
    const event = new Event("beforeinstallprompt", { cancelable: true })
    Object.assign(event, {
      prompt: async () => { state.calls += 1 },
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    })
    window.dispatchEvent(event)
  })
  const calls = () => page.evaluate(() => (window as unknown as { shortcutProbe: { calls: number } }).shortcutProbe.calls)
  expect(await calls()).toBe(0)
  await page.getByTestId("install-shortcut-menu").click()
  expect(await calls()).toBe(0)
  const dialog = page.getByTestId("install-shortcut-dialog")
  expect(await undersizedInteractiveTargets(dialog)).toEqual([])
  await page.screenshot({ path: info.outputPath("install-native-capability.png"), animations: "disabled" })
  await page.getByTestId("install-shortcut-install").click()
  await expect.poll(calls).toBe(1)
  await expect(page.getByTestId("install-shortcut-install")).toHaveCount(0)
  expect(await calls()).toBe(1)
})

test("iPhone manual instructions fit narrow enlarged text without stealing the initial visit", async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  }))
  await page.setViewportSize({ width: 320, height: 667 })
  await page.goto("/?app=1&uitest=1")
  await openMore(page)
  const dialog = page.getByTestId("install-shortcut-dialog")
  await expect(dialog).toContainText("Safari")
  await expect(dialog).toContainText("공유")
  await expect(page.getByTestId("install-shortcut-install")).toHaveCount(0)
  await dialog.evaluate(element => {
    const sizes = Array.from(element.querySelectorAll<HTMLElement>("h2,h3,p,li,button,strong,span,a"), node => ({ node, size: parseFloat(getComputedStyle(node).fontSize) }))
    for (const { node, size } of sizes) {
      node.style.fontSize = `${size * 2}px`
    }
  })
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  expect(await undersizedInteractiveTargets(dialog)).toEqual([])
  await page.screenshot({ path: info.outputPath("install-iphone-320-text-200.png"), animations: "disabled" })
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("install-shortcut-menu")).toBeFocused()
})

test("closing after installation restores focus when the suggestion disappears", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await page.getByRole("button", { name: "오늘은 쉬었어요" }).click()
  await page.getByRole("button", { name: "완료", exact: true }).click()
  await page.getByTestId("install-shortcut-suggestion").getByRole("button", { name: "추가 방법 보기" }).click()
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")))
  await expect(page.getByTestId("install-shortcut-suggestion")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(page.locator(".training-home__more")).toBeFocused()
})
