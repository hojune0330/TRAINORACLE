import { expect, test } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"
import { completeDetailedPlan, completeQuickPlan, enterPlanWithoutRecord } from "./plan-flow"
import { expectActivePlanHeading, openActiveSessionDetails } from "./active-plan-flow"
import { EXECUTION_STOP_CUE } from "../src/screens/plan-beta/labels"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === appOrigin
    ? route.continue() : route.abort())
})

async function answerMinimumPlanQuestions(page: Page): Promise<void> {
  await completeDetailedPlan(page, { division: /고등부/u })
}

async function expectInstructionCards(cards: Locator, selectedSteps: string[]): Promise<void> {
  await expect(cards.getByRole("term")).toHaveText(["본운동", "준비", "정리"])
  await expect(cards.getByLabel("계획된 전체 시간")).toHaveText("40분 20초 · 준비·회복·정리 포함")
  await expect(cards.getByRole("definition")).toHaveText(selectedSteps)
  await expect(cards).toContainText(EXECUTION_STOP_CUE.replaceAll("\u2060", "").replaceAll("\u00a0", " "))
}

async function expectCanonicalPlanCandidates(page: Page): Promise<void> {
  await expect(page.getByRole("heading", {
    name: "계획이 준비됐어요",
  })).toBeVisible()
  await expect(page.locator(".plan-candidate")).toHaveCount(2)
  const comparison = page.getByRole("region", { name: "다른 계획 비교", exact: true })
  if (!await comparison.isVisible()) {
    await page.getByRole("button", { name: "다른 계획안 비교하기", exact: true }).click()
  }
  await expect(comparison.getByRole("button", { name: /^[AB]안 선택(?:됨)?$/u })).toHaveCount(2)
  await expect(page.getByRole("button", { name: "이 일정으로 시작", exact: true })).toHaveCount(1)
  await expect(page.getByText(/9일/u).first()).toBeVisible()
  await expect.poll(async () => page.evaluate(
    () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
  )).toBeNull()
}

test("keeps plan help inside the narrow scroll region", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await enterPlanWithoutRecord(page)
  await page.getByRole("group", { name: "앞서 선택한 답 수정" }).getByRole("button", { name: "목표 1500m 답 바꾸기", exact: true }).click()
  await page.getByRole("button", { name: "준비 목표 설명 보기" }).click()

  const geometry = await page.evaluate(() => {
    const scrollRegion = document.querySelector<HTMLElement>(".app-scroll-region")
    const popover = document.querySelector<HTMLElement>(".popover-surface")
    const detail = document.querySelector<HTMLElement>(".term-help__short")
    if (scrollRegion === null || popover === null || detail === null) return null
    const scrollRect = scrollRegion.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()
    return {
      scrollLeft: scrollRect.left + scrollRegion.clientLeft,
      scrollRight: scrollRect.left + scrollRegion.clientLeft + scrollRegion.clientWidth,
      popoverLeft: popoverRect.left,
      popoverRight: popoverRect.right,
      hasHorizontalOverflow: scrollRegion.scrollWidth > scrollRegion.clientWidth,
      detailWordBreak: window.getComputedStyle(detail).wordBreak,
    }
  })

  expect(geometry).not.toBeNull()
  expect(geometry?.popoverLeft).toBeGreaterThanOrEqual(geometry?.scrollLeft ?? 0)
  expect(geometry?.popoverRight).toBeLessThanOrEqual(geometry?.scrollRight ?? 0)
  expect(geometry?.hasHorizontalOverflow).toBe(false)
  expect(geometry?.detailWordBreak).toBe("keep-all")
})

