import { expect, test } from "@playwright/test"
test.beforeEach(async ({ context, page }) => {
  await page.clock.setFixedTime(new Date("2026-09-30T03:00:00Z"))
  await context.route("**/*", route => {
    const url = new URL(route.request().url())
    if (url.origin !== "http://127.0.0.1:4397") return route.abort()
    if (url.pathname === "/__repetition__") return route.fulfill({ contentType: "text/html", body: `<!doctype html>
      <meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>
      <script type="module">import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      await import('/e2e/fixtures/planned-repetition.tsx');</script>` })
    return route.continue()
  })
})
for (const width of [320, 375, 1280]) test(`explicit repetitions, decimal typing and keyboard paging at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 800 })
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto("/__repetition__")
  await page.getByText("반복별 기록 남기기", { exact: true }).click()
  await expect(page.getByLabel("1세트 1회 실제 거리", { exact: true })).toHaveValue("")
  await page.getByLabel("1세트 1회 실제 거리", { exact: true }).fill("1000")
  await page.getByLabel("1세트 1회 실제 시간", { exact: true }).pressSequentially("222.35")
  await expect(page.getByLabel("1세트 1회 실제 시간", { exact: true })).toHaveValue("222.35")
  await page.getByText("이 반복 뒤 회복 · 계획 150초", { exact: true }).first().click()
  await page.getByLabel("1세트 1회 실제 회복", { exact: true }).fill("0")
  await page.getByLabel("1세트 1회 실제 회복 방식", { exact: true }).selectOption("STAND")
  await page.getByRole("button", { name: "뒤 반복 보기" }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByLabel("1세트 4회 실제 거리", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "앞 반복 보기" }).click()
  await expect(page.getByLabel("1세트 1회 실제 시간", { exact: true })).toHaveValue("222.35")
  await expect(page.getByTestId("repetition-json")).toContainText('"seconds":222.35')
  await page.screenshot({ path: info.outputPath(`repetitions-${width}.png`), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    const elements = [...document.querySelectorAll<HTMLElement>("main h1, main h2, main p, main summary, main label, main legend, main input, main select, main span")]
    const sizes = elements.map(element => Number.parseFloat(getComputedStyle(element).fontSize))
    elements.forEach((element, index) => { element.style.fontSize = `${sizes[index] * 2}px` })
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`repetitions-${width}-text200.png`), fullPage: true })
  expect(errors).toEqual([])
})
