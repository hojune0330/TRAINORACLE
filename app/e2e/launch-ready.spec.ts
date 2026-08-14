import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

async function answerMinimumPlanQuestions(page: Page): Promise<void> {
  await page.getByRole("button", { name: /800m.*1500m/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /지속 페이스.*LT/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await page.getByRole("button", { name: /날마다 달라요/u }).click()
  await page.getByRole("button", { name: "하루 한 번 운동" }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
}

async function expectCanonicalPlanCandidates(page: Page): Promise<void> {
  await expect(page.getByRole("heading", {
    name: "두 계획에서 하나를 골라보세요",
  })).toBeVisible()
  await expect(page.locator(".plan-candidate")).toHaveCount(2)
  await expect(page.getByRole("button", { name: /선택하기/u })).toHaveCount(2)
  await expect(page.getByText(/9.5일/u).first()).toBeVisible()
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
    const detail = document.querySelector<HTMLElement>(".term-help__detail")
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

test("routes a first visitor from home into the matching journal", async ({ page }) => {
  // Given
  await page.goto("/")

  // When — home CTA goes straight to the post-session form
  await page.getByRole("button", { name: "오늘 기록하기" }).click()
  await expect(page.getByRole("heading", { name: "훈련 후 · 기록" })).toBeVisible()

  // back to home via the tab bar, then rest-day entry via the rest-entry button
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈" }).click()
  await page.getByRole("button", { name: "하루 마무리 기록하기" }).click()

  // Then
  await expect(page.getByRole("heading", { name: /회복.*하루 마무리/u })).toBeVisible()
})

test("generates selectable 9.5-day candidates from first-screen intake", async ({ page }) => {
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

test("generates a bounded two-a-day 9.5-day candidate", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await page.getByRole("button", { name: /5km/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /반복 인터벌.*VO2/u }).click()
  await page.getByRole("button", { name: "매일" }).click()
  await page.getByRole("button", { name: /날마다 달라요/u }).click()
  await page.getByRole("button", { name: "하루 두 번 운동할게요" }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()

  await expectCanonicalPlanCandidates(page)
  await expect(page.getByText(/오후 회복/u).first()).toBeVisible()
})

test("keeps an evening two-a-day plan after selection and reload", async ({ page }) => {
  // Given
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await page.getByRole("button", { name: /5km/u }).click()
  await page.getByRole("button", { name: /고등부/u }).click()
  await page.getByRole("button", { name: /훈련 계획에 맞춰 달려 본 경험/u }).click()
  await page.getByRole("button", { name: /반복 인터벌.*VO2/u }).click()
  await page.getByRole("button", { name: "매일" }).click()
  await page.getByRole("button", { name: /저녁에 운동해요/u }).click()
  await page.getByRole("button", { name: "하루 두 번 운동할게요" }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()

  // When
  await page.getByRole("button", { name: /선택하기/u }).first().click()

  // Then
  await expect(page.getByRole("heading", { name: /9\.5일 계획/u })).toBeVisible()
  await expect(page.getByRole("group").filter({
    hasText: "오후",
  }).filter({
    hasText: "반복 인터벌",
  })).not.toHaveCount(0)
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
  await expect(page.getByRole("heading", { name: /9\.5일 계획/u })).toBeVisible()
})

test("reads a detailed training notation without creating a plan", async ({ page }) => {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await page.getByRole("button", { name: "훈련표 표기 읽기" }).click()
  await page.getByRole("textbox", { name: "훈련표 표기" }).fill(
    "2×(10×400m) @5000m RP · r60″ · R3′",
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
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /기록/u }).click()
  await page.getByRole("button", { name: /훈련 후.*방금 끝낸/u }).click()
  await page.getByRole("textbox", { name: "거리 (km)" }).fill("8")

  // When
  await page.getByRole("button", { name: /^저장/u }).click()

  // Then
  const receipt = page.getByRole("status")
  await expect(receipt).toContainText("8 km")
  await receipt.getByRole("button", { name: "거리 추이 보기" }).click()
  await expect(page.getByRole("heading", { name: "추이" })).toBeVisible()
  const weekly = page.getByRole("region", { name: "최근 4주 거리" })
  await expect(weekly.getByText(/^8$/u)).toBeVisible()
  await expect(weekly.getByText(/집계 사용 1건/u)).toBeVisible()
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
