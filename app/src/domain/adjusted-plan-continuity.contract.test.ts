import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { adjustedPlanSelectionFixture } from "./adjusted-plan-selection.test-fixtures"
import { selectAdjustedPlanForActivation } from "./adjusted-plan-selection"
import { encodeStoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import { prepareAdjustedNextFrame } from "./adjusted-plan-continuity"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { isoShift } from "./dates"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import type { StoredPlanProgress } from "./plan-beta-schema"
import type { AdjustedFixtureSchedule } from "./adjusted-method-resolution.test-fixtures"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

function setup(outcomes: "complete" | "missing" | "pain" = "complete", schedule: AdjustedFixtureSchedule = {}) {
  const { request, policy, retained } = adjustedPlanSelectionFixture(schedule)
  const selected = selectAdjustedPlanForActivation(request, [policy], TODAY)
  if (selected.kind !== "selected_adjusted") throw Error(selected.code)
  const sessions = selected.state.activePlan.sessions.filter(session => session.role !== "REST")
  const progress: StoredPlanProgress[] = outcomes === "missing" ? [] : sessions.map((session, i) => ({
    sessionDay: session.day, sessionSlot: session.slot,
    state: outcomes === "pain" && i === 0 ? "PAIN_CHECKIN" : i === 0 ? "COMPLETED" : "SKIPPED",
  }))
  const encoded = encodeStoredAdjustedPlanState(selected.state, progress, TODAY.toISOString(), retained, TODAY)
  if (encoded.kind !== "encoded") throw Error("Invalid fixture")
  const start = selected.state.intake.startDate!
  return { state: encoded.state, retained, start, sessions,
    input: { previous: encoded.state, expectedFingerprint: encoded.state.contentFingerprint,
      nextStartDate: start, currentCheck: "NO_KNOWN_RISK" as const },
    at: new Date(`${start}T12:00:00`),
  }
}

it("preserves lineage, advances one frame and passes explicit outcomes without writes", () => {
  const { input, retained, at, state, sessions } = setup()
  const before = JSON.stringify(input)
  const storageBefore = Object.entries(localStorage)
  const result = prepareAdjustedNextFrame(input, retained, at)
  expect(result.kind).toBe("prepared")
  if (result.kind !== "prepared") throw Error(result.code)
  expect(result.context).toMatchObject({ executionAuthority: "NONE", storageState: "NOT_SAVED",
    predecessorFingerprint: state.contentFingerprint, missingRequiredOutcomes: 0,
    completionBasis: "EXPLICIT_OUTCOMES", periodization: {
      programLineageId: state.selection.periodization.programLineageId,
      frameOrdinal: 2, source: "ROLLED_FORWARD", startedAt: state.selection.periodization.startedAt,
    } })
  expect(result.context.continuity.progressStateCounts).toEqual([
    { state: "COMPLETED", count: 1 }, { state: "RESTED", count: 0 },
    { state: "SKIPPED", count: sessions.length - 1 }, { state: "PAIN_CHECKIN", count: 0 },
  ])
  expect(JSON.stringify(input)).toBe(before)
  expect(Object.entries(localStorage)).toEqual(storageBefore)
})

it("allows elapsed displayed frames without fabricating completed sessions", () => {
  const { input, state, retained, start, sessions } = setup("missing")
  expect(prepareAdjustedNextFrame(input, retained, new Date(`${start}T12:00:00`)))
    .toMatchObject({ kind: "rejected", code: "INCOMPLETE_FRAME" })
  const finalDay = Math.max(...state.selection.activePlan.sessions.map(session => session.day))
  const lastDate = isoShift(start, finalDay - 1)
  expect(prepareAdjustedNextFrame({ ...input, nextStartDate: lastDate }, retained, new Date(`${lastDate}T12:00:00`)))
    .toMatchObject({ code: "INCOMPLETE_FRAME" })
  const next = isoShift(lastDate, 1)
  const result = prepareAdjustedNextFrame({ ...input, nextStartDate: next }, retained, new Date(`${next}T12:00:00`))
  expect(result).toMatchObject({ kind: "prepared", context: {
    completionBasis: "DISPLAYED_FRAME_ELAPSED", missingRequiredOutcomes: sessions.length,
  } })
  if (result.kind === "prepared") expect(result.context.continuity.progressStateCounts.every(item => item.count === 0)).toBe(true)
})

it("retains pain hold even when the current answer says no known risk", () => {
  const { input, retained, at } = setup("pain")
  expect(prepareAdjustedNextFrame(input, retained, at)).toMatchObject({ code: "ACTIVE_HOLD" })
})

it("rejects current risk, stale progress, missing retained review and future or backdated contexts", () => {
  const { input, retained, at, start } = setup()
  expect(prepareAdjustedNextFrame({ ...input, currentCheck: "REVIEW_REQUIRED" }, retained, at).kind).toBe("rejected")
  expect(prepareAdjustedNextFrame({ ...input, expectedFingerprint: `sha256:${"0".repeat(64)}` }, retained, at))
    .toMatchObject({ code: "STALE_BASE" })
  expect(prepareAdjustedNextFrame(input, [], at)).toMatchObject({ code: "INVALID_STORED_PLAN" })
  expect(prepareAdjustedNextFrame(input, retained, TODAY)).toMatchObject({ code: "FRAME_NOT_STARTED" })
  expect(prepareAdjustedNextFrame({ ...input, nextStartDate: isoShift(start, -1) }, retained, at))
    .toMatchObject({ code: "INVALID_NEXT_START_DATE" })
})

it("does not evaluate unexpected accessors or accept extra context", () => {
  const { input, retained, at } = setup()
  const getter = vi.fn(() => "secret")
  expect(prepareAdjustedNextFrame(Object.defineProperty({ ...input }, "memo", { enumerable: true, get: getter }), retained, at))
    .toMatchObject({ code: "INVALID_CONTINUITY_INPUT" })
  expect(getter).not.toHaveBeenCalled()
})

it.each([7, 9, 10] as const)("keeps both slots and only the displayed %s-day projection in continuity", requestedFrameLength => {
  const { input, retained, at, sessions } = setup("complete", {
    requestedFrameLength, secondSessionMode: "RECOVERY_PM_ALLOWED",
  })
  expect(sessions.some(session => session.slot === "AM")).toBe(true)
  expect(sessions.some(session => session.slot === "PM")).toBe(true)
  const result = prepareAdjustedNextFrame(input, retained, at)
  expect(result.kind).toBe("prepared")
  if (result.kind !== "prepared") throw Error(result.code)
  const visible = sessions.filter(session => session.day <= requestedFrameLength)
  expect(result.context.continuity.progressStateCounts.reduce((sum, row) => sum + row.count, 0)).toBe(visible.length)
  expect(result.context.missingRequiredOutcomes).toBe(0)
})
