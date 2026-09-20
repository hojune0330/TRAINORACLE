import { PLANNED_ENERGY_INTENTS } from "@impl/plan-generator/types"
import type { InstantPlanEntry } from "../../domain/instant-plan-contract"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { withQuickDefaults } from "./plan-intake-navigation"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"

/** Proposes only existing approved methods. Acceptance still requires the result-screen review. */
export function prepareInstantIntake(draft: Partial<PlanBetaIntake>, entry?: InstantPlanEntry,
  evaluatedAt = new Date().toISOString()): Partial<PlanBetaIntake> {
  const completed = withQuickDefaults(draft)
  if (entry?.kind !== "CURRENT_RECORD" || entry.eventDistanceM !== draft.eventDistanceM
    || draft.selectedDetailedTemplateRef !== undefined) return completed
  const purposes = draft.trainingFocus === undefined ? PLANNED_ENERGY_INTENTS : [draft.trainingFocus]
  const options = purposes.flatMap(trainingFocus => resolveDetailedPlanTemplateOptions({ ...completed, trainingFocus }, evaluatedAt))
    .sort((a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended))
      || a.ref.templateId.localeCompare(b.ref.templateId) || a.ref.version.localeCompare(b.ref.version))
  const option = options[0]
  return option ? { ...completed, trainingFocus: option.trainingFocus, selectedDetailedTemplateRef: option.ref } : completed
}
