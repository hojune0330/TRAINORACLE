import { expect, it } from "vitest"
import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS } from "../../../reports/research/method-adoption-protocols.mjs"
import { previewPendingMethodExplanation } from "../../../reports/research/method-explanation-preview-v3"
import { representPendingWholeSessionV3 } from "../../../reports/research/method-proposal-sequence-v3"
import type { SequenceNodeV3 } from "../../../impl/src/prescription/sequence-v3"

it("binds proposed work cues without changing geometry, recovery or support", () => {
  const stripTargets = (nodes: readonly SequenceNodeV3[]): unknown[] => nodes.map(node => {
    if (node.kind === "group") return { ...node, children: stripTargets(node.children) }
    const { target: _target, ...rest } = node
    return rest
  })
  for (const p of [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]) {
    const raw = representPendingWholeSessionV3(p)
    const result = previewPendingMethodExplanation(p).exactStructure.representation
    expect(result.executionAuthority).toBe("NONE")
    if (raw.kind !== "represented" || result.kind !== "represented") {
      expect(result.kind).toBe(raw.kind)
      expect(result.guidance.effortProposal.status).toBe("NOT_APPLICABLE")
      continue
    }
    expect(result.targetStatus).toBe("COACHING_PROPOSAL_NOT_ADOPTED")
    expect(stripTargets(result.sequence.main)).toEqual(stripTargets(raw.sequence.main))
    expect(result.sequence.warmup).toEqual(raw.sequence.warmup)
    expect(result.sequence.cooldown).toEqual(raw.sequence.cooldown)
    expect(JSON.stringify(result.sequence.main)).not.toContain("강도 미결정")
    expect(result.guidance.effortProposal.sessionRpeTarget).toBeNull()
    if (p.family === "ATP-PC") {
      expect(result.guidance.effortProposal.work?.rpe).toBeNull()
      expect(JSON.stringify(result.sequence.main)).not.toContain("체감 노력 제안 RPE")
    }
  }
})

it("separates non-applicable rest-day dose from still-required placement and adoption", () => {
  const rest = METHOD_ADOPTION_PROTOCOLS.find(p => p.family === "OFF")!
  const result = previewPendingMethodExplanation(rest)
  expect(result.notApplicable.map(item => item.item)).toEqual([
    "EXACT_WORK_AND_INTENSITY_RATIONALE", "EXACT_RECOVERY_RATIONALE",
  ])
  expect(result.pending).toEqual(["CURRENT_CYCLE_PLACEMENT", "INDIVIDUAL_APPLICABILITY", "EXACT_OWNER_ADOPTION"])
  expect(result.executionAuthority).toBe("NONE")
  expect(result.intensityReview.range).toBeNull()
  for (const p of METHOD_ADOPTION_PROTOCOLS.filter(p => p.family !== "OFF")) {
    const active = previewPendingMethodExplanation(p)
    expect(active.notApplicable).toEqual([])
    expect(active.pending).toContain("EXACT_RECOVERY_RATIONALE")
    expect(active.intensityReview.status).toBe("EXISTING_SESSION_GUIDANCE_NOT_EXACT_REPETITION_TARGET")
    expect(active.pending).toContain("EXACT_WORK_AND_INTENSITY_RATIONALE")
  }
})

it("keeps existing family RPE guidance distinct from a new prescription approval", () => {
  const expected: Record<string, [number, number]> = { BASE: [3, 4], LT: [5, 6], VO2: [7, 8], GLY: [7, 8], "ATP-PC": [8, 9], MIX: [6, 7], REC: [1, 2] }
  for (const p of METHOD_ADOPTION_PROTOCOLS.filter(p => p.family !== "OFF")) {
    const result = previewPendingMethodExplanation(p)
    const [minimum, maximum] = expected[p.family]!
    expect(result.intensityReview.range).toEqual({ minimum, maximum })
    expect(result.pending).toContain("EXACT_OWNER_ADOPTION")
    expect(result.personalEvidence).toEqual([])
  }
})

it("connects every proposal to existing general explanations without claiming dose adoption", () => {
  for (const p of [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]) {
    const result = previewPendingMethodExplanation(p)
    expect(result.executionAuthority).toBe("NONE")
    expect(result.generalExplanation.scope).toBe("TRAINING_FAMILY_NOT_EXACT_DOSE")
    expect(result.generalExplanation.sources.length).toBeGreaterThan(0)
    expect(result.personalEvidence).toEqual([])
    expect(result.methodDesign.status).toBe("COACHING_DRAFT_REQUIRES_ADOPTION")
    expect(result.methodDesign.work.length).toBeGreaterThan(10)
    expect(result.methodDesign.recovery.length).toBeGreaterThan(10)
    expect(result.methodDesign.tradeoff.length).toBeGreaterThan(10)
    expect(result.pending).toContain("EXACT_OWNER_ADOPTION")
    expect(result.contentFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(result.exactStructure.repetitionsPerSet).toBe(p.reps)
  }
})

it("does not copy extra memo or identity fields from a proposal or its segments", () => {
  const p = structuredClone(METHOD_ADOPTION_PROTOCOLS.find(p => p.id === "P-GLY-S")!)
  const before = previewPendingMethodExplanation(p)
  Object.assign(p, { memo: "PRIVATE_SENTINEL", athleteId: "PRIVATE_SENTINEL" })
  Object.assign(p.work[0]!, { symptomClause: "PRIVATE_SENTINEL" })
  Object.assign(p.between!, { note: "PRIVATE_SENTINEL" })
  const after = previewPendingMethodExplanation(p)
  expect(JSON.stringify(after)).not.toContain("PRIVATE_SENTINEL")
  expect(after.contentFingerprint).toBe(before.contentFingerprint)
  expect(Object.keys(after.exactStructure.orderedParts[0]!).sort()).toEqual(["boundary", "rep", "role", "set", "unit", "value"])
})

it("changes explanation identity with recovery and leaves past previews unchanged", () => {
  const p = structuredClone(METHOD_ADOPTION_PROTOCOLS.find(p => p.id === "P-GLY-S")!)
  const before = previewPendingMethodExplanation(p)
  p.setRest!.value = 301
  const after = previewPendingMethodExplanation(p)
  expect(after.contentFingerprint).not.toBe(before.contentFingerprint)
  expect(before.exactStructure.orderedParts.find(p => p.boundary === "BETWEEN_SETS")?.value).toBe(300)
  expect(after.exactStructure.orderedParts.find(p => p.boundary === "BETWEEN_SETS")?.value).toBe(301)
  expect(() => previewPendingMethodExplanation({ ...p, family: "UNKNOWN" })).toThrow()
  expect(() => previewPendingMethodExplanation({ ...p, method: "UNKNOWN" })).toThrow()
})
