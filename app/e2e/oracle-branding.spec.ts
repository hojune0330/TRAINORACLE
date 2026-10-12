import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

for (const width of [320, 375, 1440]) {
  test(`Oracle keeps clear actions and return navigation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 740 })
    await page.goto("/?app=1")
    const tabs = page.getByRole("navigation", { name: "주 탭" })
    await expect(tabs.getByRole("button", { name: "훈련", exact: true })).toBeVisible()
    const oracle = tabs.getByRole("button", { name: "오라클", exact: true })
    await oracle.click()
    await expect(page.getByRole("heading", { name: "오라클", exact: true })).toBeVisible()
    await expect(oracle).toHaveAttribute("aria-current", "page")
    await expect(page.getByRole("button", { name: "첫 기록 남기기" })).toBeVisible()
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width)
    await page.screenshot({ path: testInfo.outputPath(`oracle-${width}.png`) })

    await page.getByRole("region", { name: "오라클 예시" })
      .getByRole("button", { name: "이 예시 자세히 보기", exact: true }).click()
    await expect(page.getByRole("combobox", { name: "살펴볼 주제" })).toHaveValue("focus")
    const example = page.getByRole("button", { name: "예시", exact: true })
    if (await example.isVisible()) await example.click()
    await expect(page.getByText("내 기록을 분석한 결과가 아니에요", { exact: true })).toBeVisible()
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width)
    await page.screenshot({ path: testInfo.outputPath(`oracle-example-${width}.png`) })
    await page.getByRole("button", { name: "이전 화면으로 돌아가기", exact: true }).click()
    await expect(page.getByRole("heading", { name: "오라클", exact: true })).toBeVisible()
    await expect(oracle).toHaveAttribute("aria-current", "page")
  })
}
