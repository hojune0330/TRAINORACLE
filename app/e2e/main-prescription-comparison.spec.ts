import { expect, test } from "@playwright/test"
import { selectNineDayProjection } from "./plan-flow"

test.use({ serviceWorkers: "block" })

test("compares actual MAIN values and refreshes the chosen record without claiming two methods", async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 375, height: 667 })
  await page.clock.setFixedTime(new Date("2026-09-02T03:00:00.000Z"))
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify([122, 123.5].map((seconds, index) => ({
      schemaVersion: 1, id: `00000000-0000-4000-8000-00000000000${index}`, purpose: "RECENT_RESULT",
      eventDistanceM: 800, performanceSeconds: seconds, achievedOn: `2026-08-1${index}`, seasonId: null,
      enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", sourceRef: `athlete-record:00000000-0000-4000-8000-00000000000${index}`,
      savedAt: `2026-08-1${index}T12:00:00.000Z`,
    }))))
  })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
  await page.getByRole("button", { name: /^800m/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /구조화된 훈련과 경기 경험이 많아요/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /짧은 고강도 반복.*GLY/u }).click()
  await page.getByRole("button", { name: /800m 경기 페이스 상세 훈련 포함/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /아침에 운동해요/u }).click()
  await page.getByRole("button", { name: /하루 한 번 운동/u }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()
  const comparison = page.getByRole("region", { name: "두 계획 핵심 비교" })
  const summary = comparison.locator("summary").filter({ hasText: "본운동 방법 비교" })
  await expect(comparison.locator(".plan-main-comparison")).not.toHaveAttribute("open")
  await summary.focus()
  await summary.press("Enter")
  await expect(comparison.locator(".plan-main-comparison")).toHaveAttribute("open")
  await expect(comparison.getByText("반복 거리·운동 구간·횟수 미지정").first()).toBeVisible()
  const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await picker.getByRole("button", { name: /2분 2초/u }).click()
  await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await expect(comparison.getByText("800m 기록 기준 · 200m마다 목표 30.5초")).toBeVisible()
  await expect(comparison.getByText("1세트 × (10회 × 200m) · 총 10회")).toHaveCount(1)
  await expect(comparison.getByText(/반복 사이 60초 서서 쉬기 · 총 9번/u)).toHaveCount(1)
  await expect(comparison.getByText("본운동 방법과 목표값이 같아요. 다른 방법 두 개가 아니에요.")).toBeVisible()
  await expect(comparison.locator(".plan-candidate-comparison__intro")).not.toContainText("같은 횟수와 RPE로")
  await picker.getByRole("group", { name: "기준 기록 선택" }).getByRole("button", { name: /2분 3.5초/u }).click()
  await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await expect(comparison.getByText("800m 기록 기준 · 200m마다 목표 30.875초")).toBeVisible()
  await expect(comparison.getByText("800m 기록 기준 · 200m마다 목표 30.5초")).toHaveCount(0)
  const normalFont = await summary.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  expect(await summary.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(normalFont * 1.9)
  await expect.poll(() => comparison.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await summary.evaluate((node) => node.scrollIntoView({ behavior: "instant", block: "start" }))
  await page.screenshot({ path: testInfo.outputPath("main-comparison-200pct.png") })
  await summary.press("Enter")
  await expect(comparison.locator(".plan-main-comparison")).not.toHaveAttribute("open")
  expect(errors).toEqual([])
})
