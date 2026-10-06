import { expect, test } from "@playwright/test"
import { enterPlanWithoutRecord, openPlanOptions, refinePlan } from "./plan-flow"
import { openActiveSessionDetails } from "./active-plan-flow"

test.use({ serviceWorkers: "block" })

test("shows the seven initial plan events from 800m through marathon", async ({ page }, testInfo) => {
  // Given: a new athlete has opened the plan flow.
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  const choices = page.getByRole("combobox", { name: "종목" })
  await expect(choices).toBeVisible()
  await expect(choices.locator("option")).toHaveCount(8)
  expect(await choices.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)))
    .toEqual(["", "800", "1500", "3000", "5000", "10000", "21097", "42195"])
  await page.screenshot({
    path: testInfo.outputPath("supported-plan-events.png"),
    fullPage: true,
  })
})

test("creates a mobile marathon beta plan without inventing pace numbers", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await enterPlanWithoutRecord(page, /^마라톤/u)
  await expect(page.getByRole("button", { name: /일반부/u })).toHaveCount(0)
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /^5일/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await refinePlan(page, "훈련 종류", /편하게 오래.*BASE/u)
  await openPlanOptions(page, true)

  await expect(page.getByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
  await expect(page.getByText("마라톤").first()).toBeVisible()
  await page.getByText("계획안 A 설명·시간 합계", { exact: true }).click()
  await expect(page.getByText("RPE 기준 실행 안내").first()).toBeVisible()
  await expect(page.getByText(/@(?:10km|하프|마라톤).*RP/u)).toHaveCount(0)
  await expect.poll(() => page.locator(".app-scroll-region").evaluate(
    (element) => element.scrollWidth <= element.clientWidth,
  )).toBe(true)
  await page.getByRole("button", { name: "이 계획으로 시작하기", exact: true }).click()
  await openActiveSessionDetails(page)
  await page.getByRole("button", { name: "훈련 방법과 이유", exact: true }).first().click()
  const reader = page.getByRole("dialog")
  await reader.getByRole("tab", { name: "이유·근거" }).click()
  await expect(reader.getByRole("paragraph").filter({ hasText: /대상 종목은 42195m/u })).toBeAttached()
  await reader.getByText("사용한 기록과 출처", { exact: true }).click()
  await expect(reader.getByText("선택한 목적·경험 수준과 훈련 구성을 사용했어요. 개인 경기 기록으로 페이스를 계산하지는 않았어요.", { exact: true })).toBeVisible()
  // A catalog's time/RPE guidance is not an invented personal race-pace calculation.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1")!).activePlan)
  expect(saved.sessions.some((session: { prescription: { kind: string } }) => session.prescription.kind === "PACE_TARGET")).toBe(false)
  const catalogBindings = saved.sessions.flatMap((session: { prescription: { catalogWorkout?: { inputs: { fiveK: unknown; segmentPaces: unknown[]; paceReferences?: unknown[] } } } }) => session.prescription.catalogWorkout ? [session.prescription.catalogWorkout] : [])
  expect(catalogBindings.length).toBeGreaterThan(0)
  for (const binding of catalogBindings) {
    expect(binding.inputs.fiveK).toBeNull()
    expect(binding.inputs.segmentPaces).toEqual([])
    expect(binding.inputs.paceReferences ?? []).toEqual([])
  }
  await reader.getByRole("tab", { name: "주기·기록" }).click()
  await expect(reader.getByText(/미기록을 0이나 훈련 실패로 계산하지 않아요/u)).toBeAttached()
  await reader.getByRole("button", { name: "훈련 일정으로 돌아가기" }).click()
})
