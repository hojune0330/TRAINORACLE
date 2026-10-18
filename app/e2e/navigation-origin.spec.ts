import { expect, test } from "@playwright/test"
import { enterPlanWithoutRecord } from "./plan-flow"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === appOrigin
    ? route.continue() : route.abort())
})

test("training content returns focus to its More entry", async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "더보기", exact: true }).click()
  const opener = page.getByRole("button", { name: "훈련법 읽기", exact: true })
  await opener.click()
  await expect(page.getByRole("heading", { name: "어떤 훈련이 궁금한가요?" })).toBeVisible()
  await page.getByRole("button", { name: "이전 화면", exact: true }).click()
  await expect(opener).toBeFocused()
  await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()
  // Focus remains stable after another animation frame, not just before a late POP.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(opener).toBeFocused()
})

test("returns every audited child screen to the screen that opened it", async ({ page }) => {
  await page.goto("/?app=1")

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await enterPlanWithoutRecord(page)
  await expect(page.getByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()

  await page.getByRole("button", { name: /훈련 경험 설명 보기/u }).click()
  await page.getByRole("link", { name: "왜 이런 이름인가요?" }).click()
  await expect(page.getByRole("heading", { name: "훈련 경험" })).toBeVisible()
  await page.evaluate(() => window.history.back())
  await expect(page.getByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()

  let discardedPlanDraft = false
  page.once("dialog", async dialog => {
    expect(dialog.type()).toBe("confirm")
    expect(dialog.message()).toContain("아직 저장하지 않은 계획")
    discardedPlanDraft = true
    await dialog.accept()
  })
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈", exact: true }).click()
  expect(discardedPlanDraft).toBe(true)
  await expect(page.getByRole("heading", { name: "운동 분석과 훈련 계획", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "더보기" }).click()
  await page.getByRole("button", { name: "훈련법 읽기" }).click()
  await expect(page.getByRole("heading", { name: "어떤 훈련이 궁금한가요?" })).toBeVisible()
  await page.getByRole("button", { name: "이전 화면" }).click()
  await expect(page.getByRole("heading", { name: "더보기", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "백업·복원·휴지통" }).click()
  await page.getByRole("button", { name: "내려받은 백업 되돌리기" }).click()
  await expect(page.getByRole("heading", { name: "내려받은 백업 되돌리기" })).toBeVisible()
  await page.getByRole("button", { name: "뒤로" }).click()
  await expect(page.getByRole("heading", { name: "백업·복원·휴지통" })).toBeVisible()

  await page.getByRole("button", { name: "더보기로 돌아가기" }).click()
  await page.getByRole("button", { name: "홈으로 돌아가기" }).click()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기", exact: true }).click()
  await page.getByRole("button", { name: "운동 파일 불러오기", exact: true }).click()
  await expect(page.getByRole("heading", { name: "운동 기록 가져오기" })).toBeVisible()
  await page.getByRole("button", { name: "뒤로" }).click()
  await expect(page.getByRole("heading", { name: "무엇을 기록할까요?" })).toBeVisible()
})
