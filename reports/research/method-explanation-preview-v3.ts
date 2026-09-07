import { TRAINING_EXPLANATION_PROFILES, EXPLANATION_SOURCES, type TrainingExplanationKey } from "../../app/src/domain/training-explanation-profiles"
import { canonicalJsonFingerprint } from "../../impl/src/plan-generator/candidate-identity"
import { deriveSequenceV3Totals } from "../../impl/src/prescription/sequence-v3"
import { representPendingWholeSessionV3, type PendingMethodProtocol } from "./method-proposal-sequence-v3"
import { expandProposal } from "./method-adoption-protocols.mjs"
import { METHOD_DESIGN_RATIONALES } from "./method-design-rationales-v3"

const profileKeys: Record<string, TrainingExplanationKey> = {
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
  const sources = general.sourceIds.map(id => {
    const source = EXPLANATION_SOURCES[id]
    if (!source) throw Error("MISSING_GENERAL_SOURCE")
    return source
  })
  const content = {
    version: "0.1", protocolId: p.id, method: p.method,
    executionAuthority: "NONE" as const, status: "REVIEW_PREVIEW_NOT_ADOPTED" as const,
    generalExplanation: { scope: "TRAINING_FAMILY_NOT_EXACT_DOSE" as const, profile: general, sources },
    methodDesign: { status: "COACHING_DRAFT_REQUIRES_ADOPTION" as const, version: "0.1", ...rationale },
    exactStructure: { sets: p.sets, repetitionsPerSet: p.reps,
      orderedParts: expandProposal(p).map(({ role, unit, value, boundary, set, rep }) =>
        ({ role, unit, value, boundary, set, rep })), representation,
      totals: representation.kind === "represented" ? deriveSequenceV3Totals(representation.sequence) : null },
    personalEvidence: [] as never[],
    pending: ["EXACT_WORK_AND_INTENSITY_RATIONALE", "EXACT_RECOVERY_RATIONALE", "CURRENT_CYCLE_PLACEMENT",
      "INDIVIDUAL_APPLICABILITY", "EXACT_OWNER_ADOPTION"],
  }
  // A detached review snapshot cannot change when the source catalog is edited later.
  return structuredClone({ ...content, contentFingerprint: canonicalJsonFingerprint("pending-method-explanation-v3", content) })
}
