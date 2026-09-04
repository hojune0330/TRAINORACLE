import { expect, test } from "@playwright/test"
import { stateFixture } from "../src/domain/plan-beta-store.test-fixture"

test("links one explicitly selected plan session to its journal without copying planned intensity", async ({ page }, testInfo) => {
  const browserErrors: string[] = []
  page.on("pageerror", error => browserErrors.push(error.message))
  page.on("console", message => { if (message.type() === "error") browserErrors.push(message.text()) })
  await page.setViewportSize(testInfo.project.name === "mobile-chromium"
    ? { width: 375, height: 667 }
    : { width: 1440, height: 900 })
  const state = stateFixture()
  await page.addInitScript((plan) => {
    window.localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(plan))
  }, state)

  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u }).click()
  await page.getByText("오전 훈련 방법과 기록", { exact: true }).click()
  await page.getByRole("button", { name: "이 훈련 일지 쓰기" }).click()

  await expect(page.getByText("계획 DAY 1 · 오전")).toBeVisible()
  await page.getByRole("button", { name: "계획대로 마쳤어요" }).click()
  await page.getByRole("button", { name: "오전" }).click()
  await page.getByRole("button", { name: /RPE 6,/u }).click()
  await page.getByRole("button", { name: "없어요" }).click()
  await page.getByRole("button", { name: "완료", exact: true }).click()

  await expect(page.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  const stored = await page.evaluate(() => ({
    journal: JSON.parse(window.localStorage.getItem("trainoracle.journal.v1") ?? "[]"),
    plan: JSON.parse(window.localStorage.getItem("trainoracle.plan-beta.v1") ?? "null"),
  }))
  expect(stored.journal).toHaveLength(1)
  expect(stored.journal[0].title).toBe("계획대로 완료")
  expect(stored.journal[0].system).toBe("")
  expect(stored.journal[0].planExecutionRelation).toBe("AS_PLANNED")
  expect(stored.journal[0].plannedSessionLink.plannedSessionId).toMatch(/^sha256:[a-f0-9]{64}$/u)
  expect(JSON.stringify(stored.journal[0].plannedSessionLink)).not.toContain(state.activePlan.candidateId)
  expect(stored.plan.progress).toEqual([])

  const returnedSession = page.getByRole("group", { name: /오전 세션 · 일지에서 돌아온 세션/u })
  await expect(returnedSession).toBeVisible()
  await expect(returnedSession).toBeInViewport()
  await page.getByRole("button", { name: "계획에도 완료 표시", exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(
    window.localStorage.getItem("trainoracle.plan-beta.v1") ?? "null",
  )?.progress)).toEqual([{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }])
  const beforeReview = await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))
  await page.getByRole("button", { name: "다음 계획 조정하기" }).click()
  await page.getByRole("button", { name: /이번 주기 수행 기록을 볼래요/u }).click()
  await expect(page.getByText("계획 RPE와 비교할 수 있는 기록은 1건이에요")).toBeVisible()
  const disclosure = page.getByText("훈련별 비교 근거 1건")
  await disclosure.click()
  await expect(page.getByText("계획 RPE 2-4 · 직접 기록 RPE 6")).toBeVisible()
  await expect(page.getByText("계획보다 높음", { exact: true })).toBeVisible()
  expect((await disclosure.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(beforeReview)
  await page.evaluate(() => document.fonts.ready)
  if (process.env.CAPTURE_PLAN_QA === "1") {
    await expect(page.locator(".saved-toast")).toHaveCount(0, { timeout: 7_000 })
    await page.locator(".plan-adaptation__evidence").scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath("cycle-evidence.png") })
  }
  expect(browserErrors).toEqual([])
})
