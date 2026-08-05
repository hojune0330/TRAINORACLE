import { expect, test } from "@playwright/test"

test("keeps My Training clear and usable on narrow phones", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(viewport)
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "내 훈련" })).toBeVisible()
    await expect(page.getByText("기록이 계획으로 이어지는 훈련 일지")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()
    await expect(page.getByRole("button", { name: "오늘 기록하기" })).toBeInViewport()
    const services = page.getByRole("navigation", { name: "내 훈련 서비스" })
    for (const name of [/^내 일지/u, /^훈련 흐름/u, /^훈련계획/u, /^분석/u]) {
      await expect(services.getByRole("button", { name })).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`first-screen-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    })
  }

  await page.getByRole("button", { name: "오늘 기록하기" }).click()
  await expect(page.getByRole("heading", { name: "훈련 후 · 기록" })).toBeVisible()
  await expect(page.getByRole("button", { name: "← 뒤로" })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  // the chooser is reached via the "기록" tab bar button (§3-3)
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록" }).click()
  const heading = page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })
  await expect(heading).toBeFocused()
  await expect(page.getByRole("button", { name: /경기 직전\/직후/u })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole("button", { name: "← 뒤로" })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath("record-choice-375x667.png"), fullPage: true })
})

test("shows a truthful closed feedback screen when its release switch is off", async ({ page }) => {
  await page.goto("/?feedback=1")
  await expect(page.getByRole("heading", { name: "문의 게시판", exact: true })).toBeVisible()
  await expect(page.getByText("문의 게시판을 지금 사용할 수 없어요.")).toBeVisible()
  await expect(page.getByText(/GitHub/u)).toHaveCount(0)
})
