import { expect, test } from "@playwright/test"
import { stateFixture } from "../src/domain/plan-beta-store.test-fixture"

test("links one explicitly selected plan session to its journal without copying planned intensity", async ({ page }) => {
  const state = stateFixture()
  await page.addInitScript((plan) => {
    window.localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(plan))
  }, state)

  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u }).click()
  await page.getByText("오전 훈련 방법과 기록", { exact: true }).click()
  await page.getByRole("button", { name: "이 훈련 일지 쓰기" }).click()

  await expect(page.getByText("계획의 DAY 1 오전 훈련")).toBeVisible()
  await expect(page.getByRole("button", { name: "BASE 기초 지구력" }))
    .toHaveAttribute("aria-pressed", "false")
  await page.getByRole("textbox", { name: "세션 제목" }).fill("계획과 연결한 실제 기록")
  await page.getByRole("button", { name: /저장/u }).click()

  await expect(page.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  const stored = await page.evaluate(() => ({
    journal: JSON.parse(window.localStorage.getItem("trainoracle.journal.v1") ?? "[]"),
    plan: JSON.parse(window.localStorage.getItem("trainoracle.plan-beta.v1") ?? "null"),
  }))
  expect(stored.journal).toHaveLength(1)
  expect(stored.journal[0].title).toBe("계획과 연결한 실제 기록")
  expect(stored.journal[0].system).toBe("")
  expect(stored.journal[0].plannedSessionLink.plannedSessionId).toMatch(/^sha256:[a-f0-9]{64}$/u)
  expect(JSON.stringify(stored.journal[0].plannedSessionLink)).not.toContain(state.activePlan.candidateId)
  expect(stored.plan.progress).toEqual([])
})
