import { expect, test } from "@playwright/test"

const SAVED_CONTENT_KEY = "trainoracle.training-content.saved.v1"

test("opens, saves, and reloads a training article without changing other product state", async ({ page }) => {
  await page.goto("/?app=1")

  await openTrainingContent(page)
  await expect(page.getByText("요즘 주목받는 훈련법", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /노르웨이식 더블 스레숄드/u }).click()
  await expect(page.getByRole("heading", { name: "노르웨이식 더블 스레숄드, 왜 자주 들릴까요?" })).toBeVisible()
  await expect(page.getByText(/추가 검토 중인 기사 · C_MEDIA/u)).toBeVisible()
  await expect(page.getByText(/저장해도 계획·안전 판단·포인트가 바뀌지 않아요/u)).toBeVisible()

  const before = await page.evaluate((contentKey) => Object.fromEntries(
    Object.entries(window.localStorage).filter(([key]) => key !== contentKey),
  ), SAVED_CONTENT_KEY)
  await page.getByRole("button", { name: "나중에 읽기" }).click()
  await expect(page.getByRole("button", { name: "저장됨" })).toHaveAttribute("aria-pressed", "true")
  await expect.poll(() => page.evaluate((contentKey) => window.localStorage.getItem(contentKey), SAVED_CONTENT_KEY))
    .toBe('["NORWEGIAN_DOUBLE_THRESHOLD"]')
  const after = await page.evaluate((contentKey) => Object.fromEntries(
    Object.entries(window.localStorage).filter(([key]) => key !== contentKey),
  ), SAVED_CONTENT_KEY)
  expect(after).toEqual(before)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.reload()
  await openTrainingContent(page)
  await page.getByRole("button", { name: /노르웨이식 더블 스레숄드/u }).click()
  await expect(page.getByRole("button", { name: "저장됨" })).toHaveAttribute("aria-pressed", "true")
})

async function openTrainingContent(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "더보기" }).click()
  await page.getByRole("button", { name: /요즘 주목받는 훈련법/u }).click()
}
