import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

async function resetLocalState(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.clear())
}

test("moves from a choice to the next question and gives a clear journal save confirmation", async ({ page }, testInfo) => {
  await resetLocalState(page)
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()

  const firstStep = page.locator(".plan-intake")
  await expect(firstStep).toBeVisible()
  const firstAnimation = await firstStep.evaluate((element) => getComputedStyle(element).animationName)
  expect(firstAnimation).toBe(testInfo.project.name === "reduced-motion" ? "none" : "flow-stage-enter")

  await page.getByRole("button", { name: /^1500m/u }).click()
  await expect(page.getByRole("heading", { name: "현재 참가하거나 준비 중인 부문이 있나요?" })).toBeVisible()
  const nextAnimation = await page.locator(".plan-intake").evaluate((element) => getComputedStyle(element).animationName)
  expect(nextAnimation).toBe(testInfo.project.name === "reduced-motion" ? "none" : "flow-stage-enter")

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "경기기록" }).click()
  await page.getByRole("button", { name: /훈련 후/u }).click()
  await expect(page.getByRole("heading", { name: /훈련 후/u })).toBeVisible()
  await page.getByRole("button", { name: /^저장/u }).click()

  const receipt = page.locator(".saved-toast")
  await expect(receipt).toBeVisible()
  await expect(receipt.locator(".saved-toast__check")).toHaveCount(1)
  await expect(receipt).toContainText("저장")
})

test("a high-school athlete can make a ten-day two-a-day plan without prior records", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "375px release persona")
  await resetLocalState(page)
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
  await page.getByRole("button", { name: /^1500m/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: /^매일/u }).click()
  await page.getByRole("button", { name: /^10일 계획 받기/u }).click()
  await page.getByRole("button", { name: /날마다 달라요/u }).click()
  await page.getByRole("button", { name: /하루 두 번 운동할게요/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획 후보 보기" }).click()

  await expect(page.getByRole("heading", { name: "두 계획에서 하나를 골라보세요" })).toBeVisible()
  await expect(page.getByRole("region", { name: "두 계획 핵심 비교" })).toContainText("지속 페이스 · LT")
  await expect(page.getByRole("group", { name: /훈련 2개/u }).first()).toBeVisible()
  await expect(page.getByLabel("10일 훈련 흐름").first()).toContainText(/MAIN|REC|BASE/u)
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true)
})

test("a self-directed runner with no journal can still reach an RPE plan", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "375px release persona")
  await resetLocalState(page)
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
  await page.getByRole("button", { name: /^5000m/u }).click()
  await page.getByRole("button", { name: /일반부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험이 있어요/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /기초 지구력.*BASE/u }).click()
  await page.getByRole("button", { name: /^RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await page.getByRole("button", { name: /^7일만 먼저 받기/u }).click()
  await page.getByRole("button", { name: /저녁에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획 후보 보기" }).click()

  await expect(page.getByRole("heading", { name: "두 계획에서 하나를 골라보세요" })).toBeVisible()
  await expect(page.getByText("RPE 기준 실행 안내").first()).toBeVisible()
  await expect(page.getByText("기록 없이 시작한 베타 계획")).toBeVisible()
  await expect(page.getByText(/확인한 기준 기록이 없으면 기록값과 구조화 일지는 시간·RPE 계산에 미사용/u)).toBeVisible()
})
