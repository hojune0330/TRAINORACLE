import { expect, test } from "@playwright/test"
import { stateFixture } from "../src/domain/plan-beta-store.test-fixture"
import { createInitialPeriodizationContext } from "../src/domain/periodization-lineage"

test("shows the 24-week direction without turning position into an automatic increase", async ({ page }) => {
  const state = stateFixture()
  if (state.version !== 3) throw new Error("V3 fixture required")
  const periodization = createInitialPeriodizationContext(
    state.activePlan.candidateId,
    state.generatedAt,
  )
  if (periodization === null) throw new Error("Periodization fixture required")
  await page.addInitScript((stored) => {
    window.localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(stored))
  }, { ...state, periodization })

  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u }).click()

  await expect(page.getByText("24주 훈련 방향", { exact: true })).toBeVisible()
  await expect(page.getByText(/1\/18번째 계획/u)).toBeVisible()
  await expect(page.getByRole("progressbar", { name: "24주 훈련 방향 진행 위치" }))
    .toHaveAttribute("aria-valuenow", "1")
  await expect(page.getByText(/자동으로 올리지는 않아요/u)).toBeVisible()
})
