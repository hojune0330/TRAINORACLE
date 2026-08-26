import { describe, expect, it } from "vitest"
import {
  canonicalJsonSha256,
  createPlanAdaptationProposal,
  hashPlanCandidate,
  verifyPlanAdaptationProposal,
} from "../src/plan-generator/adaptation"
import {
  ADAPTATION_TRANSFORM_REGISTRY,
  ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT,
  validateAdaptationTransformRegistry,
} from "../src/plan-generator/adaptation-transform-registry"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import type { PlanCandidate } from "../src/plan-generator/types"
import { baseRequest, clearedGate, expectGenerated } from "./fixtures/plan-beta-request"

const CREATED_AT = "2026-08-18T00:05:00.000Z"

async function requestFor(
  baseCandidate: PlanCandidate,
  proposedCandidate: PlanCandidate,
  trigger: {
    readonly kind: "EXPLICIT_REQUEST"
    readonly requestedBy: "ATHLETE"
    readonly sourceRef: string
  } | {
    readonly kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START"
    readonly explicitlyConfirmed: true
    readonly recordId: string
    readonly purpose: "PERSONAL_BEST"
    readonly eventDistanceM: 1500
    readonly performanceSeconds: number
    readonly achievedAt: string
    readonly sourceRef: string
    readonly historicalOrBackfilled: false
  },
) {
  return createPlanAdaptationProposal({
    kind: "PLAN_ADAPTATION_PROPOSAL_REQUEST",
    scope: {
      athleteId: "athlete-1",
      eventDistanceM: 1500,
      pairId: baseCandidate.pairId,
      selectedDetailedTemplateRef: baseCandidate.selectedDetailedTemplateRef,
    },
    activePlanStartedAt: "2026-08-01T00:00:00.000Z",
    baseCandidate,
    proposedCandidate,
    baseContentHash: await hashPlanCandidate(baseCandidate),
    proposalOrigin: "SELF_SERVICE",
    trigger,
    changeDimension: "VOLUME",
    safetyGate: clearedGate(),
    safetyEvaluatedAt: "2026-08-18T00:00:00.000Z",
    safetyValidUntil: "2026-08-18T00:10:00.000Z",
    activeHold: false,
    createdAt: CREATED_AT,
    idempotencyKey: `sha256:${"7".repeat(64)}`,
  })
}

