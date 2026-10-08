import { expect, test } from "@playwright/test"
import type { PlanSession } from "@impl/plan-generator/types"
import { deriveCandidateId, derivePairId } from "@impl/plan-generator/candidate-identity"
import { stateFixture } from "../src/domain/plan-beta-store.test-fixture"
import { openActivePlanCards } from "./active-plan-flow"
import { completeQuickPlan } from "./plan-flow"

test.use({ serviceWorkers: "block" })
test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const host = new URL(route.request().url()).hostname
    return host === "127.0.0.1" || host === "localhost" ? route.continue() : route.abort()
  })
  await page.clock.setFixedTime(new Date("2026-07-24T03:00:00Z"))
})

const dayFivePm: PlanSession = {
  day: 5,
  slot: "PM",
  role: "EASY",
  plannedEnergyIntent: "RECOVERY_INTENT",
  prescription: {
    kind: "RPE_TIME_RANGE",
    rpe: { minimum: 1, maximum: 2 },
    durationMinutes: { minimum: 15, maximum: 25 },
  },
}

function stateWithDayFivePm() {
  const state = stateFixture()
  if (state.version !== 3) throw new Error("Expected a V3 plan fixture")
  if (!("formationKind" in state.activePlan.frame)) throw new Error("Expected a canonical frame fixture")
  const sessions = [...state.activePlan.sessions, dayFivePm]
  const projection = {
    kind: state.activePlan.candidateKind,
    eventDistanceM: state.activePlan.eventDistanceM,
    selectedDetailedTemplateRef: state.activePlan.selectedDetailedTemplateRef,
    selectedEnergyIntent: state.activePlan.selectedEnergyIntent,
    sourceMode: state.activePlan.sourceMode,
    selectionAuthority: "SELF" as const,
    frame: state.activePlan.frame,
    sessions,
  }
  const candidateId = deriveCandidateId(state.activePlan.candidateId, projection)
  const alternateId = deriveCandidateId(state.activePlan.candidateId, { ...projection, kind: "CONSERVATIVE" })
  return {
    ...state,
    activePlan: {
      ...state.activePlan,
      candidateId,
      pairId: derivePairId(state.activePlan.pairId, candidateId, alternateId),
      sessions,
    },
  }
}

test("returning from a cancelled DAY 5 PM journal restores its slot without a saved fact or progress mark", async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 375, height: 667 })
  await page.addInitScript((plan) => {
    window.localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(plan))
  }, stateWithDayFivePm())

  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await openActivePlanCards(page)
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole("button", { name: "다음 날짜" }).click()
  }
  await page.getByText("오후 훈련 방법과 기록", { exact: true }).click()
  await page.getByRole("group", { name: /^7월 28일 화요일 오후 세션/u }).getByRole("button", { name: "이 훈련 일지 쓰기" }).click()
  await expect(page.getByText("계획 5일차 · 오후")).toBeVisible()
  await page.getByRole("button", { name: /뒤로/u }).click()

  const returnedSession = page.getByRole("dialog", { name: "2026년 7월 28일 화요일" })
    .getByRole("group", { name: /오후 세션 · 일지에서 돌아온 세션/u })
  await expect(returnedSession).toBeVisible()
  await expect(returnedSession).toBeInViewport()
  await expect(page.getByText("일지를 연결했어요. 수행 결과와 계획을 함께 확인할 수 있어요.")).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => ({
    journal: JSON.parse(window.localStorage.getItem("trainoracle.journal.v1") ?? "[]"),
    progress: JSON.parse(window.localStorage.getItem("trainoracle.plan-beta.v1") ?? "null")?.progress,
  }))).toEqual({ journal: [], progress: [] })
})

