import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test("returns every audited child screen to the screen that opened it", async ({ page }) => {
  await page.goto("/?app=1")

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await page.getByRole("button", { name: /^1500m\b/u }).click()
  await expect(page.getByRole("heading", { name: "현재 참가하거나 준비 중인 부문이 있나요?" })).toBeVisible()

  await page.getByRole("button", { name: /현재 참가 부문 설명 보기/u }).click()
  await page.getByRole("link", { name: "왜 이런 이름인가요?" }).click()
  await expect(page.getByRole("heading", { name: "현재 참가 부문" })).toBeVisible()
  await page.evaluate(() => window.history.back())
  await expect(page.getByRole("heading", { name: "현재 참가하거나 준비 중인 부문이 있나요?" })).toBeVisible()

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈", exact: true }).click()
  await page.getByRole("button", { name: "더보기" }).click()
  await page.getByRole("button", { name: "요즘 주목받는 훈련법" }).click()
  await expect(page.getByRole("heading", { name: /유행 이름보다/u })).toBeVisible()
  await page.getByRole("button", { name: "이전 화면" }).click()
  await expect(page.getByRole("heading", { name: "더보기" })).toBeVisible()

  await page.getByRole("button", { name: "내려받은 백업 되돌리기" }).click()
  await expect(page.getByRole("heading", { name: "내려받은 백업 되돌리기" })).toBeVisible()
  await page.getByRole("button", { name: "뒤로" }).click()
  await expect(page.getByRole("heading", { name: "더보기" })).toBeVisible()

  await page.getByRole("button", { name: "홈으로 돌아가기" }).click()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "경기기록", exact: true }).click()
  await page.getByRole("button", { name: /^워치 기록 불러오기/u }).click()
  await expect(page.getByRole("heading", { name: "워치 기록 불러오기" })).toBeVisible()
  await page.getByRole("button", { name: "뒤로" }).click()
  await expect(page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
})