test("moves a first visitor from WELCOME to JOURNAL after a real first save", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", {
    name: "운동 분석과 훈련 계획",
  })).toBeVisible()

  await page.getByRole("button", { name: "오늘 운동 기록 쓰기" }).click()
  await expect(page.getByRole("heading", { name: "오늘 운동은 어떻게 됐나요?" })).toBeVisible()
  await page.getByRole("button", { name: "운동을 마쳤어요" }).click()
  // A second immediate pointer click at the same position is deliberately
  // rejected as a double tap; use a distinct keyboard answer here.
  await page.getByRole("button", { name: "시간 미지정" }).press("Enter")
  await page.getByRole("button", { name: /힘든 정도 6\/10,/u }).click()
  await page.getByRole("button", { name: "없어요" }).click()
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()
  await page.getByRole("button", { name: "완료", exact: true }).click()

  await expect.poll(async () => page.evaluate(() => {
    const stored = localStorage.getItem("to-local-journal.journal.v2")
    if (stored === null) return 0
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.length : -1
  })).toBe(1)
  await expect(page.getByRole("heading", { name: "내 기록", exact: true })).toBeVisible()
  await expect(page.getByText("오늘 남긴 기록 1개", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "오늘 운동 기록 쓰기" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "컨디션·메모 기록하기" })).toHaveCount(0)

  await page.getByRole("button", { name: "기록 더 남기기" }).click()
  await expect(page.getByRole("heading", { name: "무엇을 기록할까요?" })).toBeVisible()
  await page.getByRole("button", { name: /컨디션·메모.*수면·몸 상태·기분·메모/u }).click()
  await expect(page.getByRole("heading", { name: "무엇을 남길까요?" })).toBeVisible()
  await page.getByRole("button", { name: "수면", exact: true }).click()
  await expect(page.getByRole("heading", { name: "어젯밤 수면" })).toBeVisible()
})

test("generates selectable 9-day candidates from first-screen intake", async ({ page }) => {
  // Given
  await page.goto("/?app=1")

  // When
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await answerMinimumPlanQuestions(page)

  // Then
  await expectCanonicalPlanCandidates(page)
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )).toBe(true)
})

test("generates a bounded two-a-day 9-day candidate", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await completeDetailedPlan(page, { event: /^5000m\b/u, division: /고등부/u, days: /^매일/u, focus: /유산소 반복 훈련/u, twice: true })

  await expectCanonicalPlanCandidates(page)
  const candidateSchedule = page.getByRole("button", { name: /^계획안 A 일정 (펼치기|접기)$/u })
  if (await candidateSchedule.getAttribute("aria-expanded") !== "true") await candidateSchedule.click()
  const days = page.locator(".plan-candidate").first().locator(".plan-day-deck:visible .plan-schedule-preview > li")
  await expect(days).toHaveCount(9)
  for (let day = 0; day < 9; day += 1) {
    const sessions = days.nth(day).locator(".plan-day-card__session")
    await expect(sessions).toHaveCount(2)
    await expect(days.nth(day).locator('.plan-day-card__session[data-session-slot="AM"]')).toHaveCount(1)
    await expect(days.nth(day).locator('.plan-day-card__session[data-session-slot="PM"]')).toHaveCount(1)
    expect(await days.nth(day).locator('.plan-day-card__session[data-flow-kind="main"]').count()).toBeLessThanOrEqual(1)
  }
  // Catalog names describe the actual workout; the REC control identifies its purpose.
  const recovery = days.first().locator('.plan-day-card__session[data-session-slot="PM"]')
  await expect(recovery).toHaveAttribute("data-flow-kind", "recovery")
  await expect(recovery.getByRole("button", { name: "회복 운동 REC 훈련 설명 보기", exact: true })).toBeVisible()
  await expect(recovery.locator(".plan-session-metric")).toContainText(/RPE 1[–~]2/u)
})

