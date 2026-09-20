import { expect, test } from "@playwright/test"
import { enterPlanWithoutRecord } from "./plan-flow"

test.use({ serviceWorkers: "block" })

test("returns every audited child screen to the screen that opened it", async ({ page }) => {
  await page.goto("/?app=1")

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await enterPlanWithoutRecord(page)
  await expect(page.getByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()

  await page.getByRole("button", { name: /훈련 경험 설명 보기/u }).click()
  await page.getByRole("link", { name: "왜 이런 이름인가요?" }).click()
  await expect(page.getByRole("heading", { name: "훈련 경험" })).toBeVisible()
  await page.evaluate(() => window.history.back())
  await expect(page.getByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈", exact: true }).click()
  await page.getByRole("button", { name: "더보기" }).click()
  await page.getByRole("button", { name: "요즘 주목받는 훈련법" }).click()
  await expect(page.getByRole("heading", { name: "어떤 훈련이 궁금한가요?" })).toBeVisible()
  await page.getByRole("button", { name: "이전 화면" }).click()
  await expect(page.getByRole("heading", { name: "더보기" })).toBeVisible()

  await page.getByRole("button", { name: "내려받은 백업 되돌리기" }).click()
  await expect(page.getByRole("heading", { name: "내려받은 백업 되돌리기" })).toBeVisible()
  await page.getByRole("button", { name: "뒤로" }).click()
  await expect(page.getByRole("heading", { name: "더보기" })).toBeVisible()

  await page.getByRole("button", { name: "홈으로 돌아가기" }).click()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기", exact: true }).click()
  await page.getByRole("button", { name: /^워치 기록 불러오기/u }).click()
  await expect(page.getByRole("heading", { name: "워치 기록 불러오기" })).toBeVisible()
  await page.getByRole("button", { name: "뒤로" }).click()
  await expect(page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
})
