import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

async function answerMinimumPlanQuestions(page: Page): Promise<void> {
  await page.getByRole("button", { name: /800m.*1500m/u }).click()
  await page.getByRole("button", { name: /훈련 경험 있음/u }).click()
  await page.getByRole("button", { name: /^3일/u }).click()
  await page.getByRole("button", { name: /9일 계획.*권장/u }).click()
  await page.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }).click()
}

test("routes a first visitor from one context choice into the matching journal", async ({ page }) => {
  // Given
  await page.goto("/?app=1")

  // When
  await page.getByRole("button", { name: "다른 시작 방법 보기" }).click()
  await expect(page.getByRole("button", { name: "이전 화면으로" })).toBeInViewport()
  await page.getByRole("button", { name: /통증.*컨디션을 남기고 싶어요/u }).click()

  // Then
  await expect(page.getByRole("heading", { name: /회복.*하루 마무리/u })).toBeVisible()
})

test("creates and selects a profile-only beta plan from the first screen", async ({ page }) => {
  // Given
  await page.goto("/?app=1")

  // When
  await page.getByRole("button", { name: "훈련계획 후보 만들기" }).click()
  await answerMinimumPlanQuestions(page)

  // Then
  await expect(page.getByRole("heading", { name: "두 후보를 비교해보세요" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "균형형" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "보수형" })).toBeVisible()

  // When
  await page.getByRole("button", { name: "균형형 선택하기" }).click()

  // Then
  await expect(page.getByRole("heading", { name: "균형형 9일 계획" })).toBeVisible()
  await expect(page.getByText(/프로필 기반.*제한 신뢰도/u)).toBeVisible()
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
  await page.getByRole("button", { name: "훈련계획 후보 만들기" }).click()

  await answerMinimumPlanQuestions(page)

  await expect(page.getByRole("heading", { name: "지금은 계획을 멈췄어요" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "균형형" })).toHaveCount(0)
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
  await expect(page.getByText("8km · 전체 누적")).toBeVisible()
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
