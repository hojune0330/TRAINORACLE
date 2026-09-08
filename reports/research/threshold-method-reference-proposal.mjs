import { calculateThresholdReferenceProposal } from "./threshold-reference-proposal.mjs"
import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS, expandProposal } from "./method-adoption-protocols.mjs"

// A review projection of exact method geometry, never a runtime adoption.
export function previewThresholdMethodReference(input) {
  const unavailable = { kind: "unavailable", executionAuthority: "NONE" }
  const reference = calculateThresholdReferenceProposal(input)
  if (reference.kind !== "research_reference") return unavailable
  const matches = [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]
    .filter(p => p.id === input.protocolId && p.family === "LT")
  if (matches.length !== 1) return unavailable
  const protocol = matches[0]
  let parts
  try { parts = expandProposal(protocol) } catch { return unavailable }
  if (parts.some(part => part.unit !== "SECONDS")
    || protocol.work.some(part => part.role !== "WORK")
    || parts.filter(part => part.role === "WORK").some(part => part.value > 1200)) return unavailable
  const exactProtocol = structuredClone(protocol)
  return {
    kind: "threshold_method_review_preview", executionAuthority: "NONE",
    protocol: exactProtocol,
    reference: {
      ...reference,
      applicability: { ...reference.applicability, protocolBound: true },
      pendingReviews: reference.pendingReviews.filter(item => item !== "EXACT_PROTOCOL_BINDING"),
    },
    instructions: parts.map((part, index) => ({
      partIndex: index, ...part,
      stopRule: { kind: "DURATION", seconds: part.value },
      paceReference: part.role === "WORK" ? {
        secondsPerKm: [...reference.secondsPerKm],
        secondsPer400m: [...reference.secondsPer400m],
        distanceCompletionRequired: false,
      } : null,
    })),
    cue: "정해진 시간이 되면 운동 구간을 마쳐요. 참고 거리를 채우려고 더 달리지 않아요.",
    limitations: ["COACHING_GUIDELINE_NOT_MEASURED_THRESHOLD", "SPLIT_AND_INTRO_DOSE_NOT_VALIDATED_BY_FORMULA",
      "SOURCE_WEEKLY_VOLUME_CONDITIONS_NOT_ASSESSED", "NO_RECOVERY_PACE_DERIVED"],
  }
}
