import { expect, test } from "@playwright/test"
import { undersizedInteractiveTargets } from "./touch-audit"

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
})

async function openStorage(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await page.getByRole("button", { name: /^(?:계정·)?기록 보관$/u }).click()
}

async function openMore(page: import("@playwright/test").Page) {
  await openStorage(page)
  await page.getByTestId("install-shortcut-menu").click()
  await expect(page.getByTestId("install-shortcut-dialog")).toBeVisible()
}

test("shortcut stays optional after a real quick save and hiding its More entry survives reload", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await expect(page.getByTestId("install-shortcut-suggestion")).toHaveCount(0)
  await page.getByRole("button", { name: "운동 내용도 기록하기" }).click()
  await page.getByRole("button", { name: "오늘은 쉬었어요" }).click()
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()
  await page.getByRole("button", { name: "완료", exact: true }).click()
  await expect(page.getByTestId("install-shortcut-suggestion")).toHaveCount(0)
  await expect(page.getByTestId("install-shortcut-dialog")).toHaveCount(0)
  await openMore(page)
  await page.getByRole("button", { name: "이미 추가했어요", exact: true }).click()
  await expect(page.getByTestId("install-shortcut-dialog")).toHaveCount(0)
  await expect(page.getByTestId("install-shortcut-menu")).toHaveCount(0)
  await expect(page.getByTestId("install-shortcut-restore")).toBeVisible()
  await expect(page.getByRole("button", { name: "더보기로 돌아가기", exact: true })).toBeFocused()
  await page.reload()
  await expect(page.getByTestId("install-shortcut-suggestion")).toHaveCount(0)
  await openStorage(page)
  await expect(page.getByTestId("install-shortcut-dialog")).toHaveCount(0)
  await expect(page.getByTestId("install-shortcut-menu")).toHaveCount(0)
  await page.getByTestId("install-shortcut-restore").click()
  await expect(page.getByTestId("install-shortcut-dialog")).toHaveCount(0)
  await page.getByTestId("install-shortcut-menu").click()
  await expect(page.getByTestId("install-shortcut-dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("install-shortcut-dialog")).not.toBeVisible()
  await expect(page.getByTestId("install-shortcut-menu")).toBeFocused()
})

test("native install capability is called only by the user's install click", async ({ page }, info) => {
  await page.goto("/?app=1&uitest=1")
  await openStorage(page)
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
  await expect(dialog).toBeVisible()
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

test("closing after installation restores focus when the More install entry disappears", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "운동 내용도 기록하기" }).click()
  await page.getByRole("button", { name: "오늘은 쉬었어요" }).click()
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await page.getByRole("button", { name: "완료", exact: true }).click()
  await expect(page.getByTestId("install-shortcut-suggestion")).toHaveCount(0)
  await openMore(page)
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")))
  await expect(page.getByTestId("install-shortcut-menu")).toHaveCount(0)
  await expect(page.getByTestId("install-shortcut-dialog")).toContainText("바로가기 아이콘을 이미 사용 중이에요")
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("install-shortcut-dialog")).not.toBeVisible()
  await expect(page.getByRole("button", { name: "더보기로 돌아가기", exact: true })).toBeFocused()
})
