import type { StoredPlanHistory } from "./plan-beta-schema"
import { methodReferenceFromTemplate } from "./plan-method-history"

export type PlanMethodCoverage = {
  readonly retainedPlans: number
  readonly matchingPlans: number
  readonly unknownEventPlans: number
  readonly missingOutcomes: number
  readonly unmappedReferences: number
  readonly earliestArchive: string | null
  readonly latestArchive: string | null
}

export function summarizePlanMethodCoverage(
  rows: readonly StoredPlanHistory[], eventDistanceM?: number,
): PlanMethodCoverage {
  const matching = rows.filter(row => "eventDistanceM" in row
    && (eventDistanceM === undefined || row.eventDistanceM === eventDistanceM))
  let missingOutcomes = 0
  let unmappedReferences = 0
  for (const row of matching) {
    if ("methodHistory" in row) {
      for (const item of row.methodHistory) {
        if (item.outcome === "MISSING") missingOutcomes += 1
        if (methodReferenceFromTemplate(item.selectedDetailedTemplateRef) === null) unmappedReferences += 1
      }
    } else if ("selectedDetailedTemplateRef" in row && row.selectedDetailedTemplateRef !== null) {
      missingOutcomes += 1
      if (methodReferenceFromTemplate(row.selectedDetailedTemplateRef) === null) unmappedReferences += 1
    }
  }
  const dates = matching.map(row => row.archivedAt).sort((a, b) => Date.parse(a) - Date.parse(b))
  return Object.freeze({
    retainedPlans: rows.length, matchingPlans: matching.length,
    unknownEventPlans: rows.filter(row => !("eventDistanceM" in row)).length,
    missingOutcomes, unmappedReferences,
    earliestArchive: dates[0] ?? null, latestArchive: dates.at(-1) ?? null,
  })
}
