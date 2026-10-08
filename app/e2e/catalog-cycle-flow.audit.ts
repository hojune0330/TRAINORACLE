import { expect, test } from "@playwright/test"
import { completeQuickPlan, refinePlan } from "./plan-flow"
import { createPlannedSessionLogDraft } from "../src/domain/planned-session-link"
import type { PlanBetaStateV3 } from "../src/domain/plan-beta-schema"

test("first ATP MAIN confirms real environment and saves detailed work on mobile", async ({ page, context }, info) => {
  const errors: string[] = [], blocked: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== "http://127.0.0.1:4430" || !["GET", "HEAD"].includes(request.method())) {
      blocked.push(`${request.method()} ${url.origin}`); return route.abort()
    }
    return route.continue()
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.clock.setFixedTime(new Date("2026-10-01T03:00:00Z"))
  await page.goto("/?app=1&uitest=1")
  const planTab = () => page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true })
  await planTab().click()
  await completeQuickPlan(page, { event: "1500", experience: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u, days: /^5일/u })
  await refinePlan(page, "훈련 종류", /ATP/u)
  const review = page.getByRole("region", { name: "첫 주요 훈련 조건" })
  await expect(review).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()
  const checks = review.getByRole("checkbox")
  expect(await checks.count()).toBeGreaterThan(0)
  for (let index = 0; index < await checks.count(); index++) await checks.nth(index).check()
  await review.getByRole("button", { name: "이 훈련으로 적용" }).click()
  await expect(review).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath("initial-atp-confirmed.png") })
  await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 훈련", exact: true })).toBeVisible()
  const stored = JSON.parse((await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1")))!) as PlanBetaStateV3
  const main = stored.activePlan.sessions.filter(session => session.role === "QUALITY")
  expect(main.length).toBeGreaterThan(0)
  expect(main.every(session => session.prescription.kind === "RPE_TIME_RANGE"
    && session.prescription.catalogWorkout?.inputs.confirmedRequirements.length)).toBe(true)
  await page.reload(); await planTab().click()
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1")))!)).toEqual(stored)
  expect(errors).toEqual([]); expect(blocked).toEqual([])
})

for (const [width, reduced] of [[320, true], [375, false], [1280, true]] as const) {
  test(`first exact MAIN and journal-linked successor ${width}`, async ({ page, context }, info) => {
    const errors: string[] = [], blocked: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await context.route("**/*", route => {
      const request = route.request(), url = new URL(request.url())
      if (url.origin !== "http://127.0.0.1:4430" || !["GET", "HEAD"].includes(request.method())) {
        blocked.push(`${request.method()} ${url.origin}`); return route.abort()
      }
      return route.continue()
    })
    await page.setViewportSize({ width, height: 800 })
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" })
    await page.clock.setFixedTime(new Date("2026-09-20T03:00:00Z"))
    await page.goto("/?app=1&uitest=1")
    const planTab = () => page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true })
    await planTab().click()
    await completeQuickPlan(page, { event: "5000", experience: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u, days: /^5일/u })
    await refinePlan(page, "훈련 종류", /지속 페이스 훈련/u)
    await page.screenshot({ path: info.outputPath("initial-main.png") })
    await page.getByRole("group", { name: "계획 확인·변경" })
      .getByRole("button", { name: "훈련 조절", exact: true }).click()
    const picker = page.locator(".catalog-workout-picker")
    const addresses = await picker.getByRole("combobox", { name: "바꿀 일정" }).locator("option").evaluateAll(options =>
      options.map(option => ({ value: (option as HTMLOptionElement).value, text: option.textContent ?? "" })))
    let mainCount = 0
    for (const address of addresses) {
      await picker.getByRole("combobox", { name: "바꿀 일정" }).selectOption(address.value)
      if (await picker.getByRole("combobox", { name: "훈련 구성" }).locator('option[value="P-LT-B"]').count() === 0) continue
      mainCount += 1
      await picker.getByRole("combobox", { name: "훈련 구성" }).selectOption("P-LT-B")
      const longer = picker.getByRole("checkbox", { name: /준비·회복·정리까지/u })
      if (await longer.count()) await longer.check()
      await picker.getByRole("button", { name: "이 구성으로 바꾸기" }).click()
    }
    expect(mainCount).toBeGreaterThanOrEqual(2)
    await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()
    await expect(page.getByRole("heading", { name: "오늘 훈련", exact: true })).toBeVisible()
    const before = JSON.parse((await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1")))!) as PlanBetaStateV3
    const detailed = before.activePlan.sessions.filter(s => s.role === "QUALITY")
    expect(detailed.every(s => s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout?.catalogId === "P-LT-B")).toBe(true)
    const entries = detailed.map(s => {
      const draft = createPlannedSessionLogDraft(before, s, "2026-09-29T03:00:00Z")!
      return { id: `browser-cycle-${s.day}-${s.slot}`, kind: "post-session", date: draft.date, savedAt: "2026-09-29T03:00:00Z",
        syncState: "local", system: "lt", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 9, memo: "",
        plannedSessionLink: draft.link, fieldProvenance: { rpe: { provenance: "EXPLICIT" } } }
    })
    await page.evaluate(rows => localStorage.setItem("trainoracle.journal.v1", JSON.stringify(rows)), entries)
    await page.clock.setFixedTime(new Date("2026-10-01T03:00:00Z"))
    await page.reload(); await planTab().click()
    await page.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기", exact: true }).click()
    await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
    const summary = page.getByRole("region", { name: "이전 수행 반영" })
    await expect(summary).toBeVisible()
    await summary.locator("summary").click()
    await expect(summary).toContainText("RPE 9")
    await expect(summary).toContainText("짧은 구성으로 조정")
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1")))!)).toEqual(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    await summary.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath("cycle-response.png") })
    if (width === 375) {
      const originalFonts = await summary.evaluate(root => {
        const nodes = [...root.querySelectorAll<HTMLElement>('p, strong, summary, span')]
        const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize))
        const originals = nodes.map(node => node.style.fontSize)
        nodes.forEach((node, i) => { node.style.fontSize = `${sizes[i]! * 2}px` })
        return originals
      })
      await summary.locator("summary").focus()
      await page.keyboard.press("Enter")
      await expect(summary.locator("details")).not.toHaveAttribute("open", "")
      await page.keyboard.press("Enter")
      await expect(summary.locator("details")).toHaveAttribute("open", "")
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
      await page.screenshot({ path: info.outputPath("cycle-response-200pct.png") })
      await summary.evaluate((root, fonts) => {
        root.querySelectorAll<HTMLElement>('p, strong, summary, span').forEach((node, i) => { node.style.fontSize = fonts[i]! })
      }, originalFonts)
    }
    await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()
    const after = JSON.parse((await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1")))!) as PlanBetaStateV3
    expect(after.activePlan.sessions.filter(s => s.role === "QUALITY").every(s => s.prescription.kind === "RPE_TIME_RANGE"
      && s.prescription.catalogWorkout?.catalogId === "P-LT-B-480")).toBe(true)
    expect(after.periodization?.frameOrdinal).toBe(before.periodization!.frameOrdinal + 1)
    await page.reload(); await planTab().click()
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1")))!)).toEqual(after)
    expect(errors).toEqual([]); expect(blocked).toEqual([])
  })
}
