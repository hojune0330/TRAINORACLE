import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { stateFixture } from "../../domain/plan-beta-store.test-fixture"
import * as safety from "../../domain/plan-beta-flow"
import * as journal from "../../domain/journal-store"
import { createPlannedSessionLogDraft } from "../../domain/planned-session-link"
import { projectCurrentInstantToday } from "./instant-plan-today-context"

beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture() })
afterEach(() => vi.restoreAllMocks())
function fixture() {
  const state = stateFixture()
  if (state.version !== 3) throw new Error("Expected V3 fixture")
  return { ...state, intake: { ...state.intake, startDate: "2026-09-20" } }
}
const now = new Date("2026-09-20T03:00:00Z")
describe("today live context", () => {
  it("suppresses executable instructions when recent journal safety is blocked", () => {
    vi.spyOn(safety, "evaluatePlanSafety").mockReturnValue({ kind: "blocked", code: "RECENT_JOURNAL_REQUIRES_REVIEW" })
    expect(projectCurrentInstantToday(fixture(), now)).toMatchObject({ state: "UNAVAILABLE", unavailableReason: "JOURNAL_REVIEW", sessions: [] })
  })
  it("does not call an unreadable journal or an uncertain current check a pain progress record", () => {
    const state = fixture(), original = JSON.stringify(state)
    vi.spyOn(safety, "evaluatePlanSafety").mockReturnValue({ kind: "blocked", code: "RECENT_JOURNAL_REQUIRES_REVIEW" })
    vi.spyOn(journal, "loadEntriesForPlanSafety").mockReturnValue({ status: "uncertain" })
    expect(projectCurrentInstantToday(state, now)).toMatchObject({ state: "UNAVAILABLE", unavailableReason: "JOURNAL_UNREADABLE", sessions: [] })
    vi.mocked(safety.evaluatePlanSafety).mockReturnValue({ kind: "blocked", code: "CURRENT_CHECK_REQUIRES_REVIEW" })
    expect(projectCurrentInstantToday(state, now)).toMatchObject({ state: "UNAVAILABLE", unavailableReason: "CURRENT_BODY_REVIEW", sessions: [] })
    expect(JSON.stringify(state)).toBe(original)
  })
  it("recognizes only a journal linked to this exact selected session", () => {
    const state = fixture()
    const draft = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, now.toISOString())!
    const entry = { kind: "post-session", date: draft.date, plannedSessionLink: draft.link } as journal.PostSessionEntry
    const read = vi.spyOn(journal, "loadEntries").mockReturnValue([entry])
    expect(projectCurrentInstantToday(state, now).state).toBe("RECORDED")
    expect(state.progress).toEqual([])
    read.mockReturnValue([{ ...entry, date: "2026-09-19" }])
    expect(projectCurrentInstantToday(state, now).state).toBe("SCHEDULED")
    read.mockReturnValue([{ ...entry, plannedSessionLink: { ...draft.link, plannedSessionId: "wrong-plan" } }])
    expect(projectCurrentInstantToday(state, now).state).toBe("SCHEDULED")
  })
})
