import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import { adjustedMethodResolutionFixture } from "./adjusted-method-resolution.test-fixtures"
import { resolveAdjustedMethodPrescription } from "./adjusted-method-resolution"
import { createAdjustedMethodSnapshot, readAdjustedMethodSnapshot, revalidateAdjustedMethodSnapshot } from "./adjusted-method-snapshot"
import type { ResolvedAdjustedExplanation } from "./adjusted-method-snapshot"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

function fixture() {
  const resolution = adjustedMethodResolutionFixture()
  const resolved = resolveAdjustedMethodPrescription(resolution)
  if (resolved.kind !== "resolved") throw Error(resolved.code)
  const explanation: ResolvedAdjustedExplanation = {
    configuration: resolved.projection.source.to, resolutionContextKey: resolved.projection.resolutionContextKey,
    version: "TEST-1", reviewRef: "TEST-NOT-SCIENTIFIC-APPROVAL",
    purpose: "TEST purpose", energySupply: "TEST energy supply", workRationale: "TEST work rationale",
    recoveryRationale: "TEST recovery rationale", cycleRole: "TEST cycle role", expectedAdaptation: "TEST adaptation",
    limitations: "TEST limitation", observation: "TEST observation", evidenceRefs: ["TEST-SOURCE-1"],
  }
  const scope = { candidateLineageId: "TEST-CANDIDATE", mainSlotId: "TEST-SLOT-AM" }
  const input = { ...resolution, scope, explanation }
  const prepared = createAdjustedMethodSnapshot(input)
  if (prepared.kind !== "prepared") throw Error(prepared.code)
  return { input, snapshot: prepared.snapshot, raw: JSON.stringify(prepared.snapshot),
    context: { source: input.source, scope, explanation } }
}

describe("adjusted per-session snapshot codec", () => {
  it("round-trips the exact projection with explicit bound explanation and no execution authority", () => {
    const { raw, snapshot, context } = fixture()
    expect(readAdjustedMethodSnapshot(raw, context)).toEqual({ kind: "read_only", executionAuthority: "NONE", snapshot })
    expect(revalidateAdjustedMethodSnapshot(raw, context)).toEqual({ kind: "candidate_ready", snapshot })
    expect(snapshot.explanation.kind).toBe("EXACT_CONFIGURATION_EXPLANATION_BOUND")
    expect(snapshot.projection).not.toHaveProperty("explanation")
    expect(snapshot.projection.segmentTargets[0]!.targetRepSeconds).not.toBe(Math.round(snapshot.projection.segmentTargets[0]!.targetRepSeconds!))
  })

  it("reads historical records after expiry without authorizing current candidate use", () => {
    const { raw, snapshot, context } = fixture()
    const expired = { ...context, source: { ...context.source, nowMs: 200 } }
    expect(readAdjustedMethodSnapshot(raw, expired)).toEqual({ kind: "read_only", executionAuthority: "NONE", snapshot })
    expect(revalidateAdjustedMethodSnapshot(raw, expired)).toEqual({ kind: "unavailable", code: "CURRENT_ADJUSTMENT_AUTHORITY_UNAVAILABLE" })
  })

  it.each(["policies", "catalog"] as const)("requires independently retained trusted %s", field => {
    const { raw, context } = fixture()
    const source = { ...context.source, authority: { ...context.source.authority, [field]: [] } }
    expect(readAdjustedMethodSnapshot(raw, { ...context, source }).kind).toBe("unavailable")
  })

  it.each(["candidateLineageId", "mainSlotId"] as const)("rejects another %s", field => {
    const { raw, context } = fixture()
    expect(readAdjustedMethodSnapshot(raw, { ...context, scope: { ...context.scope, [field]: "OTHER" } }).kind).toBe("unavailable")
  })

  it.each(["revision", "anchor"] as const)("rejects changed source %s", field => {
    const { raw, context } = fixture()
    const source = { ...context.source, ...(field === "revision" ? { resolutionRevision: "OTHER" }
      : { anchor: { ...context.source.anchor, contentFingerprint: `sha256:${"f".repeat(64)}` } }) }
    expect(readAdjustedMethodSnapshot(raw, { ...context, source }).kind).toBe("unavailable")
  })

  it.each(["target", "total", "receipt", "fingerprint", "version", "future", "extra"] as const)("rejects tampered %s even with a rebuilt self-fingerprint", field => {
    const { raw, context } = fixture()
    const changed = JSON.parse(raw)
    if (field === "target") changed.projection.segmentTargets[0].targetRepSeconds += 1
    if (field === "total") changed.projection.structuralTotals.qualityDistanceM += 1
    if (field === "receipt") changed.receipt.delta.qualityDistanceM += 1
    if (field === "version") changed.schemaVersion = 2
    if (field === "future") changed.capturedAtMs = 152
    if (field === "extra") changed.memo = "NOT-ACTUAL-PRIVATE-DATA"
    const { contentFingerprint: _old, ...content } = changed
    changed.contentFingerprint = field === "fingerprint" ? `sha256:${"f".repeat(64)}`
      : canonicalJsonFingerprint("trainoracle.adjusted-method-snapshot.v1", content)
    expect(readAdjustedMethodSnapshot(JSON.stringify(changed), context).kind).toBe("unavailable")
  })

  it("rejects prose changes under the same explanation version", () => {
    const { raw, context } = fixture()
    expect(readAdjustedMethodSnapshot(raw, { ...context, explanation: { ...context.explanation, recoveryRationale: "DIFFERENT RECOVERY" } }).kind).toBe("unavailable")
  })

  it.each(["purpose", "energySupply", "workRationale", "recoveryRationale", "cycleRole", "expectedAdaptation", "limitations", "observation"] as const)("requires %s", field => {
    const { input } = fixture()
    expect(createAdjustedMethodSnapshot({ ...input, explanation: { ...input.explanation, [field]: " " } }).kind).toBe("unavailable")
  })

  it("requires exact explanation configuration and resolution context", () => {
    const { input } = fixture()
    expect(createAdjustedMethodSnapshot({ ...input, explanation: { ...input.explanation, configuration: input.source.current } }).kind).toBe("unavailable")
    expect(createAdjustedMethodSnapshot({ ...input, explanation: { ...input.explanation, resolutionContextKey: "OTHER" } }).kind).toBe("unavailable")
    expect(createAdjustedMethodSnapshot({ ...input, explanation: { ...input.explanation, evidenceRefs: ["DUP", "DUP"] } }).kind).toBe("unavailable")
  })

  it("does not store explanation prose, authority registries or write browser storage", () => {
    const { input } = fixture()
    const before = JSON.stringify(input)
    const write = vi.spyOn(Storage.prototype, "setItem")
    const result = createAdjustedMethodSnapshot(input)
    if (result.kind !== "prepared") throw Error(result.code)
    const raw = JSON.stringify(result.snapshot)
    expect(raw).not.toContain("TEST recovery rationale")
    expect(result.snapshot.sourceContext).not.toHaveProperty("authority")
    expect(write).not.toHaveBeenCalled()
    expect(JSON.stringify(input)).toBe(before)
  })

  it("rejects extra memo fields and getters without reading them", () => {
    const { input } = fixture()
    const getter = vi.fn(() => "PRIVATE")
    const explanation = Object.defineProperty({ ...input.explanation }, "memo", { enumerable: true, get: getter })
    expect(createAdjustedMethodSnapshot({ ...input, explanation }).kind).toBe("unavailable")
    expect(getter).not.toHaveBeenCalled()
  })
})