test("keeps an evening two-a-day plan after selection and reload", async ({ page }) => {
  // Given
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await completeDetailedPlan(page, { event: /^5000m\b/u, division: /고등부/u, days: /^매일/u, focus: /유산소 반복 훈련/u, time: /저녁에 운동해요/u, twice: true })
  await expectCanonicalPlanCandidates(page)
  const candidateSchedule = page.getByRole("button", { name: /^계획안 A 일정 (펼치기|접기)$/u })
  if (await candidateSchedule.getAttribute("aria-expanded") !== "true") await candidateSchedule.click()
  const candidateQuality = page.locator(".plan-candidate").first()
    .locator('.plan-day-card__session[data-session-slot="PM"][data-flow-kind="main"]').first()
  const selectedTitle = await candidateQuality.getByRole("heading", { level: 3 }).innerText()
  const selectedNotation = await candidateQuality.locator(".plan-session-metric").innerText()
  await expect(candidateQuality.getByRole("list", { name: "훈련 실행 순서" })).toHaveCount(0)
  await candidateQuality.getByRole("button", { name: /오후 훈련 내용 보기$/u }).click()
  const candidateReader = page.locator(".plan-day-reader[open]")
  await expect(candidateReader).toBeVisible()
  const candidateSteps = candidateReader.getByRole("article", { name: "훈련 메모 미리보기" })
  await expect(candidateSteps.getByRole("term")).toHaveText(["본운동", "준비", "정리"])
  const selectedSteps = await candidateSteps.getByRole("definition").allTextContents()
  // Preserve the selected work and recovery details across activation and reload.
  expect(selectedNotation).toMatch(/@ RPE/u)
  await expectInstructionCards(candidateSteps, selectedSteps)
  expect(selectedSteps[0]).toMatch(/\d+(?:\.\d+)?분씩 \d+번/u)
  expect(selectedSteps[0]).toMatch(/힘든 정도\(RPE\) 7[–~]8\/10/u)
  expect(selectedSteps[0]).toMatch(/사이 \d+(?:분|초) 조깅/u)
  await candidateReader.getByRole("button", { name: /^(?:달력|하루씩)으로 돌아가기$/u, exact: true }).click()
  await expect(candidateReader).toHaveCount(0)

  // When
  await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()

  // Then
  await expectActivePlanHeading(page)
  const qualityDay = await openActiveSessionDetails(page, /강한 유산소 반복/u)
  // The helper selects PM while keeping AM reachable through its slot control.
  const qualitySession = qualityDay.locator('.plan-day-card__session[data-session-slot="PM"][data-flow-kind="main"]')
  await expect(qualitySession).toHaveCount(1)
  await expect(qualitySession.getByRole("heading", { level: 3 })).toHaveText(selectedTitle)
  const qualitySteps = qualitySession.getByRole("article", { name: "훈련 메모 미리보기" })
  await expect(qualitySteps).toBeVisible()
  await expectInstructionCards(qualitySteps, selectedSteps)
  await expect(qualitySession).toContainText("오후")
  await expect.poll(async () => page.evaluate(() => {
    const stored = window.localStorage.getItem("trainoracle.plan-beta.v1")
    if (stored === null) return false
    const plan: unknown = JSON.parse(stored)
    if (typeof plan !== "object" || plan === null || !("activePlan" in plan)) return false
    const activePlan = plan.activePlan
    if (typeof activePlan !== "object" || activePlan === null || !("sessions" in activePlan)) return false
    const sessions = activePlan.sessions
    if (!Array.isArray(sessions)) return false
    return sessions.some((session) => (
      typeof session === "object"
      && session !== null
      && "role" in session
      && "slot" in session
      && session.role === "QUALITY"
      && session.slot === "PM"
    ))
  })).toBe(true)
  const savedPlan = await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))
  expect(savedPlan).not.toBeNull()

  await page.reload()
  await expect(page.getByRole("navigation", { name: "주 탭" }).getByRole("button", {
    name: "훈련", exact: true,
  })).toBeVisible()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련" }).click()
  await expectActivePlanHeading(page)
  const reloadedDay = await openActiveSessionDetails(page, /강한 유산소 반복/u)
  const reloadedQualitySession = reloadedDay.locator('.plan-day-card__session[data-session-slot="PM"][data-flow-kind="main"]')
  await expect(reloadedQualitySession).toHaveCount(1)
  await expect(reloadedQualitySession.getByRole("heading", { level: 3 })).toHaveText(selectedTitle)
  const reloadedSteps = reloadedQualitySession.getByRole("article", { name: "훈련 메모 미리보기" })
  await expect(reloadedSteps).toBeVisible()
  await expectInstructionCards(reloadedSteps, selectedSteps)
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(savedPlan)
})

