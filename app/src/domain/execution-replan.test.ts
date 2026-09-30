import { describe, expect, it } from "vitest"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { replanFixture } from "./execution-replan.test-fixture"
import { prepareExecutionReplan, executionReplanEvidence, replanFingerprint } from "./execution-replan"
import { replayExecutionReplan } from "./execution-replan-policy"
import { accountPlanEntry, emptyAccountPlanDocument, validateExecutionReplanTransition } from "./account/account-plan-document-schema"

describe("remaining-schedule owner scope", () => {
  it("builds three exact bounded alternatives, never mutates original or progress", () => {
    const f = replanFixture(), before = JSON.stringify(f), result = prepareExecutionReplan(f)
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw Error("ready")
    expect(result.proposals.map(p => p.action)).toEqual(["REDUCE", "REPLACE", "MOVE_LATER"])
    for (const proposal of result.proposals) {
      expect(planBetaStateV3Schema.safeParse(proposal.after).success).toBe(true)
      expect(proposal.after.activePlan.sessions[0]).toEqual(f.state.activePlan.sessions[0])
      expect(proposal.after.progress).toEqual(f.state.progress)
      expect(proposal.after.intake).toEqual(f.state.intake)
      expect(proposal.after.activePlan.candidateId).not.toBe(f.state.activePlan.candidateId)
      expect(JSON.stringify(proposal)).not.toContain("SECRET")
      expect(proposal.after.activePlan.sessions.filter(s => s.role !== "REST").length)
        .toBeLessThanOrEqual(f.state.activePlan.sessions.filter(s => s.role !== "REST").length)
    }
    expect(JSON.stringify(f)).toBe(before)
  })
  it("does not use diary text, names or memo-edit time as analysis evidence", () => {
    const f = replanFixture(), before = executionReplanEvidence(f.entries)
    const entries = [{ ...f.entries[0]!, memo: "DIFFERENT", title: "NEW", savedAt: "2026-09-29T04:00:00.000Z" }]
    expect(executionReplanEvidence(entries)).toEqual(before)
    expect(replanFingerprint(executionReplanEvidence([{ ...entries[0]!, activityOutcome: "RESTED" }]))).not.toBe(replanFingerprint(before))
    const jumps = { ...entries[0]!, exerciseLog: { version: 1 as const, source: "SELF_REPORTED" as const,
      components: [{ id: "jump", kind: "PLYOMETRIC" as const, name: "PRIVATE", rows: [{ id: "row", contacts: 10, side: "LEFT" as const }] }] } }
    const changed = structuredClone(jumps)
    changed.exerciseLog.components[0]!.rows[0]!.contacts = 20
    expect(replanFingerprint(executionReplanEvidence([changed]))).not.toBe(replanFingerprint(executionReplanEvidence([jumps])))
    expect(JSON.stringify(executionReplanEvidence([jumps]))).not.toContain("PRIVATE")
  })
  it("requires explicit fixed-date confirmation for moves", () => {
    const r = prepareExecutionReplan({ ...replanFixture(), noFixedFutureCommitments: false })
    expect(r.kind === "ready" && r.proposals.some(p => p.action === "MOVE_LATER")).toBe(false)
  })
  it("blocks pain, duplicate occurrences, missing and historical records", () => {
    const f = replanFixture()
    for (const entries of [[{ ...f.entries[0]!, painCheckStatus: "SIGNAL_REPORTED" as const }],
      [...f.entries, { ...f.entries[0]!, id: "duplicate" }], [], [{ ...f.entries[0]!, date: "2026-09-27" }]]) {
      expect(prepareExecutionReplan({ ...f, entries }).kind).toBe("blocked")
    }
  })
  it("never changes today, already recorded future slots or invents missing completion", () => {
    const f = replanFixture()
    f.state.progress.push({ sessionDay: 3, sessionSlot: "AM", state: "COMPLETED" })
    const r = prepareExecutionReplan(f)
    expect(r.kind).toBe("ready")
    if (r.kind !== "ready") return
    for (const p of r.proposals) expect(p.after.activePlan.sessions[1]).toEqual(f.state.activePlan.sessions[1])
  })
  it("rejects altered dosage and changing an unreported fixed duration", () => {
    const r = prepareExecutionReplan(replanFixture())
    if (r.kind !== "ready") throw Error("ready")
    const p = structuredClone(r.proposals[0]!)
    const s = p.after.activePlan.sessions.find(s => s.day === 3)!
    if (s.prescription.kind !== "RPE_TIME_RANGE") throw Error("range")
    s.prescription.rpe.maximum = 9
    expect(planBetaStateV3Schema.safeParse(p.after).success).toBe(false)
    const receipt = structuredClone(r.proposals[0]!.after.executionReplan!)
    receipt.source.day = 1
    expect(replayExecutionReplan(receipt)).toBeNull()
  })
  it.each(["AM", "SINGLE", "UNSPECIFIED", undefined] as const)("protects an actual-date journal without a plan link (%s)", slot => {
    const f = replanFixture()
    const entry = { ...f.entries[0]!, id: "unlinked-future", date: "2026-09-30", plannedSessionLink: undefined, activitySlot: slot }
    const result = prepareExecutionReplan({ ...f, entries: [...f.entries, entry] })
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw Error("ready")
    expect(result.proposals.length).toBeGreaterThan(0)
    const original = f.state.activePlan.sessions.find(s => s.day === 3 && s.slot === "AM")!
    for (const p of result.proposals) {
      expect(p.after.executionReplan!.protectedSlots).toContainEqual({ day: 3, slot: "AM" })
      expect(p.after.activePlan.sessions.find(s => s.day === 3 && s.slot === "AM")).toEqual(original)
    }
  })
  it("does not mistake a known afternoon journal for an unlinked morning occurrence", () => {
    const f = replanFixture()
    const entry = { ...f.entries[0]!, id: "unlinked-pm", date: "2026-09-30", plannedSessionLink: undefined, activitySlot: "PM" as const }
    const result = prepareExecutionReplan({ ...f, entries: [...f.entries, entry] })
    if (result.kind !== "ready") throw Error("ready")
    expect(result.proposals.find(p => p.action === "REDUCE")!.after.executionReplan!.source).toEqual({ day: 3, slot: "AM" })
  })
  it("binds account activation to the current plan and immutable source progress", () => {
    const f = replanFixture(), r = prepareExecutionReplan(f)
    if (r.kind !== "ready") throw Error("ready")
    const old = accountPlanEntry({ state: f.state, evidence: null }, f.now)
    const newer = accountPlanEntry({ state: r.proposals[0]!.after, evidence: null }, f.now)
    const before = emptyAccountPlanDocument(), next = emptyAccountPlanDocument()
    before.data.plans = [old]; before.data.currentPlanId = old.planId
    next.data.plans = [{ ...old, archivedAt: f.now }, newer]; next.data.currentPlanId = newer.planId
    expect(validateExecutionReplanTransition(before,next)).toBe(true)
    const wrong = structuredClone(before)
    wrong.data.plans[0]!.progress = []
    expect(validateExecutionReplanTransition(wrong,next)).toBe(false)
    const removed = structuredClone(next)
    removed.data.plans[1]!.progress = []
    expect(validateExecutionReplanTransition(before,removed)).toBe(false)
  })
})
