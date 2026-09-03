import { afterEach, describe, expect, it, vi } from "vitest"
import { resolvePlanMethodChange, sameDetailedTemplateReference } from "./plan-method-selection"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import type { PlanBetaIntake } from "./plan-beta-store"
import * as authority from "./detailed-prescription-runtime-authority"

const now = new Date("2026-09-02T03:00:00.000Z")
const approved = DETAILED_PRESCRIPTION_APPROVALS.find(item => item.targetEventDistanceM === 5000)!
const ref = { templateId: approved.templateId, version: approved.templateVersion, fingerprint: approved.templateContentFingerprint }
const intake: PlanBetaIntake = {
  eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "HIGH_SCHOOL",
  experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY", requestedFrameLength: 9,
  trainingFocus: "VO2_INTENT", secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "EVENING",
  startDate: "2026-09-10", selectedDetailedTemplateRef: null,
}
afterEach(() => vi.restoreAllMocks())

describe("explicit candidate-stage method selection", () => {
  it("preserves all intake choices and does not add an anchor or a second session", () => {
    expect(resolvePlanMethodChange(intake, ref, now)).toEqual({ kind: "ready", intake: { ...intake, selectedDetailedTemplateRef: ref } })
    expect(intake.selectedDetailedTemplateRef).toBeNull()
  })
  it("returns to RPE without depending on an expired detailed authority", () => {
    expect(resolvePlanMethodChange({ ...intake, selectedDetailedTemplateRef: ref }, null, new Date("2028-01-01")))
      .toEqual({ kind: "ready", intake })
  })
  it("keeps selecting the same valid reference a no-op", () => {
    expect(resolvePlanMethodChange({ ...intake, selectedDetailedTemplateRef: ref }, { ...ref }, now)).toEqual({ kind: "unchanged" })
    expect(resolvePlanMethodChange(intake, null, now)).toEqual({ kind: "unchanged" })
  })
  it.each(["NEW_TO_RUNNING", "DEVELOPING"] as const)("rejects experienced-only method for %s", experienceBand => {
    expect(resolvePlanMethodChange({ ...intake, experienceBand }, ref, now)).toEqual({ kind: "rejected", code: "DETAILED_TEMPLATE_AUTHORITY_UNAVAILABLE" })
  })
  it.each(["ELEMENTARY", "MIDDLE_SCHOOL", "HIGH_SCHOOL", "COLLEGE", "OPEN", "MASTERS"] as const)("does not add an age-only gate for %s", competitionDivision => {
    expect(resolvePlanMethodChange({ ...intake, competitionDivision }, ref, now).kind).toBe("ready")
  })
  it("rejects a changed fingerprint instead of substituting the current method", () => {
    expect(resolvePlanMethodChange(intake, { ...ref, fingerprint: `sha256:${"0".repeat(64)}` }, now).kind).toBe("rejected")
  })
  it("rejects expiry even when the stale reference is already selected", () => {
    expect(resolvePlanMethodChange({ ...intake, selectedDetailedTemplateRef: ref }, ref, new Date("2028-01-01"))).toEqual({ kind: "rejected", code: "DETAILED_TEMPLATE_AUTHORITY_UNAVAILABLE" })
  })
  it("rejects a different purpose and different event", () => {
    expect(resolvePlanMethodChange({ ...intake, trainingFocus: "LT_INTENT" }, ref, now).kind).toBe("rejected")
    expect(resolvePlanMethodChange({ ...intake, eventGroup: "MIDDLE_DISTANCE", eventDistanceM: 800 }, ref, now).kind).toBe("rejected")
  })
  it("does not invent authority when the existing gate declines", () => {
    vi.spyOn(authority, "resolveDetailedPrescriptionRuntimeAuthority").mockReturnValue({ kind: "fallback", code: "RUNTIME_AUTHORITY_UNAVAILABLE" })
    expect(resolvePlanMethodChange(intake, ref, now).kind).toBe("rejected")
  })
  it.each([undefined, [], { ...ref, memo: "private" }, { templateId: "DRAFT" }, new Date()])("rejects malformed or private extra input %#", requested => {
    expect(resolvePlanMethodChange(intake, requested, now)).toEqual({ kind: "rejected", code: "MALFORMED_INPUT" })
  })
  it("does not access getters or mutate a source object", () => {
    const getter = vi.fn(() => "private")
    const input = Object.defineProperty({ ...ref }, "memo", { get: getter, enumerable: true })
    expect(resolvePlanMethodChange(intake, input, now).kind).toBe("rejected")
    expect(getter).not.toHaveBeenCalled()
  })
  it("rejects an invalid intake and evaluation date", () => {
    expect(resolvePlanMethodChange({ ...intake, eventDistanceM: 800 }, ref, now).kind).toBe("rejected")
    expect(resolvePlanMethodChange(intake, ref, new Date("invalid")).kind).toBe("rejected")
  })
  it("compares every identity field, never just a friendly label", () => {
    expect(sameDetailedTemplateReference(ref, { ...ref })).toBe(true)
    expect(sameDetailedTemplateReference(ref, { ...ref, version: "2.0.0" })).toBe(false)
    expect(sameDetailedTemplateReference(ref, { ...ref, fingerprint: "changed" })).toBe(false)
    expect(sameDetailedTemplateReference(ref, null)).toBe(false)
  })
})
