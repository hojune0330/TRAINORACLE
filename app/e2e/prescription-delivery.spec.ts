import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"

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
    for (const slot of ["오전", "오후"]) {
      await day.getByRole("navigation", { name: "오전·오후 바로가기" }).getByRole("button", { name: slot, exact: true }).click()
      await expect(day.getByRole("group", { name: new RegExp(`^10월 26일 월요일 ${slot} 세션`) })
        .getByRole("article", { name: "훈련 메모 미리보기" })).toBeVisible()
      await expect(day.getByRole("article", { name: "훈련 메모 미리보기" })).toHaveCount(1)
    }
    await day.getByRole("navigation", { name: "오전·오후 바로가기" }).getByRole("button", { name: "오전", exact: true }).click()
    await expect(day.getByText(/기준: 체감 강도 기준/)).toHaveCount(0)
    await expect(day.getByText("통증·어지럼·자세 무너짐이 생기면 시간을 채우지 말고 중단하세요.").first()).toBeVisible()
    expect(await day.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`prescription-${width}.png`) })
    if (width === 360) {
      const source = day.getByRole("group", { name: /^10월 26일 월요일 오전 세션/ })
      await page.evaluate(() => {
        const target = window as typeof window & { memoCopy: string; memoPaint: string[] }
        target.memoCopy = ""; target.memoPaint = []
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { target.memoCopy = text } } })
        const paint = CanvasRenderingContext2D.prototype.fillText
        CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
          target.memoPaint.push(text)
          return paint.call(this, text, x, y, maxWidth)
        }
      })
      await source.getByRole("button", { name: "메모 가져가기", exact: true }).click()
      await source.getByRole("button", { name: "텍스트 복사", exact: true }).click()
      const copied = await page.evaluate(() => (window as typeof window & { memoCopy: string }).memoCopy)
      expect(copied).toContain("8분씩 2번")
      expect(copied).toContain("마지막 뒤 1분 걷기")
      expect(copied).not.toContain("기준: 체감 강도 기준")
      const download = page.waitForEvent("download")
      await source.getByRole("button", { name: "이미지 저장", exact: true }).click()
      const pngPath = testInfo.outputPath("memo-export.png")
      await (await download).saveAs(pngPath)
      const painted = await page.evaluate(() => (window as typeof window & { memoPaint: string[] }).memoPaint.join(" "))
      expect(painted).toContain("8분씩 2번")
      expect(painted).toContain("46분 20초")
      expect(painted).not.toContain("기준: 체감 강도 기준")
      const pixels = await page.evaluate(async encoded => {
        const img = new Image(); img.src = `data:image/png;base64,${encoded}`; await img.decode()
        const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height
        const ctx = canvas.getContext("2d")!; ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, img.width, img.height).data
        let ink = 0
        for (let i = 0; i < data.length; i += 4) if (data[i]! < 80 && data[i + 1]! < 80 && data[i + 2]! < 80) ink++
        return { width: img.width, ink }
      }, (await readFile(pngPath)).toString("base64"))
      expect(pixels.width).toBe(1080)
      expect(pixels.ink).toBeGreaterThan(1000)
      await page.keyboard.press("Escape")
      await expect(source.getByRole("button", { name: "메모 가져가기", exact: true })).toBeFocused()
    }
    await day.getByRole("button", { name: "이 훈련을 하는 이유", exact: true }).first().click()
    const detail = page.getByRole("dialog", { name: "크루즈 인터벌", exact: true })
    await detail.getByRole("tab", { name: "이유·근거", exact: true }).click()
    await expect(detail.getByRole("heading", { name: "목적", exact: true })).toBeVisible()
    await expect(detail.getByText("코치 계획과 비교하기 · 출시 예정")).toBeVisible()
    await expect(detail.getByRole("button", { name: /코치 계획과 비교/ })).toHaveCount(0)
    const explanation = detail.locator("summary", { hasText: "근거와 설명 버전" }).first()
    await explanation.focus()
    await page.keyboard.press("Enter")
    await expect(detail.getByRole("heading", { name: "회복", exact: true })).toBeVisible()
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
    await expect(detail.getByRole("article", { name: "훈련 메모 미리보기" })).toBeVisible()
    if (width === 320) {
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
      expect(await detail.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath("memo-320-200pct.png") })
      await page.evaluate(() => { document.documentElement.style.fontSize = "" })
    }
    expect(await detail.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.keyboard.press("Escape")
    await expect(detail).toHaveCount(0)
    await expect(day).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()
    expect(errors).toEqual([])
  })
}
