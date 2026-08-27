import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

for (const viewport of [
  { name: "mobile", width: 375, height: 667 },
  { name: "desktop", width: 1024, height: 768 },
] as const) {
  test(`loads the same interface font without overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto("/?app=1")
    await page.evaluate(() => document.fonts.ready)

    const result = await page.evaluate(() => {
      const bodyStyle = getComputedStyle(document.body)
      const loadedFace = [...document.fonts].find((face) => face.family === "Pretendard Variable")
      return {
        family: bodyStyle.fontFamily,
        fontStatus: loadedFace?.status ?? "missing",
        fontWeightSupported: document.fonts.check('650 16px "Pretendard Variable"'),
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
      }
    })

    expect(result.family).toContain("Pretendard Variable")
    expect(result.fontStatus).toBe("loaded")
    expect(result.fontWeightSupported).toBe(true)
    expect(result.documentWidth).toBe(result.viewportWidth)
  })
}
