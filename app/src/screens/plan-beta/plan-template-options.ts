import type { PlannedEnergyIntent } from "@impl/plan-generator/types"
import { DETAILED_PRESCRIPTION_APPROVALS } from "../../domain/detailed-prescription-approvals"
import { resolveDetailedPrescriptionRuntimeAuthority } from "../../domain/detailed-prescription-runtime-authority"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { parsePrescriptionNotation } from "@impl/prescription/notation"
import { formatTrainingSeconds } from "./labels"

export type DetailedPlanTemplateOption = {
  readonly ref: PlanBetaIntake["selectedDetailedTemplateRef"] & object
  readonly notation: string
  readonly targetEventDistanceM: PlanBetaIntake["eventDistanceM"]
  readonly trainingFocus: PlannedEnergyIntent
  readonly mainSummary: string
  readonly recoverySummary: string
  readonly preparationSummary: string
}

export function resolveDetailedPlanTemplateOption(
  draft: Pick<Partial<PlanBetaIntake>, "eventDistanceM" | "trainingFocus" | "experienceBand">,
  evaluatedAt = new Date().toISOString(),
): DetailedPlanTemplateOption | null {
  return resolveDetailedPlanTemplateOptions(draft, evaluatedAt)[0] ?? null
}

export function resolveDetailedPlanTemplateOptions(
  draft: Pick<Partial<PlanBetaIntake>, "eventDistanceM" | "trainingFocus" | "experienceBand">,
  evaluatedAt = new Date().toISOString(),
): readonly DetailedPlanTemplateOption[] {
  if (draft.eventDistanceM === undefined || draft.trainingFocus === undefined || draft.experienceBand === undefined) return []
  const eventDistanceM = draft.eventDistanceM
  const trainingFocus = draft.trainingFocus
  const experienceBand = draft.experienceBand
  const approvals = DETAILED_PRESCRIPTION_APPROVALS.filter((candidate) => (
    candidate.targetEventDistanceM === eventDistanceM
    && candidate.eligibleExperienceBands.includes(experienceBand)
  ))
  return approvals.flatMap((approval): DetailedPlanTemplateOption[] => {
    const ref = {
      templateId: approval.templateId,
      version: approval.templateVersion,
      fingerprint: approval.templateContentFingerprint,
    }
    const authority = resolveDetailedPrescriptionRuntimeAuthority({
      selectedTemplateRef: ref,
      targetEventDistanceM: eventDistanceM,
      selectedEnergyIntent: trainingFocus,
      evaluatedAt,
    })
    if (authority.kind !== "authorized") return []
    const parsed = parsePrescriptionNotation(authority.approval.notation)
    if (parsed.kind !== "parsed") return []
    const notation = parsed.notation
    const components = authority.approval.canonicalTemplateContent.operationalComponents
    const warmup = components.warmup
    const cooldown = components.cooldown
    const totalRepetitions = notation.setCount * notation.repetitionsPerSet
    const work = notation.repetitionDistanceM === null
      ? `${notation.repetitionDurationSeconds}초` : `${notation.repetitionDistanceM}m`
    const recovery = [
      ...(notation.repetitionRecoverySeconds === null ? [] : [
        `반복 사이 ${formatTrainingSeconds(notation.repetitionRecoverySeconds)} ${recoveryLabel(notation.repetitionRecoveryMode)}`,
      ]),
      ...(notation.setRecoverySeconds === null ? [] : [
        `세트 사이 ${formatTrainingSeconds(notation.setRecoverySeconds)} ${recoveryLabel(notation.setRecoveryMode)}`,
      ]),
    ]
    return [{
      ref,
      notation: authority.approval.notation,
      targetEventDistanceM: eventDistanceM,
      trainingFocus,
      mainSummary: `${work} ${notation.repetitionsPerSet}회${notation.setCount > 1 ? `씩 ${notation.setCount}세트 · 총 ${totalRepetitions}회` : ""}`,
      recoverySummary: recovery.join(" · "),
      preparationSummary: `준비 ${warmup.easyDurationMinutes}분 RPE ${warmup.rpeMin}-${warmup.rpeMax}, ${warmup.strides.durationSeconds}초 점진 가속 ${warmup.strides.repetitions}회와 사이 ${warmup.strides.recoverySeconds}초 걷기/조깅 · 정리 ${cooldown.easyDurationMinutes}분 RPE ${cooldown.rpeMin}-${cooldown.rpeMax}`,
    }]
  })
}

function recoveryLabel(mode: "WALK" | "JOG" | "STAND" | "NOT_APPLICABLE"): string {
  return { WALK: "걷기", JOG: "조깅", STAND: "서서 쉬기", NOT_APPLICABLE: "" }[mode]
}
