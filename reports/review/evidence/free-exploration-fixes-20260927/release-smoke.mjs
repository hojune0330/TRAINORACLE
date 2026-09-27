import { chromium, expect } from "../../../../app/node_modules/@playwright/test/index.mjs"
import { writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { completeDetailedPlan } from "../../../../app/e2e/plan-flow.ts"

const base = process.argv[2]
const sourceSha = process.argv[3]
if (!base || !sourceSha || !/^[a-f0-9]{40}$/u.test(sourceSha)) {
  throw new Error("Pass a release URL and exact source SHA")
}
const origin = new URL(base).origin
const browser = await chromium.launch({ headless: true })
const result = { base, sourceSha, syntheticOnly: true, accountLogin: false, checks: [], pageErrors: [], blockedRequests: [] }
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: "block" })
  await context.route("**/*", route => {
    const request = route.request()
    if (new URL(request.url()).origin === origin && ["GET", "HEAD"].includes(request.method())) return route.continue()
    result.blockedRequests.push({ origin: new URL(request.url()).origin, method: request.method() })
    return route.abort()
  })
  const page = await context.newPage()
  page.on("pageerror", error => result.pageErrors.push(error.message))
  const receipt = await context.request.get(new URL("trainoracle-deploy-receipt.json", base).href)
  expect(receipt.ok()).toBe(true)
  const deployment = await receipt.json()
  expect(deployment.sourceSha).toBe(sourceSha)
  result.deployment = deployment
  await page.clock.setFixedTime(new Date(2026, 8, 27, 12))
  await page.goto(`${base}?app=1&uitest=1`)
  await page.getByRole("button", { name: "오늘 기록 남기기", exact: true }).click()
  await page.getByRole("button", { name: "오늘은 쉬었어요", exact: true }).click()
  const home = page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈", exact: true })
  let discarded = 0
  page.once("dialog", async dialog => {
    expect(dialog.type()).toBe("confirm")
    discarded += 1
    await dialog.dismiss()
  })
  await home.click()
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  expect(discarded).toBe(1)
  result.checks.push("unsaved-guest-cancel-preserves-form")
  page.once("dialog", dialog => dialog.accept())
  await home.click()
  await page.evaluate(() => localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify([{
    schemaVersion: 1, id: "synthetic-release-5k", purpose: "RECENT_RESULT", eventDistanceM: 5000,
    performanceSeconds: 1111, achievedOn: "2026-09-20", seasonId: null, enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED", sourceRef: "athlete-record:synthetic-release-5k", savedAt: "2026-09-20T12:00:00Z",
  }])))
  await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
  await completeDetailedPlan(page, { event: /^5000m/, experience: /구조화된 훈련과 경기 경험이 많아요/,
    focus: /숨차게 반복.*VO₂/, template: /5000m 경기 페이스 상세 훈련 포함/ })
  const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await picker.getByRole("button", { name: /18분 31초/ }).click()
  await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()
  const target = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1"))
    const session = state.activePlan.sessions.find(item => item.prescription.kind === "PACE_TARGET")
    const date = new Date(`${state.intake.startDate}T12:00:00`)
    date.setDate(date.getDate() + session.day - 1)
    return { timestamp: date.getTime(), targetSeconds: session.prescription.targetRepSeconds }
  })
  expect(target.targetSeconds).toBe(222.2)
  await page.clock.setFixedTime(new Date(target.timestamp))
  await page.reload()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  const overview = page.locator(".instant-plan--today-compact")
  await expect(overview).toContainText("1000m를 약 3분 42초에 5회")
  await expect(overview).toContainText("반복 사이 2분 30초 조깅")
  await expect(overview).toContainText("15분 가볍게 움직이기")
  await expect(overview).toContainText("10분 가볍게 움직이기")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await overview.screenshot({ path: fileURLToPath(new URL("public-executable-workout-375.png", import.meta.url)) })
  result.checks.push("real-generation-exact-workout-shown")
  const stored = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
  await overview.getByRole("button", { name: /훈련 방법·근거/ }).click()
  const reader = page.getByRole("dialog")
  await expect(reader.getByText(/5×1000m @5000m RP.*r150.*JOG/).first()).toBeVisible()
  await reader.getByRole("button", { name: "달력으로 돌아가기", exact: true }).click()
  await expect(overview.getByRole("button", { name: /훈련 방법·근거/ })).toBeFocused()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(stored)
  result.checks.push("same-prescription-reader-return-no-mutation")
  expect(result.pageErrors).toEqual([])
  result.result = "PASS"
  await writeFile(new URL("public-release-smoke.json", import.meta.url), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result))
  await context.close()
} finally {
  await browser.close()
}
