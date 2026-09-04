import { expect, test } from "@playwright/test"
import type { PlanSession } from "@impl/plan-generator/types"
import { deriveCandidateId, derivePairId } from "@impl/plan-generator/candidate-identity"
import { stateFixture } from "../src/domain/plan-beta-store.test-fixture"

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
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u }).click()
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole("button", { name: "다음 날짜" }).click()
  }
  await page.getByText("오후 훈련 방법과 기록", { exact: true }).click()
  await page.getByRole("button", { name: "이 훈련 일지 쓰기" }).click()
  await expect(page.getByText("계획 DAY 5 · 오후")).toBeVisible()
  await page.getByRole("button", { name: /뒤로/u }).click()

  const returnedSession = page.getByRole("group", { name: /오후 세션 · 일지에서 돌아온 세션/u })
  await expect(returnedSession).toBeVisible()
  await expect(returnedSession).toBeInViewport()
  await expect(page.getByText("일지를 저장했어요. 계획의 진행 기록은 별도예요.")).not.toBeVisible()
  await expect.poll(() => page.evaluate(() => ({
    journal: JSON.parse(window.localStorage.getItem("trainoracle.journal.v1") ?? "[]"),
    progress: JSON.parse(window.localStorage.getItem("trainoracle.plan-beta.v1") ?? "null")?.progress,
  }))).toEqual({ journal: [], progress: [] })
})

for (const detailed of [false, true]) {
test(`returning from a ${detailed ? "detailed" : "quick"} DAY 5 PM journal keeps plan progress explicit`, async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 375, height: 667 })
  await page.addInitScript((plan) => {
    window.localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(plan))
  }, stateWithDayFivePm())

  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" })
    .getByRole("button", { name: /^훈련 계획/u }).click()
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole("button", { name: "다음 날짜" }).click()
  }
  await page.getByText("오후 훈련 방법과 기록", { exact: true }).click()
  await page.getByRole("button", { name: "이 훈련 일지 쓰기" }).click()
  await expect(page.getByText("계획 DAY 5 · 오후")).toBeVisible()
  await page.getByRole("button", { name: "계획대로 마쳤어요" }).click()
  await page.getByRole("button", { name: "오후" }).click()
  await page.getByRole("button", { name: /RPE 6,/u }).click()
  await page.getByRole("button", { name: "없어요" }).click()
  if (detailed) {
    await page.getByRole("button", { name: "일지 더 쓰기", exact: true }).click()
    await page.getByLabel("세션 제목").fill("합성 훈련 기록")
    await page.getByRole("button", { name: /수정 저장/u }).click()
  } else {
    await page.getByRole("button", { name: "완료", exact: true }).click()
  }

  const returnedSession = page.getByRole("group", { name: /오후 세션 · 일지에서 돌아온 세션/u })
  await expect(returnedSession).toBeVisible()
  await expect(returnedSession).toBeInViewport()
  await expect(page.getByText("일지를 저장했어요. 계획의 진행 기록은 별도예요.")).toBeVisible()
  await expect(page.getByRole("button", { name: "계획에도 완료 표시" })).toBeVisible()
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
  await page.screenshot({ path: testInfo.outputPath(`day5-pm-${detailed ? "detailed" : "quick"}-return.png`) })
  await page.getByRole("button", { name: "계획에도 완료 표시" }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1")!).progress))
    .toEqual([{ sessionDay: 5, sessionSlot: "PM", state: "COMPLETED" }])
})
}
