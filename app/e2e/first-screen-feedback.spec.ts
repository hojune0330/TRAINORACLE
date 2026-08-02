import { expect, test } from "@playwright/test"

test("keeps the journal-first decision clear on narrow phones", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(viewport)
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "오늘 기록을 시작할까요?" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "주 탭" })).toHaveCount(0)
    for (const name of ["오늘 기록 시작하기", "훈련계획 먼저 보기", "홈 먼저 둘러보기", "백업 불러오기"]) {
      await expect(page.getByRole("button", { name })).toBeInViewport()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`first-screen-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    })
  }

  await page.getByRole("button", { name: "오늘 기록 시작하기" }).click()
  const heading = page.getByRole("heading", { name: "무엇을 남길까요?" })
  await expect(heading).toBeFocused()
  await expect(page.getByRole("button", { name: /경기를 기록할래요/u })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole("button", { name: "홈 둘러보기" })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath("record-choice-375x667.png"), fullPage: true })
})

test("shows a truthful closed feedback screen when its release switch is off", async ({ page }) => {
  await page.goto("/?feedback=1")
  await expect(page.getByRole("heading", { name: "문의 게시판", exact: true })).toBeVisible()
  await expect(page.getByText("문의 게시판을 지금 사용할 수 없어요.")).toBeVisible()
  await expect(page.getByText(/GitHub/u)).toHaveCount(0)
})
