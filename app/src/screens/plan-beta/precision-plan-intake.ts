import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { QUICK_INTAKE_DEFAULTS } from "./plan-intake-navigation"

export type PrecisionPlanOrigin = "USER" | "DEFAULT" | "SUGGESTED" | "RESTORED_ORIGIN_UNKNOWN"

export type PrecisionPlanField = keyof PlanBetaIntake | "startDate" | "targetRaceDate"

export type PrecisionPlanOrigins = Readonly<Partial<Record<PrecisionPlanField, PrecisionPlanOrigin>>>

const INTAKE_FIELDS: readonly (keyof PlanBetaIntake)[] = [
  "eventGroup", "eventDistanceM", "competitionDivision", "experienceBand", "availableDayCount",
  "requestedFrameLength", "trainingFocus", "secondSessionMode", "trainingTimePreference",
  "selectedDetailedTemplateRef", "startDate",
]

/** Existing intake values have no durable field-level source marker. Preserve that uncertainty. */
export function restoredPrecisionOrigins(draft: Partial<PlanBetaIntake>): PrecisionPlanOrigins {
  const origins: Partial<Record<PrecisionPlanField, PrecisionPlanOrigin>> = {}
  for (const field of INTAKE_FIELDS) {
    if (draft[field] !== undefined) origins[field] = "RESTORED_ORIGIN_UNKNOWN"
  }
  return origins
}

/**
 * Add origins for values introduced by the shared quick/default preparation step.
 * Existing explicit or restored origins always win. Required values outside the
 * ordinary defaults are marked as suggestions when the root supplies them.
 */
export function completePrecisionOrigins(
  before: Partial<PlanBetaIntake>,
  completed: Partial<PlanBetaIntake>,
  origins: PrecisionPlanOrigins,
): PrecisionPlanOrigins {
  const next: Partial<Record<PrecisionPlanField, PrecisionPlanOrigin>> = { ...origins }
  for (const field of INTAKE_FIELDS) {
    if (completed[field] === undefined || next[field] !== undefined) continue
    if (before[field] !== undefined) {
      next[field] = "RESTORED_ORIGIN_UNKNOWN"
      continue
    }
    const defaultValue = QUICK_INTAKE_DEFAULTS[field as keyof typeof QUICK_INTAKE_DEFAULTS]
    next[field] = defaultValue !== undefined && Object.is(completed[field], defaultValue) ? "DEFAULT" : "SUGGESTED"
  }
  return next
}

export function precisionOriginLabel(origin: PrecisionPlanOrigin | undefined): string {
  switch (origin) {
    case "USER": return "직접 선택"
    case "DEFAULT": return "기본 설정"
    case "SUGGESTED": return "자동 제안"
    case "RESTORED_ORIGIN_UNKNOWN": return "이전 설정"
    default: return "출처 확인 필요"
  }
}
