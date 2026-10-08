import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  await page.goto("/?app=1&uitest=1")
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
})

test("desktop results expand without changing diary width or navigation", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const shell = page.locator(".app-shell")
  const originalWidth = (await shell.boundingBox())!.width
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "오라클", exact: true }).click()
  await expect(page.getByRole("heading", { name: "내 훈련 살펴보기" })).toBeVisible()
  expect((await shell.boundingBox())!.width).toBeGreaterThan(originalWidth)
  await page.screenshot({ path: info.outputPath("analysis-desktop.png"), fullPage: true })
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click()
  expect((await shell.boundingBox())!.width).toBe(originalWidth)
  await expect(shell).not.toHaveClass(/app-shell--results/)
})

test("More exposes named destinations and app reduced motion reaches common controls", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  await expect(page.getByRole("button", { name: "러닝 취향", exact: true })).toBeVisible()
  const learn = page.getByRole("button", { name: "훈련법 읽기", exact: true })
  await learn.scrollIntoViewIfNeeded()
  await expect(learn).toBeVisible()
  expect((await learn.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const decorate = page.getByRole("button", { name: "일지 꾸미기·포인트", exact: true })
  await decorate.scrollIntoViewIfNeeded()
  await expect(decorate).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.evaluate(() => {
    localStorage.setItem("trainoracle.calendar-reduced-motion.v1", "true")
    window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
  })
  await expect(page.locator(".app-shell")).toHaveAttribute("data-reduced-motion", "true")
  await decorate.hover()
  await page.mouse.down()
  await expect(decorate).toHaveCSS("transform", "none")
  // Release outside the button: inspect press feedback without opening an editor.
  await page.mouse.move(0, 0)
  await page.mouse.up()
  await page.screenshot({ path: info.outputPath("more-direct-320.png"), fullPage: true })
})
