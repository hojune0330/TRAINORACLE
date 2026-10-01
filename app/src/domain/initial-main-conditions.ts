import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout } from "@impl/prescription/all-workout-calculator"
import type { CalculatedWorkout, WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { catalogFamilyForIntent, initialCatalogMainOptions } from "@impl/prescription/catalog-session-binding"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { isInitialCandidatePair } from "@impl/plan-generator/support-only-candidate-pair"
import type { PlanGenerationSuccess, PlannedEnergyIntent, RpeTimeRange } from "@impl/plan-generator/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import type { PlanBetaIntake } from "./plan-beta-store"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { catalogScheduleConditions, isCatalogEnvironmentRequirement } from "./catalog-schedule-conditions"
import { localAccountScopeIsCurrent } from "./account/local-account-scope"
import { isValidIsoDate, isoShift } from "./dates"

export type InitialMainContext = {
  readonly mode: "newplan" | "saved-plan"
  readonly startDate: string
  readonly accountScope: string | null
  /** Monotonically increased by the parent, including cancelled/removed drafts. */
  readonly revision: number
}
export type InitialMainInput = {
  readonly generated: PlanGenerationSuccess
  readonly intake: PlanBetaIntake
  readonly gate: SafetyGateDecision
  readonly context: InitialMainContext
}
export type InitialMainOffer = {
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly date: string
  readonly catalogId: string
  readonly name: string
  readonly requirements: readonly string[]
  /** Unconfirmed preview. Hypothetical discovery answers are never returned as inputs. */
  readonly workout: CalculatedWorkout
  readonly longerThanOriginal: boolean
}
export type InitialMainAlternative = {
  readonly trainingFocus: PlannedEnergyIntent
  readonly catalogId: string
  readonly name: string
}
export type InitialMainFallback = {
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly date: string
  readonly reason: "BEGINNER_GLY_NOT_ADOPTED" | "EXPLICIT_SEGMENT_TIME_REQUIRED" | "NO_INPUT_FREE_REVIEWED_CONFIGURATION"
  readonly manualCatalogIds: readonly string[]
  readonly alternatives: readonly InitialMainAlternative[]
}
export type InitialMainReview = {
  readonly key: string
  readonly offers: readonly InitialMainOffer[]
  readonly fallbacks: readonly InitialMainFallback[]
}

/** Read-only discovery for a new, safe draft; never use on storage/reload or successors. */
export function reviewInitialMainConditions(input: InitialMainInput): InitialMainReview | null {
  try {
    const { generated, intake, gate, context } = input
    if (context.mode !== "newplan" || !isValidIsoDate(context.startDate)
      || !Number.isSafeInteger(context.revision) || context.revision < 0
      || !localAccountScopeIsCurrent(context.accountScope)
      || gate.kind !== "passed" || !gate.planGenerationAllowed || intake.selectedDetailedTemplateRef !== null
      || generated.pairId !== generated.candidates[0].pairId
      || !generated.candidates.every(candidate => isVerifiedPlanCandidate(candidate)
        && candidate.eventDistanceM === intake.eventDistanceM
        && candidate.selectedEnergyIntent === intake.trainingFocus
        && candidate.selectedDetailedTemplateRef === null
        && candidate.candidateId.includes(`:${intake.experienceBand.toLowerCase()}:`))
      || !isInitialCandidatePair(...generated.candidates)) return null
    const offers: InitialMainOffer[] = [], fallbacks: InitialMainFallback[] = []
    for (const session of generated.candidates[0].sessions) {
      if (session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE" || session.prescription.catalogWorkout) continue
      const date = isoShift(context.startDate, session.day - 1)
      const requirements = [...new Set(ALL_WORKOUT_CATALOG.filter(entry => entry.family === catalogFamilyForIntent(session.plannedEnergyIntent)
        && entry.hold === null && entry.eventDistances.includes(intake.eventDistanceM) && entry.experience.includes(intake.experienceBand)
        && entry.requirements.length > 0 && entry.requirements.every(isCatalogEnvironmentRequirement))
        .map(entry => JSON.stringify([...entry.requirements].sort())))].map(value => JSON.parse(value) as string[])
      const options = requirements.flatMap(confirmed => initialCatalogMainOptions(session, intake.eventDistanceM, intake.experienceBand, confirmed))
        .filter(option => option.prescription.kind === "RPE_TIME_RANGE" && option.prescription.catalogWorkout
          && option.prescription.catalogWorkout.inputs.confirmedRequirements.length > 0)
      const durationMaximum = session.prescription.durationMinutes.maximum
      const option = options.find(option => option.prescription.kind === "RPE_TIME_RANGE"
        && option.prescription.durationMinutes.maximum <= durationMaximum)
        ?? [...options].sort((a, b) => (a.prescription as RpeTimeRange).durationMinutes.maximum
          - (b.prescription as RpeTimeRange).durationMinutes.maximum)[0]
      const binding = option?.prescription.kind === "RPE_TIME_RANGE" ? option.prescription.catalogWorkout : undefined
      // Check A/B together, including envelopes and source-bound candidate identity.
      if (binding && replaceCandidateCatalogWorkout(generated, session, binding.catalogId, binding.inputs, true)) {
        const entry = ALL_WORKOUT_CATALOG.find(entry => entry.id === binding.catalogId)!
        const workout = calculateCatalogWorkout(binding.catalogId, { ...binding.inputs, confirmedRequirements: [] })!
        offers.push({ day: session.day, slot: session.slot, date, catalogId: entry.id, name: entry.name,
          requirements: [...entry.requirements], workout, longerThanOriginal: binding.acceptedDurationSeconds !== undefined })
      } else {
        const beginnerGly = session.plannedEnergyIntent === "GLY_INTENT" && intake.experienceBand === "NEW_TO_RUNNING"
        const manualCatalogIds = ALL_WORKOUT_CATALOG.filter(entry => entry.family === catalogFamilyForIntent(session.plannedEnergyIntent)
          && entry.hold === null && entry.eventDistances.includes(intake.eventDistanceM)
          && entry.experience.includes(intake.experienceBand) && entry.requirements.length === 0)
          .filter(entry => {
            const workout = calculateCatalogWorkout(entry.id, { eventDistanceM: intake.eventDistanceM, experience: intake.experienceBand,
              availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [] })
            return workout && workout.unavailable.length === 0 && workout.totals.seconds === null
              && workout.steps.some(step => step.seconds === null)
          }).map(entry => entry.id)
        const alternatives: InitialMainAlternative[] = []
        if (beginnerGly) for (const trainingFocus of ["VO2_INTENT", "LT_INTENT"] as const) {
          const alternative = initialCatalogMainOptions({ ...session, plannedEnergyIntent: trainingFocus }, intake.eventDistanceM, intake.experienceBand)[0]
          const id = alternative?.prescription.kind === "RPE_TIME_RANGE" ? alternative.prescription.catalogWorkout?.catalogId : undefined
          const entry = ALL_WORKOUT_CATALOG.find(entry => entry.id === id)
          if (entry) alternatives.push({ trainingFocus, catalogId: entry.id, name: entry.name })
        }
        fallbacks.push({ day: session.day, slot: session.slot, date,
          reason: beginnerGly ? "BEGINNER_GLY_NOT_ADOPTED" : manualCatalogIds.length ? "EXPLICIT_SEGMENT_TIME_REQUIRED"
            : "NO_INPUT_FREE_REVIEWED_CONFIGURATION", manualCatalogIds, alternatives })
      }
    }
    const key = canonicalJsonFingerprint("initial-main-review-v1", { context, intake, gate, generated,
      offers: offers.map(offer => [offer.day, offer.slot, offer.catalogId, offer.workout.fingerprint]), fallbacks })
    return { key, offers, fallbacks }
  } catch { return null }
}

/** Explicit apply only. Re-run with fresh gate/context inside the parent's mutation lock.
 * The result is a draft, not a saved/activated plan or permanent environment proof. */
export function applyInitialMainConditions(input: InitialMainInput, reviewKey: string,
  confirmedRequirements: readonly string[]): { readonly generated: PlanGenerationSuccess; readonly reviewedConditionKeys: readonly string[] } | null {
  const review = reviewInitialMainConditions(input)
  if (!review || review.key !== reviewKey || !review.offers.length || !Array.isArray(confirmedRequirements)) return null
  const required = [...new Set(review.offers.flatMap(offer => offer.requirements))]
  if (confirmedRequirements.length !== required.length || new Set(confirmedRequirements).size !== required.length
    || !required.every(requirement => confirmedRequirements.includes(requirement))) return null
  let generated = input.generated
  for (const offer of review.offers) {
    const next = replaceCandidateCatalogWorkout(generated, offer, offer.catalogId,
      { ...offer.workout.inputs, confirmedRequirements: offer.requirements }, true)
    if (!next) return null
    generated = next
  }
  return { generated, reviewedConditionKeys: catalogScheduleConditions(generated, input.context.startDate, input.context.accountScope)
    .filter(condition => review.offers.some(offer => offer.day === condition.day && offer.slot === condition.slot))
    .map(condition => condition.key) }
}

/** Eligible distance-based MAIN keeps its reviewed dose. Only explicitly entered
 * targets resolve missing time; the existing editor owns its duration acceptance. */
export function applyInitialMainManual(input: InitialMainInput, reviewKey: string, address: { readonly day: number; readonly slot: "AM" | "PM" },
  catalogId: string, inputs: WorkoutCalculationInputs, acceptLongerDuration = false): PlanGenerationSuccess | null {
  const review = reviewInitialMainConditions(input)
  const fallback = review?.fallbacks.find(row => row.day === address.day && row.slot === address.slot)
  if (!review || review.key !== reviewKey || !fallback?.manualCatalogIds.includes(catalogId)
    || !inputs || !Array.isArray(inputs.confirmedRequirements) || inputs.confirmedRequirements.length !== 0) return null
  try { return replaceCandidateCatalogWorkout(input.generated, address, catalogId, inputs, acceptLongerDuration) }
  catch { return null }
}
