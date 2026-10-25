import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === appOrigin
    ? route.continue() : route.abort())
  await page.goto("/?app=1")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
})

test("starts a journal directly from the empty archive", async ({ page }) => {
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click()

  await expect(page.getByRole("grid")).toBeVisible()
  await page.getByRole("grid").locator('button[aria-current="date"]').click()
  await page.getByRole("button", { name: "이날 일지 쓰기", exact: true }).click()

  await expect(page.getByRole("heading", { name: "무엇을 기록할까요?" })).toBeVisible()
})

test("starts a journal directly from the empty analysis screen", async ({ page }) => {
  await page.getByRole("button", { name: "오라클", exact: true }).click()

  await expect(page.getByRole("heading", { name: "오라클", exact: true })).toBeVisible()
  await expect(page.getByRole("region", { name: "기간별 훈련 리포트" })).toHaveAttribute("data-source", "my")
  await page.getByRole("button", { name: "운동 기록 쓰기" }).click()

  await expect(page.getByRole("heading", { name: "무엇을 기록할까요?" })).toBeVisible()
})

test("keeps the empty cycle action inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("button", { name: "일지", exact: true }).click()
  await page.getByRole("radio", { name: "기록 묶음" }).click()

  await expect(page.getByRole("heading", { name: "이 주기에 기록이 없어요" })).toBeVisible()
  await expect(page.getByRole("button", { name: "오늘 기록하기" })).toBeVisible()
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 375)
})
