import { expect, test } from "@playwright/test"
import { completeDetailedPlan, enterPlanWithoutRecord } from "./plan-flow"

test.use({ serviceWorkers: "block" })

async function resetLocalState(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.clear())
}

async function expectActiveQuestionAtReadingPosition(page: import("@playwright/test").Page): Promise<void> {
  await expect.poll(() => page.locator(".plan-eyebrow").evaluate((element) => {
    const scrollRegion = element.closest<HTMLElement>(".app-scroll-region")
    if (scrollRegion === null) return false

    const targetRect = element.getBoundingClientRect()
    const regionRect = scrollRegion.getBoundingClientRect()
    const scrollMargin = Number.parseFloat(window.getComputedStyle(element).scrollMarginTop) || 0
    const aligned = Math.abs(targetRect.top - regionRect.top - scrollMargin) <= 4
    const cannotScrollFurther = scrollRegion.scrollTop >= scrollRegion.scrollHeight - scrollRegion.clientHeight - 2
    const readableTopLimit = window.innerWidth <= 600 ? 64 : window.innerHeight * 0.25
    const choices = element.closest(".plan-intake")?.querySelector(".plan-choice-list")
    const choicesBottom = choices?.getBoundingClientRect().bottom ?? Infinity

    return targetRect.top >= regionRect.top
      && ((targetRect.top <= readableTopLimit && aligned)
        || (cannotScrollFurther && choicesBottom <= regionRect.bottom))
  })).toBe(true)
}

test("moves from a choice to the next question and gives a clear journal save confirmation", async ({ page }, testInfo) => {
  await resetLocalState(page)
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련" }).click()

  await expect(page.getByRole("heading", { name: "어떤 종목을 준비하세요?" })).toBeVisible()
  await enterPlanWithoutRecord(page)
  await expect(page.getByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
  await expectActiveQuestionAtReadingPosition(page)
  const nextAnimation = await page.locator(".plan-intake").evaluate((element) => getComputedStyle(element).animationName)
  expect(nextAnimation).toBe(testInfo.project.name === "reduced-motion" ? "none" : "flow-stage-enter")
  const activePlanBefore = await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))
  expect(activePlanBefore).toBeNull()

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "기록하기" }).click()
  await expect(page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })).toBeVisible()
  await page.getByRole("button", { name: /훈련 후.*운동별로 자세히/u }).click()
  await expect(page.getByRole("heading", { name: "훈련 후 · 기록" })).toBeVisible()
  await page.getByRole("textbox", { name: "거리 (km)" }).fill("8")
  await page.getByRole("button", { name: /^저장/u }).click()

  const receipt = page.locator(".saved-toast")
  await expect(receipt).toBeVisible()
  await expect(receipt.locator(".saved-toast__check")).toHaveCount(1)
  await expect(receipt).toContainText("저장")
  const savedEntries = await page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.journal.v1")
    return raw === null ? [] : JSON.parse(raw)
  })
  expect(savedEntries).toHaveLength(1)
  expect(savedEntries[0]).toMatchObject({ kind: "post-session", distanceKm: "8" })
  expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(activePlanBefore)
})

test("a high-school athlete can make a ten-day two-a-day plan without prior records", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "375px release persona")
  await resetLocalState(page)
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련" }).click()
  await completeDetailedPlan(page, { frame: /^10일 계획 받기/u, event: /^1500m/u, division: /고등부/u, experience: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u, days: /^매일/u, focus: /조금 힘들게 꾸준히.*LT/u, time: /날마다 달라요/u, twice: true })

  await expect(page.getByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
  await expect(page.getByRole("group", { name: /훈련 2개/u }).first()).toBeVisible()
  await expect(page.getByLabel("10일 훈련 일정").first()).toContainText(/MAIN|REC|BASE/u)
  await page.getByRole("group", { name: "계획 확인·변경" })
    .getByRole("button", { name: "추천 근거", exact: true }).click()
  await expect(page.getByRole("region", { name: "두 계획 핵심 비교" })).toContainText("조금 힘들게 꾸준히 · LT")
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true)
})

test("a self-directed runner with no journal can still reach an RPE plan", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "375px release persona")
  await resetLocalState(page)
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련" }).click()
  await completeDetailedPlan(page, { frame: /^7일만 먼저 받기/u, event: /^5000m/u, division: /일반부/u, experience: /훈련 계획에 맞춰 달려 본 경험이 있어요/u, days: /^3일/u, focus: /편하게 오래.*BASE/u, time: /저녁에 운동해요/u })

  await expect(page.getByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
  await page.getByText("계획안 A 설명·시간 합계", { exact: true }).click()
  await expect(page.getByText("RPE 기준 실행 안내").first()).toBeVisible()
  await page.getByRole("group", { name: "계획 확인·변경" })
    .getByRole("button", { name: "추천 근거", exact: true }).click()
  await expect(page.getByText("기준 기록 없이 만든 계획")).toBeVisible()
  await expect(page.getByText(/확인한 기준 기록이 없어 개인 기록과 일지 수치는 이번 계획 계산에 사용하지 않았어요/u)).toBeVisible()
})
