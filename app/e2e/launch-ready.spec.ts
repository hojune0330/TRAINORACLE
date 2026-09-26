import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { completeDetailedPlan, completeQuickPlan, enterPlanWithoutRecord } from "./plan-flow"
import { expectActivePlanHeading, openActiveSessionDetails } from "./active-plan-flow"

async function answerMinimumPlanQuestions(page: Page): Promise<void> {
  await completeDetailedPlan(page, { division: /고등부/u })
}

async function expectCanonicalPlanCandidates(page: Page): Promise<void> {
  await expect(page.getByRole("heading", {
    name: "계획이 준비됐어요",
  })).toBeVisible()
  await expect(page.locator(".plan-candidate")).toHaveCount(2)
  await expect(page.getByRole("button", { name: /선택하기|이 계획으로 시작하기/u })).toHaveCount(2)
  await expect(page.getByText(/9일/u).first()).toBeVisible()
  await expect.poll(async () => page.evaluate(
    () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
  )).toBeNull()
}

test("keeps plan help inside the narrow scroll region", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await enterPlanWithoutRecord(page)
  await page.locator(".plan-intake__summary").getByRole("button", { name: "1500m", exact: true }).click()
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
    name: "내 훈련, 무엇부터 개선할까요?",
  })).toBeVisible()

  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await expect(page.getByRole("heading", { name: "오늘 운동은 어떻게 됐나요?" })).toBeVisible()
  await page.getByRole("button", { name: "운동을 마쳤어요" }).click()
  await page.getByRole("button", { name: "시간 미지정" }).click()
  await page.getByRole("button", { name: /RPE 6,/u }).click()
  await page.getByRole("button", { name: "없어요" }).click()
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()
  await page.getByRole("button", { name: "완료", exact: true }).click()

  await expect.poll(async () => page.evaluate(() => {
    const stored = localStorage.getItem("trainoracle.journal.v1")
    if (stored === null) return 0
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.length : -1
  })).toBe(1)
  await expect(page.getByRole("heading", { name: "내 훈련, 무엇부터 개선할까요?" })).toBeVisible()
  await expect(page.getByText("오늘 기록을 남겼어요.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "오늘 기록하기" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "하루 마무리 기록하기" })).toHaveCount(0)

  await page.getByRole("button", { name: "기록 더 남기기" }).click()
  await expect(page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
  await page.getByRole("button", { name: /회복 · 하루 마무리/u }).click()
  await expect(page.getByRole("heading", { name: /회복.*하루 마무리/u })).toBeVisible()
})

test("generates selectable 9-day candidates from first-screen intake", async ({ page }) => {
  // Given
  await page.goto("/?app=1")

  // When
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await answerMinimumPlanQuestions(page)

  // Then
  await expectCanonicalPlanCandidates(page)
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )).toBe(true)
})

test("generates a bounded two-a-day 9-day candidate", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await completeDetailedPlan(page, { event: /^5000m\b/u, division: /고등부/u, days: /^매일/u, focus: /숨차게 반복.*VO₂/u, twice: true })

  await expectCanonicalPlanCandidates(page)
  await expect(page.locator(".plan-day-deck:visible").getByText("오후 회복 운동", { exact: true }).first()).toBeVisible()
})

test("keeps an evening two-a-day plan after selection and reload", async ({ page }) => {
  // Given
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await completeDetailedPlan(page, { event: /^5000m\b/u, division: /고등부/u, days: /^매일/u, focus: /숨차게 반복.*VO₂/u, time: /저녁에 운동해요/u, twice: true })

  // When
  await page.getByRole("button", { name: /선택하기|이 계획으로 시작하기/u }).first().click()

  // Then
  await expectActivePlanHeading(page)
  const qualitySession = await openActiveSessionDetails(page, /강한 유산소 반복/u)
  await expect(qualitySession.getByRole("list", { name: "훈련 실행 순서" }).first()).toContainText("준비")
  await expect(qualitySession.getByRole("list", { name: "훈련 실행 순서" }).first()).toContainText("본운동")
  await expect(qualitySession.getByText(/강한\s구간과 천천히 움직이는 회복 구간을 번갈아\s하세요/u).first()).toBeVisible()
  await expect(qualitySession.getByRole("list", { name: "훈련 실행 순서" }).first()).toContainText("정리")
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

  await page.reload()
  await expect(page.getByRole("navigation", { name: "주 탭" }).getByRole("button", {
    name: "계획", exact: true,
  })).toBeVisible()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
  await expectActivePlanHeading(page)
  const reloadedQualitySession = await openActiveSessionDetails(page, /강한 유산소 반복/u)
  await expect(reloadedQualitySession.getByText(/거리\u2060·\u2060목표\s페이스는 지정하지 않음/u).first()).toBeVisible()
  await expect(reloadedQualitySession.getByRole("list", { name: "훈련 실행 순서" }).first()).toBeVisible()
})

test("reads a detailed training notation without creating a plan", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획", exact: true }).click()
  await page.locator("summary", { hasText: "기록 관리·훈련표 읽기" }).click()
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
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()

  await completeQuickPlan(page)

  await expect(page.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
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
  await page.getByRole("button", { name: /훈련 후.*거리·시간·훈련 내용을 모두 기록/u }).click()
  await page.getByRole("textbox", { name: "거리 (km)" }).fill("8")

  // When
  await page.getByRole("button", { name: /^저장/u }).click()

  // Then
  const receipt = page.getByRole("status")
  await expect(receipt).toContainText("8 km")
  await receipt.getByRole("button", { name: "거리 추이 보기" }).click()
  await expect(page.getByRole("heading", { name: "분석", exact: true })).toBeVisible()
  await expect(page.getByRole("group", { name: "내 기록 분석 항목" }).getByRole("button", { name: "월별 변화", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("region", { name: "최근 4개월 추이" }).locator("summary", { hasText: "월별 수치와 집계 범위 보기" }).click()
  await expect(page.getByRole("region", { name: "최근 4개월 추이" }).getByText(/중앙 거리 8 km/u)).toBeVisible()
  await page.getByRole("group", { name: "내 기록 분석 항목" }).getByRole("button", { name: "훈련량", exact: true }).click()
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
