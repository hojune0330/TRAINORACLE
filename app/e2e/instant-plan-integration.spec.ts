import { expect, test } from "@playwright/test"
import { completeQuickPlan, enterPlanWithoutRecord, openPlanOptions, refinePlan } from "./plan-flow"

test.use({ serviceWorkers: "block" })
test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const hostname = new URL(route.request().url()).hostname
    return hostname === "127.0.0.1" || hostname === "localhost" ? route.continue() : route.abort()
  })
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
})

for (const width of [320, 375]) {
  test(`minimal entry and one recommendation at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 667 })
    await expect(page.getByRole("button", { name: "1500m", exact: true })).toBeInViewport({ ratio: 1 })
    await enterPlanWithoutRecord(page)
    await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
    await page.getByRole("button", { name: /^매일/u }).click()
    await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
    const recommendation = page.getByRole("region", { name: "1500m · 9일 훈련", exact: true })
    await expect(recommendation.getByRole("grid")).toBeVisible()
    const rangeDates = () => recommendation.locator('[data-in-range="true"] button[data-date]')
      .evaluateAll(nodes => nodes.map(node => node.getAttribute("data-date")!))
    const firstMonthDates = await rangeDates()
    // A real month grid may split a nine-day plan across two months.
    await recommendation.getByRole("button", { name: "다음 달", exact: true }).click()
    const dates = [...new Set([...firstMonthDates, ...await rangeDates()])].sort()
    expect(dates).toHaveLength(9)
    expect(Date.parse(`${dates[8]}T12:00:00Z`) - Date.parse(`${dates[0]}T12:00:00Z`)).toBe(8 * 86400000)
    await recommendation.getByRole("button", { name: "이전 달", exact: true }).click()
    const start = page.getByRole("button", { name: "이 일정으로 시작" })
    await expect(start).toBeEnabled()
    await start.scrollIntoViewIfNeeded()
    await expect(start).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`recommendation-${width}.png`), fullPage: true })
    await openPlanOptions(page)
    await expect(page.getByRole("region", { name: "다른 계획 비교" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "일정을 보고 골라요" })).toBeInViewport()
    await expect(page.getByRole("button", { name: "계획안 A 일정 펼치기" })).toHaveAttribute("aria-expanded", "false")
    await expect(page.getByRole("button", { name: "계획안 B 일정 펼치기" })).toHaveAttribute("aria-expanded", "false")
    await expect(page.getByLabel("9일 훈련 일정", { exact: true }).first()).toBeVisible()
    await expect(page.getByLabel("9일 훈련 일정", { exact: true }).last()).toBeVisible()
  })
}

test("the recommendation keeps real two-times text readable without horizontal clipping", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await completeQuickPlan(page, { days: /^매일/u })
  await page.locator(".plan-candidates").evaluate(element => {
    const nodes = [element, ...element.querySelectorAll<HTMLElement>("*")].filter(node => !(node instanceof SVGElement))
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize))
    nodes.forEach((node, index) => (node as HTMLElement).style.setProperty("font-size", `${sizes[index]! * 2}px`, "important"))
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const start = page.getByRole("button", { name: "이 일정으로 시작" })
  await start.scrollIntoViewIfNeeded()
  await expect(start).toBeInViewport({ ratio: 1 })
  await start.focus()
  await expect(start).toBeFocused()
  await page.screenshot({ path: info.outputPath("recommendation-real-double-text.png"), fullPage: true })
})

test("decimal current record binds, survives reload and reaches the linked journal", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("button", { name: "800m", exact: true }).click()
  await page.getByRole("button", { name: "내 기록", exact: true }).click()
  await page.getByLabel("분", { exact: true }).fill("2")
  await page.getByLabel("초", { exact: true }).fill("1.5")
  const date = await page.evaluate(() => new Date().toLocaleDateString("en-CA"))
  await page.getByText("기록 날짜 추가", { exact: true }).click()
  await page.getByLabel("기록 달성일").fill(date)
  await page.getByRole("button", { name: "기록 입력 완료", exact: true }).click()
  await page.getByRole("button", { name: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u }).click()
  await page.getByRole("button", { name: /^매일/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  // This case exercises the adopted 800m detailed pace template, not the default catalog.
  await refinePlan(page, "훈련 종류", /짧고 세게.*GLY/u)
  await refinePlan(page, "안내 방식", /800m 경기 페이스 상세 훈련 포함/u)
  await expect(page.getByRole("button", { name: "이 일정으로 시작", exact: true })).toHaveCount(0)
  await expect(page.getByRole("region", { name: "계획 저장 상태" }).getByRole("alert")).toHaveText("훈련 조절에서 기준 기록이나 변경한 내용을 확인해 주세요.")
  await page.getByRole("button", { name: "기준 기록 확인하기", exact: true }).click()
  await page.getByRole("button", { name: /추천 · 최근 경기 · 800m · 2분 1\.5초/u }).click()
  await page.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await expect(page.getByRole("heading", { name: "계획이 준비됐어요" })).toBeFocused()
  const start = page.getByRole("button", { name: "이 일정으로 시작" })
  await expect(start).toBeEnabled()
  await start.scrollIntoViewIfNeeded()
  await expect(start).toBeInViewport({ ratio: 1 })
  await start.click()
  await expect(page.getByRole("heading", { name: "오늘 훈련", exact: true })).toBeVisible()
  const before = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
  const saved = JSON.parse(before!)
  const prescription = saved.activePlan.sessions.find((item: { prescription: { kind: string } }) => item.prescription.kind === "PACE_TARGET").prescription
  expect(prescription.selectedAnchor.performanceSeconds).toBe(121.5)
  await page.screenshot({ path: info.outputPath("today-375.png"), fullPage: true })
  await page.reload()
  await page.getByRole("button", { name: "훈련", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 훈련", exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(before)
  await page.getByRole("button", { name: /오전 훈련 기록 남기기/u }).click()
  await expect(page.getByText("계획 1일차 · 오전", { exact: false })).toBeVisible()
  await expect(page.getByRole("button", { name: "계획대로 마쳤어요", exact: true })).toBeVisible()
})

test("editing the schedule moves directly to the actual start-date input", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await completeQuickPlan(page, { days: /^매일/u })
  await openPlanOptions(page)
  const input = page.getByLabel("계획 시작 날짜", { exact: true })
  await expect(input).toBeFocused()
  await expect(input).toBeInViewport({ ratio: 1 })
})

test("a storage failure keeps the explanation and retry together in view", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await completeQuickPlan(page, { days: /^매일/u })
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    let failed = false
    Storage.prototype.setItem = function (key, value) {
      if (!failed && key === "trainoracle.plan-beta.v1") {
        failed = true
        throw new DOMException("Synthetic storage failure", "QuotaExceededError")
      }
      return original.call(this, key, value)
    }
  })
  await page.getByRole("button", { name: "이 일정으로 시작" }).click()
  const recovery = page.getByRole("region", { name: "계획 저장 상태" })
  await expect(recovery).toBeFocused()
  await expect(recovery.getByRole("alert")).toBeInViewport({ ratio: 1 })
  await expect(recovery.getByRole("button", { name: "저장 다시 시도" })).toBeInViewport({ ratio: 1 })
  await recovery.getByRole("button", { name: "저장 다시 시도" }).click()
  await expect(page.getByRole("heading", { name: "오늘 훈련", exact: true })).toBeVisible()
})

test("two daily sessions stay together and the selected afternoon links to its own diary", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await completeQuickPlan(page, { days: /^매일/u })
  await refinePlan(page, "하루 두 번", /하루 두 번 운동할게요/u)
  await page.getByRole("button", { name: "이 일정으로 시작" }).click()
  const sessions = page.getByRole("group", { name: "오늘 세션 선택" })
  await expect(sessions.getByRole("button")).toHaveCount(2)
  await expect(sessions).toBeInViewport({ ratio: 1 })
  await sessions.getByRole("button", { name: /오후/u }).click()
  await expect(sessions.getByRole("button", { name: /오후/u })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: /오전 훈련 기록 남기기/u })).toHaveCount(0)
  await page.getByRole("button", { name: /오후 훈련 기록 남기기/u }).click()
  await expect(page.getByText("계획 1일차 · 오후", { exact: false })).toBeVisible()
})

test("safety remains before activation and the small screen works at enlarged text", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
  await enterPlanWithoutRecord(page, /^10km/u)
  await page.getByRole("button", { name: /달리기를 막 시작했어요/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await page.getByRole("button", { name: /통증.*부상.*몸 이상이 있거나 잘 모르겠어요/u }).click()
  await expect(page.getByRole("heading", { name: "계획안은 먼저 만들 수 있어요" })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath("safety-large-text.png"), fullPage: true })
})
