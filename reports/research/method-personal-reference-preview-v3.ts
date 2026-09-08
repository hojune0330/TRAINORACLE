import { calculateIntervalReferenceProposal, type IntervalReferenceInput } from "./interval-reference-proposal.mjs"
import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS } from "./method-adoption-protocols.mjs"
import { previewPendingMethodExplanation } from "./method-explanation-preview-v3"
import { canonicalJsonFingerprint } from "../../impl/src/plan-generator/candidate-identity"
import { previewThresholdMethodReference } from "./threshold-method-reference-proposal.mjs"

export function previewPendingThresholdReferenceV3(input: IntervalReferenceInput) {
  const method = previewThresholdMethodReference(input)
  if (method.kind !== "threshold_method_review_preview") return method
  const explanation = previewPendingMethodExplanation(method.protocol)
  const content = {
    kind: "threshold_personal_reference_review_preview" as const,
    executionAuthority: "NONE" as const,
    method, explanation,
    pendingReviews: [...new Set([...method.reference.pendingReviews, ...explanation.pending])],
    recordIdentityVerified: false,
    caveat: "현재 5km 기록으로 계산한 LT 참고 범위예요. 실제 역치를 측정한 값이 아니며, 날씨와 훈련 구성에 따른 검토가 필요해요.",
  }
  return structuredClone({ ...content, contentFingerprint: canonicalJsonFingerprint("pending-threshold-reference-v3", content) })
}

/** Reference arithmetic and exact method stay together, without claiming verified athlete data. */
export function previewPendingIntervalReferenceV3(input: IntervalReferenceInput) {
  const reference = calculateIntervalReferenceProposal(input)
  if (reference.kind !== "research_reference") return reference
  const matches = [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS].filter(p => p.id === reference.protocolId)
  if (matches.length !== 1) return { kind: "unavailable" as const, executionAuthority: "NONE" as const }
  const explanation = previewPendingMethodExplanation(matches[0]!)
  const content = {
    kind: "personal_reference_review_preview" as const, executionAuthority: "NONE" as const,
    explanation, reference,
    executionInstruction: {
      stopRule: { kind: "DURATION" as const, seconds: reference.prescription.workSeconds },
      intermediateReferences: [
        { distanceM: 400, seconds: reference.secondsPer400m },
        { distanceM: 1000, seconds: reference.secondsPerKm },
      ],
      intermediateDistanceIsRequired: false,
      recovery: { mode: reference.recoveryMode, seconds: reference.prescription.restSeconds,
        count: reference.prescription.repeats - 1, finalRecovery: null },
      cue: "정해진 시간이 되면 본운동 구간을 마쳐요. 400m나 1km를 채우려고 더 달리지 않아요.",
    },
    caveat: "현재 5km 기록의 평균 페이스를 참고한 값이에요. 측정한 최대산소섭취 페이스나 개인 최적 강도는 아니에요.",
    recordIdentityVerified: false,
  }
  return structuredClone({ ...content, contentFingerprint: canonicalJsonFingerprint("pending-personal-reference-v3", content) })
}
