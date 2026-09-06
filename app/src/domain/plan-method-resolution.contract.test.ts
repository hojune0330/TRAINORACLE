import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { configurationReference } from "@impl/prescription/prescription-adjustment"
import { deriveSequenceTotals } from "@impl/prescription/sequence"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { draftFor, RUNTIME_CASES, saveCurrentRecord, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { readPlanMethodDefinition } from "./plan-method-definition"
import * as definitionModule from "./plan-method-definition"
import { resolvePlanMethodPrescription } from "./plan-method-resolution"
import * as explanationModule from "./training-template-explanations"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { resolveDetailedPlanTemplateOptions } from "../screens/plan-beta/plan-template-options"

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

function generated(fixture = RUNTIME_CASES[0], seconds: number = fixture.performanceSeconds) {
  localStorage.clear()
  const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, seconds)
  return generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
}

function prescription(fixture: typeof RUNTIME_CASES[number] = RUNTIME_CASES[0], seconds: number = fixture.performanceSeconds) {
  localStorage.clear()
  const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, seconds)
  const result = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
  if (result.kind !== "generated") throw new Error("Expected generated fixture")
  const session = result.generated.candidates[0].sessions.find(item => item.prescription.kind === "PACE_TARGET")
  if (session?.prescription.kind !== "PACE_TARGET") throw new Error("Expected existing detailed prescription")
  return session.prescription
}

