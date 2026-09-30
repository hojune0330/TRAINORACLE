import { describe, expect, it, vi } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { resolveCurrentCycleContext } from "./plan-current-cycle-context"
import { replacedReplanFixture } from "./execution-replan-lineage.test-fixture"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { inspectNextFrameAdaptation } from "./plan-adaptation-availability"

describe("current-cycle context is provenance, not a successor transform", () => {
  it("keeps an unchanged exact snapshot usable without a historical pair", () => {
    const state = planBetaStateV3Schema.parse(stateFixture())
    const read = vi.fn(() => null)
    expect(resolveCurrentCycleContext(state, { kind: "unavailable" }, read)).toEqual({
      kind: "current", current: state,
      fingerprint: canonicalJsonFingerprint("trainoracle.execution-replan.v1", state),
      origin: { kind: "verified", original: state, changeCount: 0, originalContext: null },
    })
    expect(read).toHaveBeenCalledExactlyOnceWith(state)
  })

  it("recovers the exact original through two changed snapshots without writes or rebinding", () => {
    const f = replacedReplanFixture(), before = JSON.stringify(f)
    const read = vi.fn(() => null)
    const result = resolveCurrentCycleContext(f.state, { kind: "loaded", plans: f.archivedPlans }, read)
    expect(result).toMatchObject({ kind: "current", current: f.state, origin: {
      kind: "verified", original: f.archivedPlans[0], changeCount: 2, originalContext: null,
    } })
    expect(read).toHaveBeenCalledExactlyOnceWith(f.archivedPlans[0])
    expect(inspectNextFrameAdaptation(f.state)).toEqual({ kind: "unavailable", code: "CHANGED_PLAN_TRANSFORM_UNAVAILABLE" })
    expect(JSON.stringify(f)).toBe(before)
  })

  it("does not mistake unread history for an unchanged plan", () => {
    const f = replacedReplanFixture(), read = vi.fn()
    expect(resolveCurrentCycleContext(f.state, { kind: "unavailable" }, read)).toMatchObject({
      kind: "current", current: f.state, origin: { kind: "unavailable", code: "HISTORY_UNAVAILABLE" },
    })
    expect(read).not.toHaveBeenCalled()
  })

  it.each(["all", "root", "middle", "different-cycle", "different-progress"])("rejects %s missing or mismatched chain without replacing the current plan", variant => {
    const f = replacedReplanFixture(), [root, middle] = f.archivedPlans
    const plans = variant === "all" ? [] : variant === "root" ? [middle] : variant === "middle" ? [root]
      : variant === "different-cycle" ? [{ ...root, intake: { ...root!.intake, startDate: "2026-09-27" } }, middle]
        : [{ ...root, progress: [] }, middle]
    const read = vi.fn()
    expect(resolveCurrentCycleContext(f.state, { kind: "loaded", plans }, read)).toMatchObject({
      kind: "current", current: f.state, origin: { kind: "unavailable", code: "INVALID_OR_MISSING_CHAIN" },
    })
    expect(read).not.toHaveBeenCalled()
  })

  it("deduplicates originals but never selects an unrelated latest plan", () => {
    const f = replacedReplanFixture()
    const plans = [stateFixture(), ...f.archivedPlans, ...f.archivedPlans]
    expect(resolveCurrentCycleContext(f.state, { kind: "loaded", plans })).toMatchObject({
      kind: "current", origin: { kind: "verified", changeCount: 2, original: f.archivedPlans[0] },
    })
  })

  it("keeps current context when the optional pair reader fails", () => {
    const f = replacedReplanFixture()
    expect(resolveCurrentCycleContext(f.state, { kind: "loaded", plans: f.archivedPlans }, () => { throw Error("unreadable") }))
      .toMatchObject({ kind: "current", origin: { kind: "verified", originalContext: null } })
  })

  it("does not bless a forged predecessor identity as verified history", () => {
    const f = replacedReplanFixture()
    const state = { ...f.state, catalogReplacement: { ...f.state.catalogReplacement!, baseCandidateId: "forged" } }
    expect(resolveCurrentCycleContext(state, { kind: "loaded", plans: f.archivedPlans })).toMatchObject({
      kind: "current", origin: { kind: "unavailable", code: "INVALID_OR_MISSING_CHAIN" },
    })
  })

  it("does not bless a replay-invalid current prescription", () => {
    const f = replacedReplanFixture(), state = structuredClone(f.state)
    const session = state.activePlan.sessions.find(value => value.day === 4)!
    if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Expected catalog prescription")
    session.prescription.durationMinutes.maximum += 1
    expect(resolveCurrentCycleContext(state, { kind: "loaded", plans: f.archivedPlans })).toEqual({ kind: "invalid" })
  })
})
