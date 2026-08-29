import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { selectNineDayProjection } from "./plan-flow"
import { expectActivePlanHeading, openActiveSessionDetails } from "./active-plan-flow"

async function answerMinimumPlanQuestions(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^1500m\b/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  const continueButton = page.getByRole("button", { name: "내 계획 완성하기" })
  if (await continueButton.count() === 0) return
  await continueButton.click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /날마다 달라요/u }).click()
  await page.getByRole("button", { name: "하루 한 번 운동" }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()
}

async function expectCanonicalPlanCandidates(page: Page): Promise<void> {
  await expect(page.getByRole("heading", {
    name: "두 계획에서 하나를 골라보세요",
  })).toBeVisible()
  await expect(page.locator(".plan-candidate")).toHaveCount(2)
  await expect(page.getByRole("button", { name: /선택하기/u })).toHaveCount(2)
  await expect(page.getByText(/9일/u).first()).toBeVisible()
  await expect.poll(async () => page.evaluate(
    () => window.localStorage.getItem("trainoracle.plan-beta.v1"),
  )).toBeNull()
}

test("keeps plan help inside the narrow scroll region", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
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
    name: "달리기 일지를 남기고, 내 기록으로 훈련 계획을 받아요.",
  })).toBeVisible()

  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await expect(page.getByRole("heading", { name: "훈련 후 · 기록" })).toBeVisible()
  await page.getByRole("button", { name: /^저장/u }).click()

  await expect.poll(async () => page.evaluate(() => {
    const stored = localStorage.getItem("trainoracle.journal.v1")
    if (stored === null) return 0
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.length : -1
  })).toBe(1)
  await expect(page.getByRole("heading", { name: "내 기록" })).toBeVisible()

  const eveningEntry = page.getByRole("button", { name: "하루 마무리 기록하기" })
  await expect(eveningEntry).toBeVisible()
  await eveningEntry.click()
  await expect(page.getByRole("heading", { name: /회복.*하루 마무리/u })).toBeVisible()
})

test("generates selectable 9-day candidates from first-screen intake", async ({ page }) => {
  // Given
  await page.goto("/?app=1")

  // When
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await answerMinimumPlanQuestions(page)

  // Then
  await expectCanonicalPlanCandidates(page)
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )).toBe(true)
})

test("generates a bounded two-a-day 9-day candidate", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await page.getByRole("button", { name: /^5000m\b/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /강한 유산소 반복.*VO₂/u }).click()
  await page.getByRole("button", { name: /^RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: "매일" }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /날마다 달라요/u }).click()
  await page.getByRole("button", { name: "하루 두 번 운동할게요" }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()

  await expectCanonicalPlanCandidates(page)
  await expect(page.getByText(/오후 회복/u).first()).toBeVisible()
})

test("keeps an evening two-a-day plan after selection and reload", async ({ page }) => {
  // Given
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await page.getByRole("button", { name: /^5000m\b/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
  await page.getByRole("button", { name: "내 계획 완성하기" }).click()
  await page.getByRole("button", { name: /강한 유산소 반복.*VO₂/u }).click()
  await page.getByRole("button", { name: /^RPE 기준으로 받기/u }).click()
  await page.getByRole("button", { name: "매일" }).click()
  await selectNineDayProjection(page)
  await page.getByRole("button", { name: /저녁에 운동해요/u }).click()
  await page.getByRole("button", { name: "하루 두 번 운동할게요" }).click()
  await page.getByRole("button", { name: "날짜 없이 계획안 보기" }).click()

  // When
  await page.getByRole("button", { name: /선택하기/u }).first().click()

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
  await expect(page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", {
    name: /훈련 계획 저장된 계획/u,
  })).toBeVisible()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "계획" }).click()
  await expectActivePlanHeading(page)
  const reloadedQualitySession = await openActiveSessionDetails(page, /강한 유산소 반복/u)
  await expect(reloadedQualitySession.getByText(/거리\u2060·\u2060목표\s페이스는 지정하지 않음/u).first()).toBeVisible()
  await expect(reloadedQualitySession.getByRole("list", { name: "훈련 실행 순서" }).first()).toBeVisible()
})

test("reads a detailed training notation without creating a plan", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
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

  await answerMinimumPlanQuestions(page)

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
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "경기기록" }).click()
  await page.getByRole("button", { name: /훈련 후.*방금 끝낸/u }).click()
  await page.getByRole("textbox", { name: "거리 (km)" }).fill("8")

  // When
  await page.getByRole("button", { name: /^저장/u }).click()

  // Then
  const receipt = page.getByRole("status")
  await expect(receipt).toContainText("8 km")
  await receipt.getByRole("button", { name: "거리 추이 보기" }).click()
  await expect(page.getByRole("heading", { name: "분석" })).toBeVisible()
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