test("reads a detailed training notation without creating a plan", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await page.getByRole("button", { name: "훈련표 표기 읽기" }).click()
  await page.getByRole("textbox", { name: "훈련표 표기" }).fill(
    "2×(10×400m) @5000m RP · r60″ STAND · R3′ STAND",
  )
  await page.getByRole("button", { name: "표기 풀어보기" }).click()

  const result = page.getByRole("region", { name: "훈련표 표기 결과" })
  await expect(result.getByText("20회")).toBeVisible()
  await expect(result.getByText("8,000m")).toBeVisible()
  await expect(result.getByText("60초 · 18번")).toBeVisible()
  await expect(result.getByText("3분 · 1번")).toBeVisible()
  await expect(result.getByText("1,260초")).toBeVisible()
  await expect.poll(async () => page.evaluate(
    () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
  )).toBeNull()
})

test("does not let a favorable current answer override recent high pain", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date()
    const padded = (value: number) => String(value).padStart(2, "0")
    const date = `${now.getFullYear()}-${padded(now.getMonth() + 1)}-${padded(now.getDate())}`
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "recent-high-pain-e2e",
      kind: "evening",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      sleepH: 0,
      sleepQuality: 0,
      weightKg: "",
      restingHr: "",
      painParts: { knee: 5 },
      mood: 0,
      note: "",
      fieldProvenance: {
        painParts: { provenance: "EXPLICIT" },
      },
    }]))
  })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련" }).click()

  await completeQuickPlan(page)

  await expect(page.getByRole("heading", { name: "계획안은 먼저 만들 수 있어요" })).toBeVisible()
  await expect(page.getByRole("heading", {
    name: "지속 페이스 포함",
  })).toHaveCount(0)
})

test("shows a truthful distance receipt and opens the real trend", async ({ page }) => {
  // Given
  await page.addInitScript(() => {
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "__future_existing_entry__",
      kind: "evening",
      date: "2099-01-01",
      savedAt: "2099-01-01T00:00:00.000Z",
      syncState: "local",
      sleepH: 0,
      sleepQuality: 0,
      weightKg: "",
      restingHr: "",
      painParts: { "왼 무릎": 5 },
      mood: 0,
      note: "",
      fieldProvenance: {
        sleepH: { provenance: "MISSING" },
        sleepQuality: { provenance: "MISSING" },
        weightKg: { provenance: "MISSING" },
        restingHr: { provenance: "MISSING" },
        painParts: { provenance: "EXPLICIT" },
        mood: { provenance: "MISSING" },
      },
    }]))
  })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기" }).click()
  await page.getByRole("button", { name: /자세히 기록.*운동별로 자세히/u }).click()
  await page.getByRole("button", { name: "지금 입력 확인", exact: true }).click()
  await page.getByRole("button", { name: "거리와 시간 수정", exact: true }).click()
  await page.getByRole("textbox", { name: "거리 (km)" }).fill("8")
  await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()

  // When
  await page.getByRole("button", { name: /^저장/u }).click()

  // Then
  const receipt = page.locator(".journal-save-result")
  await expect(receipt).toContainText("8 km")
  await receipt.getByRole("button", { name: "거리 추이 보기" }).click()
  await expect(page.getByRole("heading", { name: "오라클", exact: true })).toBeVisible()
  const detailMenu = page.getByRole("group", { name: "훈련 분석 자세히 보기" })
  await expect(detailMenu.getByRole("button", { name: "월별 변화", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("region", { name: "최근 4개월 추이" }).locator("summary", { hasText: "월별 수치와 집계 범위 보기" }).click()
  await expect(page.getByRole("region", { name: "최근 4개월 추이" }).getByText(/중앙 거리 8 km/u)).toBeVisible()
  await detailMenu.getByRole("button", { name: "훈련량", exact: true }).click()
  const distance = page.getByRole("region", { name: "누적 거리와 변화" })
  await expect(distance.getByLabel(/이번 주, 8킬로미터, 기록 1건/u)).toBeVisible()
  await expect(distance.getByText(/1건 반영/u).first()).toBeVisible()
})

test("uses the real app on desktop and reserves the workspace for an explicit query", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop routing contract")

  // Given / When
  await page.goto("/")
  // Then
  await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()
  await expect(page.getByText(/app · phase 1 · journal-first/u)).toHaveCount(0)

  // When
  await page.goto("/?workspace=1")

  // Then
  await expect(page.getByText(/app · phase 1 · journal-first/u)).toBeVisible()
})
