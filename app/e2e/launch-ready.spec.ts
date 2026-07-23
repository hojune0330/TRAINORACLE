import { expect, test } from "@playwright/test"

test("routes a first visitor from one context choice into the matching journal", async ({ page }) => {
  // Given
  await page.goto("/?app=1")

  // When
  await page.getByRole("button", { name: "무엇을 할 수 있나요?" }).click()
  await expect(page.getByRole("button", { name: "이전 화면으로" })).toBeInViewport()
  await page.getByRole("button", { name: /통증.*컨디션을 남기고 싶어요/u }).click()

  // Then
  await expect(page.getByRole("heading", { name: /회복.*하루 마무리/u })).toBeVisible()
})

test("keeps plan interest honest and collects no request", async ({ page }) => {
  // Given
  await page.goto("/?app=1")

  // When
  await page.getByRole("button", { name: "무엇을 할 수 있나요?" }).click()
  await page.getByRole("button", { name: /훈련 계획이 궁금해요/u }).click()

  // Then
  await expect(page.getByRole("heading", { name: "훈련계획은 준비 중이에요" })).toBeVisible()
  await expect(page.getByRole("textbox")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "오늘 기록부터 남기기" })).toBeVisible()
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
