import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { adjustedCandidateFixture } from "./adjusted-plan-candidate.test-fixtures"
import { prepareAdjustedPlanCandidate } from "./adjusted-plan-candidate"
import { createPlannedSessionLogDraft, plannedSessionLinkSchema, resolveCurrentPlannedSession } from "./planned-session-link"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"

function fixture() {
  const preparation = adjustedCandidateFixture()
  const result = prepareAdjustedPlanCandidate(preparation)
  if (result.kind !== "prepared") throw Error(result.code)
  // Synthetic identity projection only: this is not an accepted or saved plan.
  const state = { intake: { startDate: preparation.startDate }, generatedAt: TODAY.toISOString(),
    activePlan: { candidateId: result.candidate.contentFingerprint, sessions: result.candidate.sessions } }
  const session = state.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD")!
  const draft = createPlannedSessionLogDraft(state, session, TODAY.toISOString())
  if (draft === null) throw Error("Expected immutable link")
  return { state, session, draft }
}

describe("adjusted content in the shared journal link identity", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
  afterEach(() => { localStorage.clear(); vi.useRealTimers() })

  it("round trips the full adjusted session through the existing link schema", () => {
    const { state, session, draft } = fixture()
    const link = plannedSessionLinkSchema.parse(JSON.parse(JSON.stringify(draft.link)))
    expect(resolveCurrentPlannedSession(state, link)).toEqual(session)
    expect(JSON.stringify(link)).not.toContain("selectedAnchor")
    expect(JSON.stringify(link)).not.toContain("TEST purpose")
  })

  it("does not resolve an adjusted link to the original unadjusted prescription", () => {
    const { state, session, draft } = fixture()
    if (session.prescription.kind !== "ADJUSTED_METHOD") throw Error("Expected adjustment")
    const original = { ...session, prescription: session.prescription.snapshot.original }
    const changed = { ...state, activePlan: { ...state.activePlan,
      sessions: state.activePlan.sessions.map(s => s === session ? original : s) } }
    expect(resolveCurrentPlannedSession(changed, draft.link)).toBeNull()
  })

  it("invalidates links when any adjusted content changes even with the same candidate ID", () => {
    const { state, draft } = fixture()
    const changed = structuredClone(state)
    const session = changed.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD")!
    if (session.prescription.kind !== "ADJUSTED_METHOD") throw Error("Expected adjustment")
    const replaced = { ...session, prescription: { ...session.prescription,
      snapshot: { ...session.prescription.snapshot, capturedAtMs: session.prescription.snapshot.capturedAtMs + 1 } } }
    expect(resolveCurrentPlannedSession({ ...changed, activePlan: { ...changed.activePlan,
      sessions: changed.activePlan.sessions.map(s => s === session ? replaced : s) } }, draft.link)).toBeNull()
  })

  it("binds the date and AM/PM occurrence, not just the method", () => {
    const { state, session, draft } = fixture()
    expect(resolveCurrentPlannedSession({ ...state, intake: { startDate: "2026-09-08" } }, draft.link)).toBeNull()
    expect(createPlannedSessionLogDraft(state, { ...session, slot: session.slot === "AM" ? "PM" : "AM" }, TODAY.toISOString())).toBeNull()
  })

  it("rejects changed target seconds even when stored fingerprints are left untouched", () => {
    const { state, session, draft } = fixture()
    if (session.prescription.kind !== "ADJUSTED_METHOD") throw Error("Expected adjustment")
    const snapshot = session.prescription.snapshot
    const target = snapshot.projection.segmentTargets[0]
    if (target?.targetRepSeconds == null) throw Error("Expected a distance target")
    const replaced = { ...session, prescription: { ...session.prescription,
      snapshot: { ...snapshot, projection: { ...snapshot.projection,
        segmentTargets: [{ ...target, targetRepSeconds: target.targetRepSeconds + 1 },
          ...snapshot.projection.segmentTargets.slice(1)] } } } }
    expect(resolveCurrentPlannedSession({ ...state, activePlan: { ...state.activePlan,
      sessions: state.activePlan.sessions.map(s => s === session ? replaced : s) } }, draft.link)).toBeNull()
  })

  it("keeps progress-independent identity and rejects duplicate occurrences", () => {
    const { state, session, draft } = fixture()
    expect(resolveCurrentPlannedSession({ ...state, activePlan: { ...state.activePlan,
      sessions: [...state.activePlan.sessions, session] } }, draft.link)).toBeNull()
    expect(createPlannedSessionLogDraft(state, session, "2026-08-18T03:00:00Z")?.link.plannedSessionId).toBe(draft.link.plannedSessionId)
  })
})
