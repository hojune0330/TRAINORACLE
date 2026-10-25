import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })
for (const width of [320, 360, 1280]) {
  test(`prescription to reasons and memo at ${width}px`, async ({ page, baseURL }, testInfo) => {
    const origin = new URL(baseURL!).origin
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
    await page.setViewportSize({ width, height: 800 })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.goto("/e2e/fixtures/prescription-delivery.html")
    await expect(page.getByRole("list", { name: "훈련 실행 순서" })).toHaveCount(0)
    await page.getByRole("button", { name: "10월 26일 월요일 오전 훈련 내용 보기", exact: true }).click()
    const day = page.getByRole("dialog", { name: "2026년 10월 26일 월요일", exact: true })
    await expect(day.getByText(/고르게 유지/).first()).toBeVisible()
    expect(await day.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`prescription-${width}.png`) })
    await day.getByRole("button", { name: "훈련 방법과 이유", exact: true }).first().click()
    const detail = page.getByRole("dialog", { name: "크루즈 인터벌", exact: true })
    await detail.getByRole("tab", { name: "이유·근거", exact: true }).click()
    await expect(detail.getByText("힘든 속도에서도 페이스를 고르게 유지하는 연습이에요.")).toBeVisible()
    await expect(detail.getByText("코치 계획과 비교하기 · 출시 예정")).toBeVisible()
    await expect(detail.getByRole("button", { name: /코치 계획과 비교/ })).toHaveCount(0)
    const explanation = detail.locator("summary", { hasText: "구성·회복의 이유" })
    await explanation.focus()
    await page.keyboard.press("Enter")
    await expect(detail.getByRole("heading", { name: "회복을 둔 이유" })).toBeVisible()
    await explanation.click()
    expect(await detail.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`reasons-${width}.png`) })
    if (width === 320) {
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
      expect(await detail.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath("reasons-320-200pct.png") })
      await page.evaluate(() => { document.documentElement.style.fontSize = "" })
    }
    await detail.getByRole("tab", { name: "방법", exact: true }).click()
    await detail.getByRole("button", { name: "간단히", exact: true }).click()
    await expect(detail.getByRole("article", { name: "훈련 메모 미리보기" })).toBeVisible()
    expect(await detail.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.keyboard.press("Escape")
    await expect(detail).toHaveCount(0)
    await expect(day).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()
    expect(errors).toEqual([])
  })
}
