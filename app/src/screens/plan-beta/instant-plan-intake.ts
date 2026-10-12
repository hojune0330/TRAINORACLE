import { PLANNED_ENERGY_INTENTS } from "@impl/plan-generator/types"
import type { InstantPlanEntry } from "../../domain/instant-plan-contract"
import { deriveRecordCurrentness } from "../../domain/pace-target-evidence"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { withQuickDefaults } from "./plan-intake-navigation"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"

/** Proposes only existing approved methods. Acceptance still requires the result-screen review. */
export function prepareInstantIntake(draft: Partial<PlanBetaIntake>, entry?: InstantPlanEntry,
  evaluatedAt = new Date().toISOString()): Partial<PlanBetaIntake> {
  const completed = withQuickDefaults(draft)
  if (entry === undefined || entry.kind === "NO_RECORD" || entry.eventDistanceM !== draft.eventDistanceM
    || draft.selectedDetailedTemplateRef !== undefined) return completed
  // Optional/old record dates must not auto-select a method the pace gate will reject.
  // Keep the stored record and the existing time/effort plan; explicit choices stay above.
  if (entry.kind === "CURRENT_RECORD"
    && deriveRecordCurrentness(entry, new Date(evaluatedAt)) !== "CURRENT") return completed
  const purposes = draft.trainingFocus === undefined ? PLANNED_ENERGY_INTENTS : [draft.trainingFocus]
  const options = purposes.flatMap(trainingFocus => resolveDetailedPlanTemplateOptions({ ...completed, trainingFocus }, evaluatedAt))
    .sort((a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended))
      || a.ref.templateId.localeCompare(b.ref.templateId) || a.ref.version.localeCompare(b.ref.version))
  const option = options[0]
  return option ? { ...completed, trainingFocus: option.trainingFocus, selectedDetailedTemplateRef: option.ref } : completed
}