describe("versioned adaptation transform registry", () => {
  it("contains exactly two active VOLUME edges and inactive unauthorized families", () => {
    expect(validateAdaptationTransformRegistry(ADAPTATION_TRANSFORM_REGISTRY)).toBe(true)
    expect(ADAPTATION_TRANSFORM_REGISTRY.activeEdges.map((edge) => edge.edgeId)).toEqual([
      "BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY",
      "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY",
    ])
    expect(ADAPTATION_TRANSFORM_REGISTRY.inactiveFamilies).toEqual([
      { dimension: "FREQUENCY", status: "INACTIVE_NOT_AUTHORIZED" },
      { dimension: "INTENSITY", status: "INACTIVE_NOT_AUTHORIZED" },
    ])
  })

  it.each([
    ["deleted edge", { ...ADAPTATION_TRANSFORM_REGISTRY, activeEdges: ADAPTATION_TRANSFORM_REGISTRY.activeEdges.slice(1) }],
    ["deactivated edge", { ...ADAPTATION_TRANSFORM_REGISTRY, activeEdges: [{ ...ADAPTATION_TRANSFORM_REGISTRY.activeEdges[0], status: "INACTIVE" }, ADAPTATION_TRANSFORM_REGISTRY.activeEdges[1]] }],
    ["exchanged edge IDs", { ...ADAPTATION_TRANSFORM_REGISTRY, activeEdges: [{ ...ADAPTATION_TRANSFORM_REGISTRY.activeEdges[0], edgeId: ADAPTATION_TRANSFORM_REGISTRY.activeEdges[1].edgeId }, { ...ADAPTATION_TRANSFORM_REGISTRY.activeEdges[1], edgeId: ADAPTATION_TRANSFORM_REGISTRY.activeEdges[0].edgeId }] }],
    ["active frequency", { ...ADAPTATION_TRANSFORM_REGISTRY, inactiveFamilies: [{ dimension: "FREQUENCY", status: "ACTIVE" }, ADAPTATION_TRANSFORM_REGISTRY.inactiveFamilies[1]] }],
    ["active intensity", { ...ADAPTATION_TRANSFORM_REGISTRY, inactiveFamilies: [ADAPTATION_TRANSFORM_REGISTRY.inactiveFamilies[0], { dimension: "INTENSITY", status: "ACTIVE" }] }],
    ["revoked edge", { ...ADAPTATION_TRANSFORM_REGISTRY, activeEdges: [ADAPTATION_TRANSFORM_REGISTRY.activeEdges[0], { ...ADAPTATION_TRANSFORM_REGISTRY.activeEdges[1], revoked: true }] }],
    ["invented edge expiry", { ...ADAPTATION_TRANSFORM_REGISTRY, activeEdges: [ADAPTATION_TRANSFORM_REGISTRY.activeEdges[0], { ...ADAPTATION_TRANSFORM_REGISTRY.activeEdges[1], expiresAt: "2026-08-24T00:00:00.000Z" }] }],
  ])("rejects %s registry mutation", (_label, registry) => {
    expect(validateAdaptationTransformRegistry(registry)).toBe(false)
  })

  it("binds both sibling-only VOLUME directions to registry and provenance", async () => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const [balanced, conservative] = generated.candidates
    const reduction = await requestFor(balanced, conservative, {
      kind: "EXPLICIT_REQUEST",
      requestedBy: "ATHLETE",
      sourceRef: "athlete-request:athlete-1:req-7",
    })
    const increase = await requestFor(conservative, balanced, {
      kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
      explicitlyConfirmed: true,
      recordId: "00000000-0000-4000-8000-000000000007",
      purpose: "PERSONAL_BEST",
      eventDistanceM: 1500,
      performanceSeconds: 245,
      achievedAt: "2026-08-12T00:00:00.000Z",
      sourceRef: "athlete-record:00000000-0000-4000-8000-000000000007",
      historicalOrBackfilled: false,
    })

    expect(reduction).toMatchObject({
      kind: "proposed",
      proposal: {
        transformEdgeId: "BALANCED_TO_CONSERVATIVE_EXISTING_SIBLING_ONLY",
        transformRegistryFingerprint: ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT,
        transformDirection: "REDUCE",
        expiresAt: "2026-08-21T00:05:00.000Z",
      },
    })
    expect(increase).toMatchObject({
      kind: "proposed",
      proposal: {
        transformEdgeId: "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY",
        transformRegistryFingerprint: ADAPTATION_TRANSFORM_REGISTRY_FINGERPRINT,
        transformDirection: "INCREASE",
        trigger: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
      },
    })
    if (increase.kind !== "proposed") throw new Error("Expected increase proposal")
    expect(increase.proposal.allowedJsonPointers.length).toBeGreaterThan(0)
    expect(increase.proposal.allowedJsonPointers.every((pointer) =>
      /^\/sessions\/\d+\/prescription\/durationMinutes\/maximum$/u.test(pointer),
    )).toBe(true)
    expect(await verifyPlanAdaptationProposal(increase.proposal)).toBe(true)
  })

  it("rejects registry metadata mutation even after recomputing the outer hash", async () => {
    const [balanced, conservative] = expectGenerated(generatePlanCandidates(baseRequest())).candidates
    const result = await requestFor(balanced, conservative, {
      kind: "EXPLICIT_REQUEST",
      requestedBy: "ATHLETE",
      sourceRef: "athlete-request:athlete-1:req-8",
    })
    if (result.kind !== "proposed") throw new Error("Expected proposal")
    const { proposalId: _proposalId, proposalHash: _proposalHash, ...content } = result.proposal
    const mutations = [
      { ...content, transformRegistryVersion: "trainoracle.plan-adaptation-transform-registry.v2" },
      { ...content, transformRegistryFingerprint: `sha256:${"0".repeat(64)}` },
      { ...content, transformEdgeId: "CONSERVATIVE_TO_BALANCED_EXISTING_SIBLING_ONLY" },
      { ...content, transformDirection: "INCREASE" },
      { ...content, predecessorPairFingerprint: `${content.pairId}:forged` },
      { ...content, sourceCandidateContentHash: `sha256:${"1".repeat(64)}` },
      { ...content, allowedJsonPointers: ["/sessions/0/plannedEnergyIntent"] },
      { ...content, triggerSnapshotHash: `sha256:${"2".repeat(64)}` },
      { ...content, safetySnapshotHash: `sha256:${"3".repeat(64)}` },
      { ...content, successorProvenanceHash: `sha256:${"4".repeat(64)}` },
      { ...content, expiresAt: "2026-08-21T00:05:00.001Z" },
      { ...content, edgeRevoked: true },
    ]
    for (const mutated of mutations) {
      const proposalHash = await canonicalJsonSha256("trainoracle.plan-adaptation-proposal.v1", mutated)
      expect(await verifyPlanAdaptationProposal({
        proposalId: `adaptation:${proposalHash.slice("sha256:".length)}`,
        proposalHash,
        ...mutated,
      })).toBe(false)
    }
  })

  it("does not use a PB/SB trigger for the reduction compatibility edge", async () => {
    const [balanced, conservative] = expectGenerated(generatePlanCandidates(baseRequest())).candidates
    expect(await requestFor(balanced, conservative, {
      kind: "SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START",
      explicitlyConfirmed: true,
      recordId: "00000000-0000-4000-8000-000000000009",
      purpose: "PERSONAL_BEST",
      eventDistanceM: 1500,
      performanceSeconds: 245,
      achievedAt: "2026-08-12T00:00:00.000Z",
      sourceRef: "athlete-record:00000000-0000-4000-8000-000000000009",
      historicalOrBackfilled: false,
    })).toEqual({ kind: "rejected", code: "UNAPPROVED_TRANSFORM" })
  })
})
