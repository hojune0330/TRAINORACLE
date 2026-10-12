import { expect, test } from "@playwright/test"
import { completeDetailedPlan, openPlanOptions } from "./plan-flow"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === appOrigin
    ? route.continue() : route.abort())
})

test("explains the easy-session time difference while keeping the selected purpose identical", async ({ page }, testInfo) => {
  // Given: a mobile athlete starts a new LT-focused plan.
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await completeDetailedPlan(page, { division: /고등부/u, time: /아침에 운동해요/u })

  // Then: both choices preserve the selected purpose and their support choices.
  // Compare the actual easy-session duration, then verify both choices retain
  // the athlete's selected purpose without claiming equal training effects.
  await page.getByRole("group", { name: "계획 확인·변경" })
    .getByRole("button", { name: "추천 근거", exact: true }).click()
  const comparison = page.getByRole("region", { name: "두 계획 핵심 비교" })
  const options = comparison.getByRole("article")
  await expect(options).toHaveCount(2)
  await expect(options.first().getByRole("region", { name: "기초·회복 운동 시간" })).toContainText("1회45분")
  await expect(options.last().getByRole("region", { name: "기초·회복 운동 시간" })).toContainText("1회30분")
  await expect(comparison).toContainText("운동 시간부터 비교해 보세요")
  await expect(comparison).toContainText("시간이 같아도 운동 방법과 강도는 다를 수 있어요.")
  await comparison.locator("summary", { hasText: "본운동 방법 비교" }).click()
  await expect(comparison).not.toContainText("반복 거리·운동 구간·횟수 미지정")
  await expect(comparison).not.toContainText("반복·세트 사이 회복 시간 미지정")
  await expect(comparison.getByText("각 일정의 ‘훈련 방법과 이유’에서 상세 구성을 확인해 주세요.")).toHaveCount(2)
  await comparison.screenshot({ path: testInfo.outputPath("candidate-comparison.png") })
  // The comparison does not establish equal effects; inspect each plan's
  // stated purpose independently.
  await openPlanOptions(page)
  for (const letter of ["A", "B"]) {
    const details = page.locator(".plan-candidate-explanation").filter({ has: page.locator("summary", { hasText: `계획안 ${letter} 세부 정보` }) })
    await details.locator("summary").click()
    await expect(details.getByText("훈련 목표 · 지속 페이스 훈련", { exact: true })).toBeVisible()
  }
  expect(
    await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth),
  ).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("candidate-purpose-320.png"), fullPage: true })
})
