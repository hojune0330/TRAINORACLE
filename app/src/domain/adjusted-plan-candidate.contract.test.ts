import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { RUNTIME_CASES, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { createAdjustedMethodSnapshot } from "./adjusted-method-snapshot"
import { prepareAdjustedPlanCandidate, resolveAdjustedCandidateScope } from "./adjusted-plan-candidate"
import { planAdaptationCandidateSchema } from "./plan-beta-schema"
import { adjustedCandidateFixture as fixture } from "./adjusted-plan-candidate.test-fixtures"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe("adjusted candidate assembly", () => {
  it.each(RUNTIME_CASES.slice(0, 4))("$eventDistanceM replaces exactly one MAIN without mutating the original", event => {
    const input = fixture(event)
    const before = JSON.stringify(input)
    const result = prepareAdjustedPlanCandidate(input)
    if (result.kind !== "prepared") throw Error(result.code)
    expect(result.candidate.sessions).toHaveLength(input.candidate.sessions.length)
    expect(result.candidate.sessions.filter(session => session.prescription.kind === "ADJUSTED_METHOD")).toHaveLength(1)
    input.candidate.sessions.forEach((session, index) => {
      const updated = result.candidate.sessions[index]!
      if (session.day !== input.address.day || session.slot !== input.address.slot) expect(updated).toEqual(session)
      else {
        expect(updated).toMatchObject({ day: session.day, slot: session.slot, role: "QUALITY", plannedEnergyIntent: session.plannedEnergyIntent })
        expect(updated.prescription.kind).toBe("ADJUSTED_METHOD")
      }
    })
    expect(result.candidate.frame).toEqual(input.candidate.frame)
    expect(result.candidate.continuityContext).toEqual(input.candidate.continuityContext)
    expect(JSON.stringify(input)).toBe(before)
    expect(result.candidate.activationState).toBe("NOT_ACCEPTED")
    expect(result.candidate.selectionAuthority).toBe("NONE")
    expect(planAdaptationCandidateSchema.safeParse(result.candidate).success).toBe(false)
  })

  it("binds deterministic scope and content to the original candidate", () => {
    const input = fixture()
    const scope = resolveAdjustedCandidateScope(input.candidate, input.address, input.startDate)
    expect(scope).not.toBeNull()
    expect(scope).toEqual(resolveAdjustedCandidateScope(structuredClone(input.candidate), input.address, input.startDate))
    expect(prepareAdjustedPlanCandidate(input)).toEqual(prepareAdjustedPlanCandidate(structuredClone(input)))
  })

  it("rejects moving the snapshot to another day, support or missing slot", () => {
    const input = fixture()
    for (const address of [{ day: 99, slot: "AM" as const },
      ...input.candidate.sessions.filter(s => s.prescription.kind !== "PACE_TARGET").slice(0, 3).map(s => ({ day: s.day, slot: s.slot }))]) {
      expect(prepareAdjustedPlanCandidate({ ...input, address }).kind).toBe("unavailable")
    }
  })

  it("rejects a snapshot from another original candidate", () => {
    const first = fixture(RUNTIME_CASES[0]!)
    localStorage.clear()
    const other = fixture(RUNTIME_CASES[1]!)
    expect(prepareAdjustedPlanCandidate({ ...first, rawSnapshot: other.rawSnapshot }).kind).toBe("unavailable")
  })

  it("rejects another prescription even with a snapshot rebound to the requested slot", () => {
    const first = fixture(RUNTIME_CASES[0]!)
    localStorage.clear()
    const other = fixture(RUNTIME_CASES[1]!)
    const saved = JSON.parse(other.rawSnapshot)
    const scope = resolveAdjustedCandidateScope(first.candidate, first.address, first.startDate)!
    const rebound = createAdjustedMethodSnapshot({ original: saved.original, receipt: saved.receipt,
      scope, source: other.source, explanation: other.explanation })
    if (rebound.kind !== "prepared") throw Error(rebound.code)
    expect(prepareAdjustedPlanCandidate({ ...first, rawSnapshot: JSON.stringify(rebound.snapshot),
      source: other.source, explanation: other.explanation })).toEqual({ kind: "unavailable", code: "ORIGINAL_PRESCRIPTION_MISMATCH" })
  })

  it("rejects malformed or edited original candidates instead of preserving stale identity", () => {
    const input = fixture()
    expect(prepareAdjustedPlanCandidate({ ...input, candidate: { ...input.candidate, candidateId: "OTHER" } }).kind).toBe("unavailable")
    expect(prepareAdjustedPlanCandidate({ ...input, candidate: { ...input.candidate, sessions: [...input.candidate.sessions, input.candidate.sessions[0]!] } }).kind).toBe("unavailable")
  })

  it("rechecks current policy even when the snapshot was valid at capture", () => {
    const input = fixture()
    expect(prepareAdjustedPlanCandidate({ ...input, source: { ...input.source, nowMs: 200 } })).toEqual({ kind: "unavailable", code: "CURRENT_ADJUSTMENT_AUTHORITY_UNAVAILABLE" })
  })

  it.each(["2026-09-08", "2026-02-30", ""])("rejects changed or invalid start date %s", startDate => {
    const input = fixture()
    expect(prepareAdjustedPlanCandidate({ ...input, startDate }).kind).toBe("unavailable")
  })

  it("does not read private extras or write any storage", () => {
    const input = fixture()
    const write = vi.spyOn(Storage.prototype, "setItem")
    const getter = vi.fn(() => "PRIVATE")
    expect(prepareAdjustedPlanCandidate(Object.defineProperty(input, "memo", { enumerable: true, get: getter })).kind).toBe("unavailable")
    expect(getter).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })
})
