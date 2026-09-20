import { describe, expect, it } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import { projectInstantToday } from "./instant-plan-today"

function fixture() {
  const state = stateFixture()
  if (state.version !== 3) throw new Error("Expected V3 fixture")
  return { ...state, intake: { ...state.intake, startDate: "2026-09-20" },
    activePlan: { ...state.activePlan, sessions: [state.activePlan.sessions[0]!, { ...state.activePlan.sessions[0]!, slot: "PM" as const }] } }
}
describe("selected plan today projection", () => {
  it("shows the actual first date before the plan starts", () => {
    expect(projectInstantToday(fixture(), "2026-09-19")).toMatchObject({ state: "BEFORE_START", dateLabel: "2026-09-20" })
  })
  it("keeps AM and PM separate and missing observations are not zero or skipped", () => {
    const result = projectInstantToday(fixture(), "2026-09-20")
    expect(result.state).toBe("SCHEDULED")
    expect(result.sessions.map(item => [item.slotLabel, item.recorded])).toEqual([["오전", false], ["오후", false]])
    expect(result.sessions[0]?.steps[0]?.instruction).toContain("20~30분")
    expect(result.sessions[0]?.steps[0]?.instruction).toContain("RPE 2~4")
  })
  it.each(["COMPLETED", "RESTED", "SKIPPED"] as const)("%s in AM does not complete PM", progress => {
    const state = fixture()
    const result = projectInstantToday({ ...state, progress: [{ sessionDay: 1, sessionSlot: "AM", state: progress }] }, "2026-09-20")
    expect(result.state).toBe("PARTLY_RECORDED")
    expect(result.sessions[1]?.recorded).toBe(false)
  })
  it("pain review is not a normal executable day", () => {
    expect(projectInstantToday({ ...fixture(), progress: [{ sessionDay: 1, sessionSlot: "AM", state: "PAIN_CHECKIN" }] }, "2026-09-20"))
      .toMatchObject({ state: "UNAVAILABLE", sessions: [] })
  })
  it("a linked AM journal counts as a record without marking PM or progress complete", () => {
    const state = fixture()
    const result = projectInstantToday(state, "2026-09-20", ["1:AM"])
    expect(result.state).toBe("PARTLY_RECORDED")
    expect(result.sessions.map(session => session.recorded)).toEqual([true, false])
    expect(state.progress).toEqual([])
  })
  it("does not call a missing date REST or shift missed workouts", () => {
    expect(projectInstantToday(fixture(), "2026-09-21")).toMatchObject({ state: "UNAVAILABLE", sessions: [] })
  })
  it("period end is not proof of performance", () => {
    expect(projectInstantToday(fixture(), "2026-09-29")).toMatchObject({ state: "COMPLETED", sessions: [] })
  })
  it("invalid dates cannot yield a plan", () => {
    expect(projectInstantToday(fixture(), "invalid").state).toBe("UNAVAILABLE")
  })
})
