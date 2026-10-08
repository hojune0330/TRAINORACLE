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
  await page.getByRole("button", { name: "일지", exact: true }).click()

  await expect(page.getByRole("heading", { name: "첫 일지를 남겨보세요" })).toBeVisible()
  await expect(page.getByText("예시 · 내 기록에 저장되지 않아요", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "내 첫 기록 남기기", exact: true }).click()

  await expect(page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
})

test("starts a journal directly from the empty analysis screen", async ({ page }) => {
  await page.getByRole("button", { name: "오라클", exact: true }).click()

  await expect(page.getByRole("heading", { name: "오라클", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "첫 운동부터 남겨볼까요?" })).toBeVisible()
  await expect(page.getByText("남긴 운동으로 훈련량과 변화를 살펴봐요.", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "첫 기록 남기기" }).click()

  await expect(page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
})

test("keeps the empty cycle action inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("button", { name: "일지", exact: true }).click()
  await page.getByRole("button", { name: "기록 묶음" }).click()

  await expect(page.getByRole("heading", { name: "이 주기에 기록이 없어요" })).toBeVisible()
  await expect(page.getByRole("button", { name: "오늘 기록하기" })).toBeVisible()
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 375)
})
