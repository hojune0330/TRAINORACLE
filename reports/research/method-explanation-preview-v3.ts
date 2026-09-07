import { TRAINING_EXPLANATION_PROFILES, EXPLANATION_SOURCES } from "../../app/src/domain/training-explanation-profiles"
import type { PlannedEnergyIntent } from "../../impl/src/plan-generator/types"
import { canonicalJsonFingerprint } from "../../impl/src/plan-generator/candidate-identity"
import { deriveSequenceV3Totals } from "../../impl/src/prescription/sequence-v3"
import { representPendingWholeSessionV3, type PendingMethodProtocol } from "./method-proposal-sequence-v3"
import { expandProposal } from "./method-adoption-protocols.mjs"
import { METHOD_DESIGN_RATIONALES } from "./method-design-rationales-v3"
import { rpeForIntent } from "../../impl/src/plan-generator/session-builder"

const profileKeys: Record<string, PlannedEnergyIntent | "REST"> = {
  BASE: "BASE_INTENT", LT: "LT_INTENT", VO2: "VO2_INTENT", "ATP-PC": "ATP_PC_INTENT",
  GLY: "GLY_INTENT", MIX: "MIXED_INTENT", REC: "RECOVERY_INTENT", OFF: "REST",
}

/** Assembles review material, never an adopted explanation receipt or a personal diagnosis. */
export function previewPendingMethodExplanation(p: PendingMethodProtocol) {
  const key = profileKeys[p.family]
  if (!key) throw Error("UNKNOWN_FAMILY")
  const general = TRAINING_EXPLANATION_PROFILES[key]
  const rationale = METHOD_DESIGN_RATIONALES[p.method]
  if (!rationale) throw Error("MISSING_METHOD_RATIONALE")
  const representation = representPendingWholeSessionV3(p)
  const noExercise = representation.kind === "no_exercise"
  const sources = general.sourceIds.map(id => {
    const source = EXPLANATION_SOURCES[id]
    if (!source) throw Error("MISSING_GENERAL_SOURCE")
    return source
  })
  const content = {
    version: "0.2", protocolId: p.id, method: p.method,
    executionAuthority: "NONE" as const, status: "REVIEW_PREVIEW_NOT_ADOPTED" as const,
    generalExplanation: { scope: "TRAINING_FAMILY_NOT_EXACT_DOSE" as const, profile: general, sources },
    intensityReview: key === "REST" ? {
      status: "NOT_APPLICABLE" as const, range: null,
      explanation: "계획된 운동이 없어 RPE 목표를 부여하지 않습니다. 실제 하루 활동량이나 회복 상태를 0으로 판단하지 않습니다.",
    } : {
      status: "EXISTING_SESSION_GUIDANCE_NOT_EXACT_REPETITION_TARGET" as const,
      range: rpeForIntent(key),
      explanation: "현재 계획 엔진의 목적별 체감 강도 안내입니다. 이 초안의 정확한 반복 강도로 채택된 값이나 개인 역치·최대속도 측정값이 아닙니다. 짧은 반복의 출력과 회복 조건은 별도로 검토합니다.",
    },
    methodDesign: { status: "COACHING_DRAFT_REQUIRES_ADOPTION" as const, version: "0.1", ...rationale },
    exactStructure: { sets: p.sets, repetitionsPerSet: p.reps,
      orderedParts: expandProposal(p).map(({ role, unit, value, boundary, set, rep }) =>
        ({ role, unit, value, boundary, set, rep })), representation,
      totals: representation.kind === "represented" ? deriveSequenceV3Totals(representation.sequence) : null },
    personalEvidence: [] as never[],
    notApplicable: noExercise ? [
      { item: "EXACT_WORK_AND_INTENSITY_RATIONALE", reason: "계획된 운동 구간이 없어 운동 강도나 반복량을 정하지 않습니다." },
      { item: "EXACT_RECOVERY_RATIONALE", reason: "반복 사이 회복 구간이 없습니다. 휴식일의 주기 배치 이유와 회복 완료 여부는 별개입니다." },
    ] : [],
    pending: [...(noExercise ? [] : ["EXACT_WORK_AND_INTENSITY_RATIONALE", "EXACT_RECOVERY_RATIONALE"]), "CURRENT_CYCLE_PLACEMENT",
      "INDIVIDUAL_APPLICABILITY", "EXACT_OWNER_ADOPTION"],
  }
  // A detached review snapshot cannot change when the source catalog is edited later.
  return structuredClone({ ...content, contentFingerprint: canonicalJsonFingerprint("pending-method-explanation-v3", content) })
}
