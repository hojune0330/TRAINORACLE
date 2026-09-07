import { expect, it } from "vitest"
import { previewPendingIntervalReferenceV3 } from "../../../reports/research/method-personal-reference-preview-v3"

const input = { protocolId: "P-VO2-2", eventDistanceM: 5000, performanceSeconds: 1111.5, purpose: "RECENT_RESULT", freshness: "CURRENT" }
it("keeps time termination, intermediate race references and independent recovery together", () => {
  for (const [protocolId, seconds, repeats, recovery] of [
    ["P-VO2-2", 120, 6, 60], ["P-VO2-3", 180, 5, 120], ["P-VO2-4", 240, 4, 180],
    ["P-VO2-2-4", 120, 4, 60], ["P-VO2-2-5", 120, 5, 60],
  ] as const) {
    const result = previewPendingIntervalReferenceV3({ ...input, protocolId })
    if (result.kind !== "personal_reference_review_preview") throw Error("Missing preview")
    expect(result.executionInstruction.stopRule).toEqual({ kind: "DURATION", seconds })
    expect(result.executionInstruction.intermediateReferences).toEqual([
      { distanceM: 400, seconds: 88.92 }, { distanceM: 1000, seconds: 222.3 },
    ])
    expect(result.executionInstruction.intermediateDistanceIsRequired).toBe(false)
    expect(result.executionInstruction.recovery).toEqual({ mode: "JOG", seconds: recovery, count: repeats - 1, finalRecovery: null })
    expect(result.explanation.exactStructure.totals?.main.workSeconds).toBe(seconds * repeats)
    expect(result.recordIdentityVerified).toBe(false)
    expect(result.executionAuthority).toBe("NONE")
  }
})
it("changes the receipt with the input, keeps past values and refuses stale or goal records", () => {
  const before = previewPendingIntervalReferenceV3(input)
  const after = previewPendingIntervalReferenceV3({ ...input, performanceSeconds: 1234.87 })
  if (before.kind !== "personal_reference_review_preview" || after.kind !== "personal_reference_review_preview") throw Error("Missing preview")
  expect(after.contentFingerprint).not.toBe(before.contentFingerprint)
  expect(before.reference.secondsPerKm).toBe(222.3)
  expect(after.executionInstruction.recovery).toEqual(before.executionInstruction.recovery)
  expect(previewPendingIntervalReferenceV3({ ...input, freshness: "STALE" }).kind).toBe("unavailable")
  expect(previewPendingIntervalReferenceV3({ ...input, purpose: "RACE_GOAL" }).kind).toBe("unavailable")
})
