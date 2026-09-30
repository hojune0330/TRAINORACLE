import { expect, test } from "@playwright/test"
test.beforeEach(async ({ context, page }) => {
  await page.clock.setFixedTime(new Date("2026-09-30T03:00:00Z"))
  await context.route("**/*", route => {
    const url = new URL(route.request().url())
    if (url.origin !== "http://127.0.0.1:4397") return route.abort()
    if (url.pathname === "/__catalog__") return route.fulfill({ contentType: "text/html", body: `<!doctype html>
      <meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>
      <script type="module">import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      await import('/e2e/fixtures/catalog-workout.tsx');</script>` })
    return route.continue()
  })
})
for (const width of [320, 375, 1280]) test(`catalog selection, precise targets and actual record at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 800 })
  const errors: string[] = []
  page.on("pageerror", e => errors.push(e.message))
  await page.goto("/__catalog__")
  await page.getByText("다른 훈련으로 바꾸기", { exact: true }).click()
  await page.getByRole("combobox", { name: "훈련 구성", exact: true }).selectOption("X-LT-01")
  await page.getByRole("combobox", { name: "참고 페이스에 사용할 5km 기록" }).selectOption("catalog-browser-5k")
  await expect(page.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
  await page.getByRole("checkbox", { name: /준비·회복·정리까지 최대/ }).check()
  await page.getByRole("button", { name: "이 구성으로 바꾸기" }).click()
  await expect(page.getByTestId("catalog-json")).toContainText('"catalogId":"X-LT-01"')
  await expect(page.getByTestId("catalog-json")).toContainText('"stored":true')
  await page.getByText("다른 훈련으로 바꾸기", { exact: true }).click()
  await page.getByText("구간별로 자세히 남기기", { exact: true }).click()
  await page.getByRole("textbox", { name: "1번 운동 구간 실제 거리" }).fill("1000")
  await page.getByRole("textbox", { name: "1번 운동 구간 실제 시간" }).pressSequentially("239.35")
  await page.getByRole("textbox", { name: "2번 회복 구간 실제 시간" }).fill("0")
  await page.getByRole("button", { name: "다음 구간", exact: true }).focus()
  await page.keyboard.press("Enter")
  await page.getByRole("button", { name: "앞 구간", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "1번 운동 구간 실제 시간" })).toHaveValue("239.35")
  await expect(page.getByTestId("catalog-json")).toContainText('"seconds":0')
  await page.screenshot({ path: info.outputPath(`catalog-${width}.png`), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("main h1, main p, main summary, main label, main legend, main input, main select, main span")]
    const sizes = nodes.map(el => parseFloat(getComputedStyle(el).fontSize))
    nodes.forEach((el, i) => { el.style.fontSize = `${sizes[i]! * 2}px` })
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`catalog-${width}-text200.png`), fullPage: true })
  expect(errors).toEqual([])
})