for (const completion of ["done", "native-back", "detailed"] as const) {
const detailed = completion === "detailed"
test(`returning from a ${detailed ? "detailed" : completion === "native-back" ? "quick native-Back" : "quick"} DAY 5 PM journal keeps plan progress explicit`, async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 375, height: 667 })
  await page.addInitScript((plan) => {
    window.localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(plan))
  }, stateWithDayFivePm())

  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await openActivePlanCards(page)
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole("button", { name: "다음 날짜" }).click()
  }
  await page.getByText("오후 훈련 방법과 기록", { exact: true }).click()
  await page.getByRole("group", { name: /^7월 28일 화요일 오후 세션/u }).getByRole("button", { name: "이 훈련 일지 쓰기" }).click()
  await expect(page.getByText("계획 5일차 · 오후")).toBeVisible()
  await page.getByRole("button", { name: "계획대로 마쳤어요" }).click()
  await page.getByRole("button", { name: "오후" }).click()
  await page.getByRole("button", { name: /힘든 정도 6\/10,/u }).click()
  await page.getByRole("button", { name: "없어요" }).click()
  await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await expect(page.locator(".journal-save-result")).toHaveCount(1)
  await expect(page.locator("[data-toast-priority]")).toHaveCount(0)
  if (detailed) {
    await page.getByText("내용 추가·수정", { exact: true }).click()
    await page.getByRole("button", { name: "일지 더 쓰기", exact: true }).click()
    await page.getByRole("button", { name: "실제로 한 운동 수정", exact: true }).click()
    await page.getByLabel("세션 제목").fill("합성 훈련 기록")
    await page.getByRole("button", { name: "입력 확인으로", exact: true }).click()
    await page.getByRole("button", { name: /수정 저장/u }).click()
    await expect(page.locator(".journal-save-result")).toHaveCount(1)
    await expect(page.locator(".plan-day-reader[open]")).toHaveCount(0)
    await page.getByRole("button", { name: "닫기", exact: true }).click()
    await expect(page.locator(".plan-day-reader[open]")).toHaveCount(1)
  } else if (completion === "native-back") {
    await page.goBack()
  } else {
    await page.getByRole("button", { name: "완료", exact: true }).click()
  }

  const reader = page.getByRole("dialog", { name: "2026년 7월 28일 화요일" })
  const returnedSession = reader.getByRole("group", { name: /오후 세션 · 일지에서 돌아온 세션/u })
  await expect(returnedSession).toBeVisible()
  await expect(returnedSession).toBeInViewport()
  if (await returnedSession.locator("[data-session-records]").getAttribute("open") === null) {
    await returnedSession.getByText("일지·진행 기록", { exact: true }).click()
  }
  await expect(returnedSession.getByText("일지를 연결했어요. 수행 결과와 계획을 함께 확인할 수 있어요.")).toBeVisible()
  await expect(returnedSession.getByRole("button", { name: "계획에도 완료 표시" })).toBeVisible()
  await expect.poll(() => page.evaluate(() => ({
    journal: JSON.parse(window.localStorage.getItem("trainoracle.journal.v1") ?? "[]"),
    progress: JSON.parse(window.localStorage.getItem("trainoracle.plan-beta.v1") ?? "null")?.progress,
  }))).toMatchObject({
    journal: [{
      activityOutcome: "COMPLETED",
      activitySlot: "PM",
      plannedSessionLink: { sessionDay: 5, sessionSlot: "PM" },
    }],
    progress: [],
  })
  await page.screenshot({ path: testInfo.outputPath(`task-results-day5-pm-${completion}-return.png`) })
  await returnedSession.getByRole("button", { name: "계획에도 완료 표시" }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1")!).progress))
    .toEqual([{ sessionDay: 5, sessionSlot: "PM", state: "COMPLETED" }])
  if (!detailed) {
    await page.goBack()
    await expect(reader).not.toBeVisible()
    await expect(page.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.journal.v1") ?? "[]").length)).toBe(1)
  }
})
}

test("the first workout precedes the calendar and editing isolates its close action and tools", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
  await completeQuickPlan(page)
  const first = page.getByRole("region", { name: "첫 훈련 구성" })
  const calendar = page.getByRole("region", { name: "이번 일정" })
  await expect(first).toBeVisible()
  await expect(first.getByText("총 시간", { exact: true })).toBeVisible()
  expect(await first.evaluate((node, selector) => {
    const schedule = document.querySelector(selector)
    return schedule !== null && node.compareDocumentPosition(schedule) === Node.DOCUMENT_POSITION_FOLLOWING
  }, '[aria-label="이번 일정"]')).toBe(true)
  await expect(calendar).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("task-results-first-workout-summary-375.png"), fullPage: true })
  await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()
  await page.getByRole("button", { name: "계획 수정", exact: true }).click()
  await expect(page.getByRole("button", { name: "개인 계획 파일 불러오기" })).toHaveCount(0)
  await page.getByRole("button", { name: "훈련 날짜 바꾸기", exact: true }).click()
  await expect(page.getByRole("heading", { name: "훈련 날짜 바꾸기", exact: true })).toBeFocused()
  const close = page.getByRole("region", { name: "훈련 날짜 바꾸기", exact: true })
    .getByRole("button", { name: "닫기", exact: true })
  await expect(close).toBeVisible()
  expect(await close.evaluate(node => getComputedStyle(node).whiteSpace)).toBe("nowrap")
  expect((await close.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await expect(page.getByRole("button", { name: "개인 계획 파일 불러오기" })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const original = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
  await page.screenshot({ path: testInfo.outputPath("task-results-focused-edit-close-375.png"), fullPage: true })
  await close.click()
  await expect(page.getByRole("button", { name: "개인 계획 파일 불러오기" })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(original)
})