describe("source configuration and individual resolution", () => {
  it.each(RUNTIME_CASES.slice(0, 4))("$eventDistanceM preserves exact source, fractional target and explanation binding", fixture => {
    const p = prescription(fixture, fixture.performanceSeconds + 0.137)
    const before = JSON.stringify(p)
    const binding = resolvePlanMethodPrescription(p)
    expect(binding).not.toBeNull()
    const definition = readPlanMethodDefinition(binding!.source.template)!
    expect(binding!.source.configuration).toEqual(configurationReference(definition.mapping.method, definition.configuration.sequence))
    expect(binding!.resolved.targetRepSeconds).toBe(p.selectedAnchor.performanceSeconds * p.repetitionDistanceM / p.targetEventDistanceM)
    expect(binding!.resolved.targetRepSeconds).not.toBe(Math.round(binding!.resolved.targetRepSeconds))
    expect(binding!.resolved.sequence).toEqual(p.sequence)
    expect(binding!.resolved.explanation.version).toBe("1.0.0")
    expect(binding!.resolved.explanation.evidenceRefs.length).toBeGreaterThan(0)
    expect(binding!.resolved.anchorContentFingerprint).toBe(canonicalJsonFingerprint("trainoracle.method-anchor.v1", p.selectedAnchor))
    expect(binding!.resolved.prescriptionContentFingerprint).toBe(canonicalJsonFingerprint("trainoracle.method-resolved-prescription.v1", p))
    expect(JSON.stringify(definition)).not.toContain("athlete-record:")
    expect(JSON.stringify(p)).toBe(before)
    expect(deriveSequenceTotals(definition.configuration.sequence).qualityDistanceM).toBe(p.totals.qualityDistanceM)
  })

  it("keeps source identity stable across athlete records but changes resolved identity", () => {
    const a = resolvePlanMethodPrescription(prescription(RUNTIME_CASES[0], 121.5))!
    const b = resolvePlanMethodPrescription(prescription(RUNTIME_CASES[0], 137.37))!
    expect(a.source).toEqual(b.source)
    expect(a.resolved.anchorContentFingerprint).not.toBe(b.resolved.anchorContentFingerprint)
    expect(a.resolved.prescriptionContentFingerprint).not.toBe(b.resolved.prescriptionContentFingerprint)
    expect(a.bindingFingerprint).not.toBe(b.bindingFingerprint)
    expect(a.resolved.targetRepSeconds).toBe(30.375)
  })

  it("binds explanation content even if a changed text mistakenly retains its version", () => {
    const p = prescription()
    const original = explanationModule.templateExplanation(p)!
    const a = resolvePlanMethodPrescription(p)!
    vi.spyOn(explanationModule, "templateExplanation").mockReturnValue({ ...original, recovery: "TEST changed recovery rationale" })
    const b = resolvePlanMethodPrescription(p)!
    expect(a.source).toEqual(b.source)
    expect(a.resolved.prescriptionContentFingerprint).toBe(b.resolved.prescriptionContentFingerprint)
    expect(a.resolved.explanation.contentFingerprint).not.toBe(b.resolved.explanation.contentFingerprint)
    expect(a.bindingFingerprint).not.toBe(b.bindingFingerprint)
  })

  it("does not write a projected sequence into a legacy prescription", () => {
    const { sequence: _sequence, prescriptionFingerprint: _old, ...content } = prescription()
    const old = { ...content, prescriptionFingerprint: `canonical-json-v1:${JSON.stringify(content)}` }
    const before = JSON.stringify(old)
    const write = vi.spyOn(Storage.prototype, "setItem")
    expect(resolvePlanMethodPrescription(old)).not.toBeNull()
    expect(JSON.stringify(old)).toBe(before)
    expect("sequence" in old).toBe(false)
    expect(write).not.toHaveBeenCalled()
  })

  it.each(["targetRepSeconds", "repetitionRecoverySeconds", "repetitionsPerSet", "templateContentFingerprint"] as const)
  ("rejects changed %s even with a recomputed stored fingerprint", field => {
    const { prescriptionFingerprint: _fingerprint, ...content } = prescription()
    const changed = { ...content, [field]: field === "templateContentFingerprint" ? `sha256:${"0".repeat(64)}` : 999 }
    expect(resolvePlanMethodPrescription({ ...changed, prescriptionFingerprint: `canonical-json-v1:${JSON.stringify(changed)}` })).toBeNull()
  })

  it("rejects private extra fields and getters without reading the getter", () => {
    const p = prescription()
    const getter = vi.fn(() => "private")
    expect(resolvePlanMethodPrescription({ ...p, memo: "private" })).toBeNull()
    expect(resolvePlanMethodPrescription(Object.defineProperty({ ...p }, "memo", { enumerable: true, get: getter }))).toBeNull()
    expect(getter).not.toHaveBeenCalled()
  })

  it("returns detached definitions and resolutions rather than mutable registry references", () => {
    const p = prescription()
    const binding = resolvePlanMethodPrescription(p)!
    const first = readPlanMethodDefinition(binding.source.template)!
    Reflect.set(first.mapping.method, "configurationId", "changed")
    expect(Reflect.set(first.configuration.sequence.main, "length", 0)).toBe(false)
    const later = readPlanMethodDefinition(binding.source.template)!
    expect(later.mapping.method.configurationId).toBe(p.templateId)
    expect(later.configuration.sequence.main).not.toHaveLength(0)
    expect(resolvePlanMethodPrescription(p)).toEqual(binding)
  })

  it.each([{ version: "9.9.9" }, { templateId: "UNKNOWN" }, { fingerprint: `sha256:${"f".repeat(64)}` }])
  ("does not create a source definition for unknown identity %j", change => {
    const p = prescription()
    expect(readPlanMethodDefinition({ templateId: p.templateId, version: p.templateVersion,
      fingerprint: p.templateContentFingerprint, ...change })).toBeNull()
  })

  it("uses the shared definition in the real recommendation catalogue", () => {
    const reader = vi.spyOn(definitionModule, "readPlanMethodDefinition")
    const options = resolveDetailedPlanTemplateOptions(draftFor(RUNTIME_CASES[0]), TODAY.toISOString())
    expect(options).toHaveLength(1)
    expect(reader).toHaveBeenCalledWith(draftFor(RUNTIME_CASES[0]).selectedDetailedTemplateRef)
    reader.mockReturnValue(null)
    expect(resolveDetailedPlanTemplateOptions(draftFor(RUNTIME_CASES[0]), TODAY.toISOString())).toEqual([])
  })

  it.each(["definition", "explanation"] as const)("keeps the real candidate RPE-only when %s binding is missing", missing => {
    if (missing === "definition") vi.spyOn(definitionModule, "readPlanMethodDefinition").mockReturnValue(null)
    else vi.spyOn(explanationModule, "templateExplanation").mockReturnValue(null)
    const result = generated()
    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") throw new Error("Expected baseline fallback")
    expect(result.generated.candidates.flatMap(item => item.sessions).some(item => item.prescription.kind === "PACE_TARGET")).toBe(false)
  })
})
