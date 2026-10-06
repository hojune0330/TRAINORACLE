import { expect, test } from "@playwright/test"
import { completeDetailedPlan } from "./plan-flow"

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
  // The current catalog has explicit structure; this older comparison must not
  // claim it is unspecified or reduce all differences to an envelope's time.
  await page.locator("summary", { hasText: "A와 B는 뭐가 달라요?" }).click()
  const comparison = page.getByRole("region", { name: "두 계획 핵심 비교" })
  await expect(comparison.getByText("기본 훈련 구성", { exact: true })).toBeVisible()
  await expect(comparison.getByText("기초·회복 운동을 짧게")).toBeVisible()
  await expect(comparison.getByText("기초·회복 운동은 기본 구성으로")).toBeVisible()
  await expect(comparison.getByText("기초·회복 운동은 짧은 구성으로")).toBeVisible()
  await expect(comparison).toContainText("두 계획 모두 주요 훈련 목적은 ‘조금 힘들게 꾸준히 · LT’")
  await expect(comparison).toContainText("카탈로그 상세 구성은 이 비교에서 공통 여부를 확인할 수 없어요.")
  await expect(comparison).not.toContainText("같은 횟수와 RPE로")
  await expect(comparison).not.toContainText("구체적인 반복과 회복 방법이 정해진 것은 아니에요.")
  await expect(comparison).not.toContainText("쉬운 훈련 시간만 달라요")
  await expect(comparison).not.toContainText("보조훈련")
  await expect(comparison).not.toContainText("보조 훈련")
  await comparison.locator("summary", { hasText: "본운동 방법 비교" }).click()
  await expect(comparison).not.toContainText("반복 거리·운동 구간·횟수 미지정")
  await expect(comparison).not.toContainText("반복·세트 사이 회복 시간 미지정")
  await expect(comparison.getByText("각 일정의 ‘훈련 방법과 이유’에서 상세 구성을 확인해 주세요.")).toHaveCount(2)
  await comparison.screenshot({ path: testInfo.outputPath("candidate-comparison.png") })
  // The shared summary is withheld when comparison is unsupported, so verify the
  // original one-LT-day assertion independently on both actual candidate cards.
  for (const letter of ["A", "B"]) {
    const details = page.locator(".plan-candidate-explanation").filter({ has: page.locator("summary", { hasText: `계획안 ${letter} 설명·시간 합계` }) })
    await details.locator("summary").click()
    await expect(details.getByText(/조금 힘들게 꾸준히 · LT 1일/u)).toHaveCount(1)
  }
  expect(
    await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth),
  ).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("candidate-purpose-320.png"), fullPage: true })
})
