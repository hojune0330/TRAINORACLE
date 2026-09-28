import { adjustmentPolicyReference } from "@impl/prescription/prescription-adjustment"
import { applyAdjustmentDraftV3, configurationReferenceV3, createAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { AdjustmentAuthorityV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import type { ReviewedAdjustedExplanationV3 } from "./adjusted-method-snapshot-v3"
import type { ReviewedMultiAdjustedPlanPolicyV3 } from "./adjusted-plan-multi-review-v3"
import type { ReviewedRpeSourceBindingV3 } from "./rpe-adjusted-slot-v3"
import { prepareUnanchoredAdjustmentOfferV3, type UnanchoredAdjustmentOfferInputV3 } from "./unanchored-adjustment-offer-v3"
import type { ReviewedMultiSourceSlotV3 } from "./assemble-reviewed-multi-materials-v3"
import { createCatalogMultiPlanRuntimeV3, type ReviewedMultiRuntimeCatalogV3 } from "../screens/plan-beta/assembled-multi-plan-runtime-v3"

const DECISION_REF = "reports/review/LT_PILOT_OWNER_ADOPTION_DECISION_2026-09-28.md"
const SOURCE_RECHECK_REF = "reports/review/WORKOUT_SUPPLY_LT_SOURCE_RECHECK_2026-09-28.md"
const VERSION = "1.0.0"
const ADOPTED_AT_MS = Date.parse("2026-09-28T03:00:00.000Z")
const VALID_FROM_MS = Date.parse("2026-09-28T00:00:00.000Z")
const EXPIRES_AT_MS = Date.parse("2028-09-28T00:00:00.000Z")

// These fingerprints are filled from the exact structures below and then kept as
// a fail-closed adoption boundary. New events, layouts or doses cannot self-enrol.
const REVIEWED_RPE_SCOPE_FINGERPRINT = "sha256:70e1eeb35437bea0c77e81343fe93ab9f114d57f840ef5f0202959d0f0e21d7b"
const REVIEWED_PLAN_SCOPE_FINGERPRINTS = {
  BALANCED: "sha256:496777109d11669a7ba31e9bf4b267357ed27059252772e5c8a1f5d25085ca02",
  CONSERVATIVE: "sha256:fcd4c09197ed3b428794f4b2161795bb8b72bb741fbea0154980a15e8d2e8c00",
} as const

const effortTarget = { kind: "EFFORT_GUIDANCE" as const,
  cue: "힘들지만 정해진 구간 동안 고르게 유지하는 노력 · 본운동 체감 제안 RPE 6~7" }

function warmup(): readonly SequenceNodeV3[] {
  return [
    { kind: "segment", id: "warmup-0", label: "편안한 준비 조깅", repeatCount: 1,
      recoveryBetweenRepeats: [], recoveryAfter: [], role: "PREPARATION",
      work: { kind: "duration", distanceM: null, durationSeconds: 900 },
      target: { kind: "EFFORT_GUIDANCE", cue: "RPE 2-3" } },
    ...[1, 3, 5, 7].map((suffix, index): SequenceNodeV3 => ({ kind: "segment", id: `warmup-${suffix}`,
      label: "점진적 가속", repeatCount: 1, recoveryBetweenRepeats: [],
      recoveryAfter: [{ mode: "WALK", seconds: index === 3 ? 60 : 40 }], role: "BUILDUP",
      work: { kind: "duration", distanceM: null, durationSeconds: 20 },
      target: { kind: "EFFORT_GUIDANCE", cue: "점진적으로 속도를 올리되 전력질주하지 않기" } })),
  ]
}

function cooldown(): readonly SequenceNodeV3[] {
  return [{ kind: "segment", id: "cooldown-0", label: "편안한 정리 조깅", repeatCount: 1,
    recoveryBetweenRepeats: [], recoveryAfter: [], role: "PREPARATION",
    work: { kind: "duration", distanceM: null, durationSeconds: 600 },
    target: { kind: "EFFORT_GUIDANCE", cue: "RPE 1-2" } }]
}

function sequence(id: string, label: string, repeatCount: number, workSeconds: number): PrescriptionSequenceV3 {
  return { kind: "PRESCRIPTION_SEQUENCE", version: 3, id, label, warmup: warmup(),
    main: [{ kind: "group", id: "repetitions", label: null, repeatCount,
      recoveryBetweenRepeats: repeatCount === 1 ? [] : [{ mode: "JOG", seconds: 60 }], recoveryAfter: [],
      repeatUnit: "REPETITION", children: [{ kind: "segment", id: "part-0", label: null, repeatCount: 1,
        recoveryBetweenRepeats: [], recoveryAfter: [], role: "WORK",
        work: { kind: "duration", distanceM: null, durationSeconds: workSeconds }, target: effortTarget }] }],
    cooldown: cooldown() }
}

const BASELINE_SEQUENCE: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3,
  id: "TO-LT-PILOT-INTERNAL-BASELINE", label: "기존 시간·RPE 범위", warmup: warmup(),
  main: [{ kind: "segment", id: "baseline-main", label: null, repeatCount: 1,
    recoveryBetweenRepeats: [], recoveryAfter: [], role: "WORK",
    work: { kind: "duration", distanceM: null, durationSeconds: 1800 },
    target: { kind: "EFFORT_GUIDANCE", cue: "기존 계획 안내 RPE 5~6" } }], cooldown: cooldown() }
const CONTINUOUS_SEQUENCE = sequence("P-LT-C", "20분 연속", 1, 1200)
const SPLIT_TEN_SEQUENCE = sequence("P-LT-B", "10분×2 · 사이 1분 조깅", 2, 600)
const SPLIT_EIGHT_SEQUENCE = sequence("P-LT-B-480", "8분×2 · 사이 1분 조깅", 2, 480)

const BASELINE_REF = configurationReferenceV3({ familyId: "TO-LT-PILOT-INTERNAL", configurationId: "BASELINE", version: VERSION }, BASELINE_SEQUENCE)
const CONTINUOUS_REF = configurationReferenceV3({ familyId: "TO-LT-CONTINUOUS", configurationId: "P-LT-C", version: VERSION }, CONTINUOUS_SEQUENCE)
const SPLIT_TEN_REF = configurationReferenceV3({ familyId: "TO-LT-SPLIT", configurationId: "P-LT-B", version: VERSION }, SPLIT_TEN_SEQUENCE)
const SPLIT_EIGHT_REF = configurationReferenceV3({ familyId: "TO-LT-SPLIT", configurationId: "P-LT-B-480", version: VERSION }, SPLIT_EIGHT_SEQUENCE)

const SOURCE_CONTEXT_KEY = "TO-LT-PILOT-5000-EXPERIENCED-9D-3D-SINGLE"
const SOURCE_POLICY = { policyId: "TO-LT-PILOT-OWNER-ADOPTION", version: VERSION, reviewRef: DECISION_REF,
  contextKey: SOURCE_CONTEXT_KEY, validFromMs: VALID_FROM_MS, expiresAtMs: EXPIRES_AT_MS,
  allowedEdges: [CONTINUOUS_REF, SPLIT_TEN_REF, SPLIT_EIGHT_REF].map(to => ({ from: BASELINE_REF, to })) }
const SOURCE_AUTHORITY: AdjustmentAuthorityV3 = { catalog: [
  { familyId: "TO-LT-PILOT-INTERNAL", reviewRef: DECISION_REF,
    configurations: [{ configurationId: "BASELINE", version: VERSION, sequence: BASELINE_SEQUENCE }] },
  { familyId: "TO-LT-CONTINUOUS", reviewRef: DECISION_REF,
    configurations: [{ configurationId: "P-LT-C", version: VERSION, sequence: CONTINUOUS_SEQUENCE }] },
  { familyId: "TO-LT-SPLIT", reviewRef: DECISION_REF, configurations: [
    { configurationId: "P-LT-B", version: VERSION, sequence: SPLIT_TEN_SEQUENCE },
    { configurationId: "P-LT-B-480", version: VERSION, sequence: SPLIT_EIGHT_SEQUENCE },
  ] },
], policies: [SOURCE_POLICY] }

function sourceAt(nowMs: number): UnanchoredAdjustmentOfferInputV3 {
  return { kind: "UNANCHORED_SOURCE_V3", authority: SOURCE_AUTHORITY,
    policy: adjustmentPolicyReference(SOURCE_POLICY), current: BASELINE_REF,
    contextKey: SOURCE_CONTEXT_KEY, resolutionRevision: VERSION, nowMs }
}

function nodeIds(sequenceValue: PrescriptionSequenceV3): readonly string[] {
  const result: string[] = []
  const visit = (nodes: readonly SequenceNodeV3[]) => nodes.forEach(node => {
    result.push(node.id)
    if (node.kind === "group") visit(node.children)
  })
  visit(sequenceValue.warmup); visit(sequenceValue.main); visit(sequenceValue.cooldown)
  return result
}

function explanation(configuration: typeof CONTINUOUS_REF, sequenceValue: PrescriptionSequenceV3,
  fields: Pick<ReviewedAdjustedExplanationV3, "purpose" | "workRationale" | "recoveryRationale" | "expectedAdaptation" | "limitations" | "observation">,
  resolutionContextKey: string): ReviewedAdjustedExplanationV3 {
  return { configuration, resolutionContextKey, version: VERSION, reviewRef: DECISION_REF,
    purpose: fields.purpose,
    energySupply: "LT는 독립된 에너지 시스템이 아니에요. 이 구간에서는 산화 대사가 주요하게 에너지를 공급하고 해당과정도 함께 기여해요. 유산은 단순한 노폐물이 아니며 생성과 이용이 함께 일어나요.",
    workRationale: fields.workRationale,
    recoveryRationale: fields.recoveryRationale,
    cycleRole: "9일 계획의 5일차 주요 훈련으로 배치해, 앞뒤 쉬운 날과 휴식일 사이에서 지속적인 노력을 확인해요.",
    expectedAdaptation: fields.expectedAdaptation,
    limitations: fields.limitations,
    observation: fields.observation,
    evidenceRefs: ["TO-WORKOUT-SUPPLY-LT-SOURCE-RECHECK-20260928", "METHOD-OWNER-REVIEW-BUNDLE-V3", "PMID-10562610", "VDOTO2-THRESHOLD-2025-06"],
    sequenceContentIdentity: sequenceV3ContentIdentity(sequenceValue), nodeIds: nodeIds(sequenceValue) }
}

function buildStaticMaterials() {
  const source = sourceAt(ADOPTED_AT_MS)
  const offer = prepareUnanchoredAdjustmentOfferV3(source)
  if (offer.kind !== "available") return null
  const draft = createAdjustmentDraftV3({ authority: offer.authority, current: offer.current, policy: offer.policy,
    contextKey: offer.contextKey, target: CONTINUOUS_REF, nowMs: ADOPTED_AT_MS })
  if (draft.kind !== "draft") return null
  const applied = applyAdjustmentDraftV3({ authority: offer.authority, current: offer.current, draft: draft.draft,
    contextKey: offer.contextKey, nowMs: ADOPTED_AT_MS, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") return null
  const explanations: readonly ReviewedAdjustedExplanationV3[] = [
    explanation(CONTINUOUS_REF, CONTINUOUS_SEQUENCE, {
      purpose: "끊지 않고 20분 동안 RPE 6~7의 고른 노력을 유지하는 방법을 익혀요.",
      workRationale: "본운동을 20분 연속으로 진행해, 회복 구간 없이 노력을 고르게 조절하는 경험을 만들어요.",
      recoveryRationale: "연속형이므로 본운동 사이 회복은 없어요. 준비 가속 사이에는 걷기를, 끝난 뒤에는 10분의 편안한 조깅을 두어 수행 구간과 정리 구간을 구분해요.",
      expectedAdaptation: "일정한 체감 강도를 끊지 않고 유지하는 페이싱 경험과 지속적인 유산소 노력을 연습할 수 있어요.",
      limitations: "실험실에서 측정한 개인 역치값이 아니고 RPE로 조절하는 파일럿이에요. 성과 향상이나 회복 완료를 보장하지 않고, 강도·양·빈도를 자동으로 늘리지 않아요.",
      observation: "후반에 RPE가 급격히 오르는지, 달리기 동작과 속도를 고르게 유지했는지, 다음 날 통증이나 과도한 피로가 남는지를 일지로 확인해요.",
    }, offer.contextKey),
    explanation(SPLIT_TEN_REF, SPLIT_TEN_SEQUENCE, {
      purpose: "10분 노력을 두 번 나누어 수행하며 RPE 6~7의 지속적인 노력을 반복해요.",
      workRationale: "10분씩 2회로 나누면 총 20분의 본운동 시간을 유지하면서도, 중간에 노력을 다시 정리하고 두 번째 구간의 페이싱을 확인할 수 있어요.",
      recoveryRationale: "두 구간 사이에 1분을 천천히 조깅해요. 완전히 회복했다고 간주하는 휴식이 아니라, 두 번째 구간을 같은 체감 강도로 재시작하도록 구성한 짧은 능동 회복이에요.",
      expectedAdaptation: "지속적인 유산소 노력을 나눠 반복하고, 짧은 회복 뒤에 동일한 노력을 다시 조절하는 경험을 얻을 수 있어요.",
      limitations: "분할형은 연속형과 수행 감각이 다르며 둘의 부담과 효과가 같다고 단정하지 않아요. RPE는 개인이 느낀 강도이며 실험실 역치를 대체하지 않아요.",
      observation: "첫 구간과 둘째 구간의 RPE 차이, 1분 조깅 뒤 재시작 가능 여부, 마지막 구간의 동작과 다음 날 반응을 일지로 확인해요.",
    }, offer.contextKey),
    explanation(SPLIT_EIGHT_REF, SPLIT_EIGHT_SEQUENCE, {
      purpose: "8분 노력을 두 번 나누어 수행하며 RPE 6~7의 고른 노력을 연습해요.",
      workRationale: "10분×2와 같은 분할형 방법을 유지하되, 각 구간을 8분으로 줄여 총 본운동 시간을 16분으로 낮춘 조절안이에요.",
      recoveryRationale: "두 구간 사이에 1분을 천천히 조깅해요. 구간 시간만 줄였으며, 회복을 늘려 부담을 임의로 다시 설계하지는 않았어요.",
      expectedAdaptation: "분할형 지속 노력의 수행 감각을 익히면서 10분×2보다 적은 총 본운동 시간으로 상태를 확인할 수 있어요.",
      limitations: "시간을 줄였다는 이유만으로 안전하거나 회복됐다고 판정하지 않아요. 성과 향상을 보장하지 않고 다음 계획의 양을 자동으로 늘리지 않아요.",
      observation: "두 구간의 RPE와 동작 유지 여부, 1분 조깅 뒤 재시작 반응, 완료 후 피로와 다음 날 통증을 일지로 확인해요.",
    }, offer.contextKey),
  ]
  const slot: ReviewedMultiSourceSlotV3 = { address: { day: 5, slot: "AM" }, source,
    experienceBand: "EXPERIENCED", initialReceipt: applied.receipt, explanations }
  return { source, offer, slot, explanations }
}

const STATIC = buildStaticMaterials()

function adoptedCatalog(): ReviewedMultiRuntimeCatalogV3 {
  if (!STATIC || !REVIEWED_RPE_SCOPE_FINGERPRINT.startsWith("sha256:")) return { current: [], retained: [] }
  const binding: ReviewedRpeSourceBindingV3 = { bindingId: "TO-LT-PILOT-RPE-BINDING", version: VERSION,
    scopeFingerprint: REVIEWED_RPE_SCOPE_FINGERPRINT, reviewRef: DECISION_REF,
    validFromMs: VALID_FROM_MS, expiresAtMs: EXPIRES_AT_MS, revokedAtMs: null }
  const policies = (Object.entries(REVIEWED_PLAN_SCOPE_FINGERPRINTS) as readonly ["BALANCED" | "CONSERVATIVE", string][])
    .filter((entry): entry is ["BALANCED" | "CONSERVATIVE", `sha256:${string}`] => entry[1].startsWith("sha256:"))
    .map(([kind, scopeFingerprint]): ReviewedMultiAdjustedPlanPolicyV3 => ({ scopeVersion: "MULTI_STRUCTURAL_V3",
      policyId: `TO-LT-PILOT-${kind}`, version: VERSION, scopeFingerprint,
      configurationReviewRef: DECISION_REF, exposureReviewRef: DECISION_REF,
      interactionReviewRef: DECISION_REF, safetyReviewRef: DECISION_REF,
      validFromMs: VALID_FROM_MS, expiresAtMs: EXPIRES_AT_MS, revokedAtMs: null }))
  if (policies.length !== 2) return { current: [], retained: [] }
  const current = policies.map(policy => ({ slots: [STATIC.slot], rpeBindings: [binding], policies: [policy] }))
  const retained = policies.map(policy => ({ slots: [{ address: STATIC.slot.address,
    authority: STATIC.source.authority, explanation: STATIC.explanations[0]! }], rpeBindings: [binding], policies: [policy] }))
  return { current, retained }
}

export const LT_PILOT_MULTI_PLAN_RUNTIME_V3 = createCatalogMultiPlanRuntimeV3({
  readCatalog: adoptedCatalog,
  orderedChoicesFor: address => address.day === 5 && address.slot === "AM"
    ? [{ dimension: "time", configurations: [SPLIT_EIGHT_REF, SPLIT_TEN_REF] }] : [],
})

export const LT_PILOT_RUNTIME_METADATA = Object.freeze({ decisionRef: DECISION_REF, sourceRecheckRef: SOURCE_RECHECK_REF,
  status: "OWNER_APPROVED_LIMITED_RUNTIME_PILOT" as const, eventDistanceM: 5000,
  methods: [CONTINUOUS_REF, SPLIT_TEN_REF], adjustment: SPLIT_EIGHT_REF })
