import { expect, test } from "@playwright/test"
import { completeDetailedPlan } from "./plan-flow"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page }) => {
  await page.goto("/?app=1&uitest=1")
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test("keeps unsaved guest writing on cancelled tab navigation and browser back", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await page.getByRole("button", { name: "오늘은 쉬었어요" }).click()
  await page.getByRole("button", { name: "글 추가", exact: true }).click()
  await page.getByRole("radio", { name: "나만의 메모", exact: true }).check()
  const input = page.getByLabel("일지 내용", { exact: true })
  await input.fill("synthetic private draft for navigation")
  await expect(page.getByText(/처음 한 번, 비밀 메모를 암호화해 보관할/)).toBeVisible()
  await page.getByRole("button", { name: "내용 반영", exact: true }).click()
  await expect(page.getByRole("button", { name: "비밀 메모 보관 준비", exact: true })).toBeVisible()
  await expect(page.getByText("글은 아직 저장 전이에요. 비밀 메모 보관을 먼저 준비해요.")).toBeVisible()

  const home = page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈", exact: true })
  let confirmationCount = 0
  page.on("dialog", async dialog => {
    expect(["confirm", "beforeunload"]).toContain(dialog.type())
    if (dialog.type() === "confirm") expect(dialog.message()).toContain("아직 저장하지 않은 내용")
    confirmationCount += 1
    await dialog.dismiss()
  })
  await home.click()
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await page.evaluate(() => history.back())
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await expect.poll(() => confirmationCount).toBe(2)
  await page.getByRole("button", { name: "글 수정", exact: true }).click()
  await expect(input).toHaveValue("synthetic private draft for navigation")
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("synthetic private draft for navigation")
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain("synthetic private draft for navigation")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("private-draft-retained.png") })

  page.removeAllListeners("dialog")
  page.once("dialog", dialog => dialog.accept())
  await home.click()
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await expect(page.getByRole("heading", { name: "오늘 운동은 어떻게 됐나요?" })).toBeVisible()
})

test("does not ask to discard a blank or successfully saved guest journal", async ({ page }) => {
  const dialogs: string[] = []
  page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.dismiss() })
  const home = page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈", exact: true })
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await home.click()
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await page.getByRole("button", { name: "오늘은 쉬었어요" }).click()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()
  await home.click()
  expect(dialogs).toEqual([])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.journal.v1") ?? "[]"))).toHaveLength(1)
})

test("keeps personal mode when another analysis topic has no personal evidence", async ({ page }) => {
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석", exact: true }).click()
  await page.locator("summary", { hasText: "예시로 먼저 둘러보기" }).click()
  await page.getByRole("region", { name: "어떤 분석이 궁금하세요?" }).getByRole("button").first().click()
  await page.getByRole("button", { name: "내 기록", exact: true }).click()
  await page.getByRole("button", { name: /이어서 살펴보기/ }).click()
  await expect(page.getByRole("button", { name: "내 기록", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".oracle-explore__example-label")).toHaveCount(0)
  await page.getByRole("combobox", { name: "분석 주제" }).selectOption("level")
  await expect(page.getByRole("button", { name: "내 기록", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".oracle-explore__example-label")).toHaveCount(0)
})

test("shows an executable record-based workout and opens its same stored method", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.clock.setFixedTime(new Date(2026, 8, 27, 12))
  await page.evaluate(() => localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify([{
    schemaVersion: 1, id: "synthetic-followup-5k", purpose: "RECENT_RESULT", eventDistanceM: 5000,
    performanceSeconds: 1111, achievedOn: "2026-09-20", seasonId: null, enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED", sourceRef: "athlete-record:synthetic-followup-5k", savedAt: "2026-09-20T12:00:00Z",
  }])))
  await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
  await completeDetailedPlan(page, { event: /^5000m/, experience: /구조화된 훈련과 경기 경험이 많아요/,
    focus: /숨차게 반복.*VO₂/, template: /5000m 경기 페이스 상세 훈련 포함/ })
  const picker = page.getByRole("region", { name: "개인 페이스 기준 기록" })
  await picker.getByRole("button", { name: /18분 31초/ }).click()
  await picker.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }).click()
  await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()
  const target = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1")!)
    const session = state.activePlan.sessions.find((s: { prescription: { kind: string } }) => s.prescription.kind === "PACE_TARGET")
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
  await overview.screenshot({ path: info.outputPath("executable-workout-375.png") })
  const before = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
  await overview.getByRole("button", { name: /훈련 방법·근거/ }).click()
  const reader = page.getByRole("dialog")
  await expect(reader.getByText(/5×1000m @5000m RP.*r150.*JOG/).first()).toBeVisible()
  await reader.screenshot({ path: info.outputPath("same-workout-reader-375.png") })
  await reader.getByRole("button", { name: "달력으로 돌아가기" }).click()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(before)
  await expect(overview.getByRole("button", { name: /훈련 방법·근거/ })).toBeFocused()
})
