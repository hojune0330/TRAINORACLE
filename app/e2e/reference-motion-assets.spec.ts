import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  await page.goto("/?app=1&uitest=1")
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
})

test("question motion is local, does not overflow, and respects the app preference", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole("button", { name: "운동 내용도 기록하기", exact: true }).click()
  const choice = page.getByRole("button", { name: "운동을 마쳤어요", exact: true })
  await expect(choice).toHaveCSS("border-radius", "16px")
  await page.screenshot({ path: info.outputPath("record-choice-375.png"), fullPage: true })
  // Freeze only this app's actual WAAPI transition near its largest displacement.
  await page.evaluate(() => {
    const animate = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args)
      if (this.classList.contains("task-flow") || this.hasAttribute("data-task-motion-surface")) { animation.pause(); animation.currentTime = 1 }
      return animation
    }
  })
  await choice.click()
  await expect.soft(page.getByRole("heading", { name: "언제 했나요?" })).toBeFocused()
  expect(await page.locator(".app-scroll-region").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await page.locator(".task-flow").evaluate(element => element.getAnimations().length)).toBe(0)
  const systemReduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)
  expect(await page.locator("[data-task-motion-surface]").evaluate(element => element.getAnimations().length)).toBe(systemReduced ? 0 : 1)
  await page.evaluate(() => {
    localStorage.setItem("trainoracle.calendar-reduced-motion.v1", "true")
    dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
  })
  await expect(page.locator(".task-flow")).toHaveAttribute("data-task-reduced-motion", "true")
  expect(await page.locator("[data-task-motion-surface]").evaluate(element => element.getAnimations().length)).toBe(0)
  await page.getByRole("button", { name: "오후", exact: true }).click()
  await page.goBack()
  await expect(page.getByRole("button", { name: "오후", exact: true })).toHaveAttribute("aria-pressed", "true")
})

test("plan entry stays focused on its question and preserves an answer on return", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
  const illustration = page.locator('img[src$="plan-notebook-v2.webp"]')
  await expect(page.getByRole("heading", { name: "어떤 종목을 준비하세요?" })).toBeVisible()
  await expect(illustration).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath("plan-entry-320.png"), fullPage: true })
  await page.getByRole("button", { name: "1500m", exact: true }).click()
  await expect(illustration).toHaveCount(0)
  await page.getByRole("button", { name: "내 기록", exact: true }).click()
  await page.getByLabel("초", { exact: true }).fill("23.4")
  await page.goBack()
  await page.getByRole("button", { name: "내 기록", exact: true }).click()
  await expect(page.getByLabel("초", { exact: true })).toHaveValue("23.4")
})

test("confirmed save keeps the next action readable beside the small object", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole("button", { name: "기록하기", exact: true }).click()
  await page.getByTestId("entry-choice-post-session").click()
  await page.getByRole("button", { name: "지금 입력 확인", exact: true }).click()
  await page.getByRole("button", { name: "거리와 시간 수정", exact: true }).click()
  await page.getByRole("textbox", { name: "거리 (km)" }).fill("3")
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
  await page.getByRole("button", { name: /^저장/ }).click()
  const result = page.locator(".journal-save-result")
  await expect(result).toBeVisible()
  const companion = result.locator('.companion-motion[data-motion="nod"]')
  const illustration = companion.locator('img.companion-motion__poster[src$="otter-idle.webp"]')
  await expect.poll(() => illustration.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(companion.locator(".companion-motion__frame")).toHaveCSS("width", "80px")
  await expect(companion.locator(".companion-motion__frame")).toHaveCSS("height", "80px")
  if (await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    await expect(companion).toHaveAttribute("data-playback", "still")
    await expect(companion.locator(".companion-motion__atlas")).toHaveCount(0)
  }
  await expect(result.getByRole("button", { name: "기록 보기", exact: true })).toHaveCSS("border-radius", "12px")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath("saved-result-375.png"), fullPage: true })
  await result.getByRole("button", { name: "닫기", exact: true }).click()
  await expect(result).toHaveCount(0)
})
