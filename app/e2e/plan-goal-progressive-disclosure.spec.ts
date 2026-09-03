import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test("shows the seven initial plan events from 800m through marathon", async ({ page }, testInfo) => {
  // Given: a new athlete has opened the plan flow.
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u })
    .click()
  const choices = page.getByRole("group", { name: "계획 종목 선택" })
  await expect(choices.getByRole("button")).toHaveCount(7)
  await expect(choices.getByRole("button", { name: /^800m\b/u })).toBeVisible()
  await expect(choices.getByRole("button", { name: /^1500m\b/u })).toBeVisible()
  await expect(choices.getByRole("button", { name: /^3000m\b/u })).toBeVisible()
  await expect(choices.getByRole("button", { name: /^5000m\b/u })).toBeVisible()
  await expect(choices.getByRole("button", { name: /^10km\b/u })).toBeVisible()
  await expect(choices.getByRole("button", { name: /^하프마라톤/u })).toBeVisible()
  await expect(choices.getByRole("button", { name: /^마라톤/u })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath("supported-plan-events.png"),
    fullPage: true,
  })
})

test("creates a mobile marathon beta plan without inventing pace numbers", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u })
    .click()
  await page.getByRole("button", { name: /^마라톤/u }).click()
  await expect(page.getByRole("button", { name: /일반부/u })).toHaveCount(0)
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  const continueButton = page.getByRole("button", { name: "내 계획 완성하기" })
  if (await continueButton.count() > 0) await continueButton.click()
  await page.getByRole("button", { name: /기초 지구력.*BASE/u }).click()
  await page.getByRole("button", { name: /^RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: /^5일/u }).click()
  await page.getByRole("button", { name: /^9일 계획 받기/u }).click()
  await page.getByRole("button", { name: /날마다 달라요/u }).click()
  await page.getByRole("button", { name: "하루 한 번 운동" }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()

  await expect(page.getByRole("heading", { name: "두 계획에서 하나를 골라보세요" })).toBeVisible()
  await expect(page.getByText("마라톤").first()).toBeVisible()
  await expect(page.getByText("RPE 기준 실행 안내").first()).toBeVisible()
  await expect(page.getByText(/@(?:10km|하프|마라톤).*RP/u)).toHaveCount(0)
  await expect.poll(() => page.locator(".app-scroll-region").evaluate(
    (element) => element.scrollWidth <= element.clientWidth,
  )).toBe(true)
  await page.getByRole("button", { name: "시간 조절 계획 선택하기", exact: true }).click()
  await page.getByRole("button", { name: "이 훈련을 하는 이유", exact: true }).first().click()
  const reader = page.getByRole("dialog")
  await reader.getByRole("tab", { name: "이유·근거" }).click()
  await expect(reader.getByText(/대상 종목은 42195m/u)).toBeAttached()
  await expect(reader.getByText(/개인 경기 기록으로 시간·RPE·페이스를 계산한 처방은 아니에요/u)).toBeAttached()
  await reader.getByRole("tab", { name: "주기·기록" }).click()
  await expect(reader.getByText(/미기록을 0이나 훈련 실패로 계산하지 않아요/u)).toBeAttached()
  await reader.getByRole("button", { name: "훈련 일정으로 돌아가기" }).click()
})
