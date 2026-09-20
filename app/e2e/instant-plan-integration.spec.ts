import { expect, test } from "@playwright/test"
import { completeQuickPlan, enterPlanWithoutRecord, refinePlan } from "./plan-flow"

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
    await page.getByRole("radio", { name: "기록 없이" }).check()
    await expect(page.getByRole("button", { name: "내 계획 받기" })).toBeInViewport({ ratio: 1 })
    await completeQuickPlan(page, { days: /^매일/u })
    const recommendation = page.getByRole("region", { name: "1500m · 9일 훈련", exact: true })
    await expect(recommendation.getByRole("list", { name: "" }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
    await expect(page.locator(".instant-plan__schedule > li")).toHaveCount(9)
    if (width === 375) {
      await expect(page.locator(".instant-plan__schedule > li").last()).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole("button", { name: "이 일정으로 시작" })).toBeInViewport({ ratio: 1 })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`recommendation-${width}.png`), fullPage: true })
    await page.getByRole("button", { name: "다른 계획 보기" }).click()
    await expect(page.getByRole("region", { name: "다른 계획 비교" })).toBeFocused()
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
  await page.getByRole("combobox", { name: "종목" }).selectOption("800")
  await page.getByLabel("분", { exact: true }).fill("2")
  await page.getByLabel("초", { exact: true }).fill("1.5")
  const date = await page.evaluate(() => new Date().toLocaleDateString("en-CA"))
  await page.getByLabel("기록 달성일").fill(date)
  await page.getByRole("button", { name: "내 계획 받기" }).click()
  await page.getByRole("button", { name: /구조화된 훈련과 경기 경험/u }).click()
  await page.getByRole("button", { name: /^매일/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await expect(page.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
  await page.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await expect(page.getByRole("heading", { name: "계획이 준비됐어요" })).toBeFocused()
  await expect(page.getByRole("button", { name: "이 일정으로 시작" })).toBeInViewport({ ratio: 1 })
  await page.getByRole("button", { name: "이 일정으로 시작" }).click()
  await expect(page.getByRole("heading", { name: "오늘 훈련", exact: true })).toBeVisible()
  const before = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
  const saved = JSON.parse(before!)
  const prescription = saved.activePlan.sessions.find((item: { prescription: { kind: string } }) => item.prescription.kind === "PACE_TARGET").prescription
  expect(prescription.selectedAnchor.performanceSeconds).toBe(121.5)
  await page.screenshot({ path: info.outputPath("today-375.png"), fullPage: true })
  await page.reload()
  await page.getByRole("button", { name: "계획", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 훈련", exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(before)
  await page.getByRole("button", { name: /오전 훈련 기록 남기기/u }).click()
  await expect(page.getByText("계획 1일차 · 오전", { exact: false })).toBeVisible()
  await expect(page.getByRole("button", { name: "계획대로 마쳤어요", exact: true })).toBeVisible()
})

test("editing the schedule moves directly to the actual start-date input", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await completeQuickPlan(page, { days: /^매일/u })
  await page.getByRole("button", { name: "시작일·훈련일 바꾸기" }).click()
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
  await expect(page.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath("safety-large-text.png"), fullPage: true })
})
