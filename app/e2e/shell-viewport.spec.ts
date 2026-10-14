import { expect, test, type Page } from "@playwright/test"

test.use({ serviceWorkers: "block" })
test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
})

async function expectFrameAligned(page: Page, tabs = true) {
  await expect.poll(() => page.evaluate(expectTabs => {
    const shell = document.querySelector(".app-shell")!
    const bounds = shell.getBoundingClientRect()
    const main = document.querySelector(".app-scroll-region")!
    const nav = document.querySelector(".app-tab-bar")?.getBoundingClientRect()
    return Math.abs(bounds.top) < 1 && Math.abs(bounds.bottom - innerHeight) < 1
      && bounds.left >= 0 && bounds.right <= innerWidth + 1
      && scrollY === 0 && scrollX === 0
      && main.scrollWidth <= main.clientWidth + 1
      && (!expectTabs || (nav !== undefined && Math.abs(nav.bottom - innerHeight) < 1
        && Math.abs(main.getBoundingClientRect().bottom - nav.top) < 1))
  }, tabs), { message: "shell stays inside the viewport with no gap below tabs or horizontal overflow" }).toBe(true)
}

test("all five tab entries keep the frame anchored while only their content scrolls", async ({ page }, testInfo) => {
  await page.goto("/?app=1&uitest=1")
  const nav = page.getByRole("navigation", { name: "주 탭" })
  await expect(nav).toBeVisible()
  for (const name of ["홈", "일지", "기록하기", "훈련", "오라클"]) {
    await nav.getByRole("button", { name, exact: true }).click()
    await expect(page.locator(".app-scroll-region .app-loading-state")).toHaveCount(0)
    await expect(page.locator(".app-scroll-region").getByRole("heading").first()).toBeVisible()
    await expectFrameAligned(page)
    // Model the old large-layout-vh root without depending on browser toolbars.
    // Each fresh context is synthetic and contains no user/account records.
    const style = await page.addStyleTag({ content: "#root { min-height: calc(100dvh + 240px); }" })
    await page.evaluate(() => window.scrollTo(0, 240))
    await expectFrameAligned(page)
    await style.evaluate(el => { el.parentNode?.removeChild(el) })
    await page.screenshot({ path: testInfo.outputPath(`tab-${name}.png`), animations: "disabled" })
    await page.locator(".app-scroll-region").evaluate(el => {
      const end = document.createElement("button")
      end.dataset.viewportEnd = "true"
      end.textContent = "합성 본문 마지막 동작"
      end.style.cssText = "display:block;margin-top:1200px;min-height:44px"
      el.append(end)
      el.scrollTop = el.scrollHeight
    })
    const end = page.locator("[data-viewport-end]")
    await end.click() // verifies the bottom action is not covered by the tab bar
    await expectFrameAligned(page)
    await end.evaluate(el => el.remove())
  }
})

test("short viewport, rotation and a body dialog preserve the frame and exit navigation", async ({ page }, testInfo) => {
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기", exact: true }).click()
  await page.getByTestId("entry-choice-evening").click()
  await page.getByRole("button", { name: "몸 상태", exact: true }).click()
  await page.getByRole("button", { name: "기타 부위 추가", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("textbox", { name: "부위 이름", exact: true }).fill("합성 부위")
  // Resizing is not a claim of a real iOS keyboard test.
  for (const viewport of [{ width: 375, height: 440 }, { width: 812, height: 375 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport)
    await expectFrameAligned(page, false)
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath("body-dialog-narrow.png"), animations: "disabled" })
  await dialog.getByRole("button", { name: "몸 상태 입력 닫기", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole("button", { name: "나가기", exact: true }).click()
  const discard = page.getByRole("button", { name: "저장 없이 나가기", exact: true })
  if (await discard.isVisible()) await discard.click()
  await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()
  await expectFrameAligned(page)
})

test("standalone documents retain their own page scrolling", async ({ page }) => {
  await page.goto("/?terms=1")
  await expect(page.getByRole("heading").first()).toBeVisible()
  await expect(page.locator(".app-shell")).toHaveCount(0)
  const heights = await page.evaluate(() => {
    const end = document.createElement("div")
    end.style.height = "200vh"
    document.querySelector("#root")!.append(end)
    window.scrollTo(0, 150)
    return { scrollY, overflow: getComputedStyle(document.documentElement).overflow }
  })
  expect(heights.scrollY).toBeGreaterThan(0)
  expect(heights.overflow).not.toBe("hidden")
})
