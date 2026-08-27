import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page }) => {
  await page.goto("/?app=1")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
})

test("starts a journal directly from the empty archive", async ({ page }) => {
  await page.getByRole("button", { name: "일지", exact: true }).click()

  await expect(page.getByRole("heading", { name: "첫 일지를 남겨보세요" })).toBeVisible()
  await page.getByRole("button", { name: "오늘 기록하기" }).click()

  await expect(page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
})

test("starts a journal directly from the empty analysis screen", async ({ page }) => {
  await page.getByRole("button", { name: "분석", exact: true }).click()

  await expect(page.getByRole("heading", { name: "분석" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "기록이 쌓이면 변화가 보여요" })).toBeVisible()
  await page.getByRole("button", { name: "첫 기록 남기기" }).click()

  await expect(page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
})

test("keeps the empty cycle action inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("button", { name: "일지", exact: true }).click()
  await page.getByRole("button", { name: "9.5일 주기" }).click()

  await expect(page.getByRole("heading", { name: "이 주기에 기록이 없어요" })).toBeVisible()
  await expect(page.getByRole("button", { name: "오늘 기록하기" })).toBeVisible()
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 375)
})
