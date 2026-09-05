import { compareMainMethods, parsePrescriptionSequence } from "./sequence"
import type { PrescriptionSequence } from "./sequence"

/** Caller-supplied reviewed catalog, never an adoption decision made by this module. */
export type MethodConfiguration = {
  readonly configurationId: string
  readonly version: string
  readonly sequence: PrescriptionSequence
}

export type MethodFamily = {
  readonly familyId: string
  readonly reviewRef: string
  readonly configurations: readonly MethodConfiguration[]
}

export type MethodReference = {
  readonly familyId: string
  readonly configurationId: string
  readonly version: string
}

export type MethodAssessment = MethodReference & (
  | {
      readonly eligibility: "ELIGIBLE"
      // Lower values come first. The caller owns the purpose/context policy.
      readonly eligibilityPriority: number
      readonly purposePriority: number
      readonly contextPriority: number
    }
  | { readonly eligibility: "INELIGIBLE"; readonly reasonCode: string }
)

export type MethodHistoryEntry = {
  readonly selected: MethodReference | null
  readonly performed:
    | { readonly status: "PERFORMED"; readonly method: MethodReference }
    | { readonly status: "NOT_PERFORMED" | "MISSING" }
}

export type RepeatPreference = "NEUTRAL" | "PREFER_REPEAT" | "PREFER_VARIETY"

export type RecommendedMethod = MethodReference & {
  readonly sequence: PrescriptionSequence
  readonly eligibilityPriority: number
  readonly purposePriority: number
  readonly contextPriority: number
  readonly catalogOrder: number
  readonly observedPerformedCount: number
  readonly selectedCount: number
}

export type MethodRecommendationResult =
  | { readonly kind: "rejected"; readonly code: "INVALID_CATALOG" | "INVALID_ASSESSMENTS" | "INVALID_HISTORY" | "INVALID_PREFERENCE" }
  | {
      readonly kind: "recommended"
      readonly eligible: readonly RecommendedMethod[]
      readonly defaults: readonly RecommendedMethod[]
      readonly historyCoverage: { readonly entries: number; readonly missing: number; readonly notPerformed: number }
    }

const nonempty = (value: string): boolean => typeof value === "string" && value.trim().length > 0
const key = (value: MethodReference): string => JSON.stringify([value.familyId, value.configurationId, value.version])
const validRef = (value: MethodReference): boolean => nonempty(value.familyId) && nonempty(value.configurationId) && nonempty(value.version)

/** All supplied history is used, with no time window or invented recent-N penalty.
 * Selected is not performed. Counts describe observed facts, not proof of non-exposure.
 * The caller must scope/deduplicate history and evaluate safety/eligibility beforehand.
 */
export function recommendMethods(input: {
  readonly catalog: readonly MethodFamily[]
  readonly assessments: readonly MethodAssessment[]
  readonly history: readonly MethodHistoryEntry[]
  readonly repeatPreference: RepeatPreference
}): MethodRecommendationResult {
  if (!["NEUTRAL", "PREFER_REPEAT", "PREFER_VARIETY"].includes(input.repeatPreference)) {
    return { kind: "rejected", code: "INVALID_PREFERENCE" }
  }
  const families = new Set<string>()
  const configurations = new Map<string, MethodReference & { readonly sequence: PrescriptionSequence; readonly catalogOrder: number }>()
  let order = 0
  for (const family of input.catalog) {
    if (!nonempty(family.familyId) || !nonempty(family.reviewRef) || families.has(family.familyId) || family.configurations.length === 0) {
      return { kind: "rejected", code: "INVALID_CATALOG" }
    }
    families.add(family.familyId)
    for (const config of family.configurations) {
      const ref = { familyId: family.familyId, configurationId: config.configurationId, version: config.version }
      const parsed = parsePrescriptionSequence(config.sequence)
      if (!validRef(ref) || configurations.has(key(ref)) || parsed.kind === "rejected") return { kind: "rejected", code: "INVALID_CATALOG" }
      configurations.set(key(ref), { ...ref, sequence: parsed.sequence, catalogOrder: order++ })
    }
  }
  const seen = new Set<string>()
  const eligible: RecommendedMethod[] = []
  const performed = new Map<string, number>()
  const selected = new Map<string, number>()
  let missing = 0
  let notPerformed = 0
  for (const entry of input.history) {
    if (entry.selected !== null) {
      if (!validRef(entry.selected)) return { kind: "rejected", code: "INVALID_HISTORY" }
      selected.set(entry.selected.familyId, (selected.get(entry.selected.familyId) ?? 0) + 1)
    }
    if (entry.performed.status === "PERFORMED") {
      if (!validRef(entry.performed.method)) return { kind: "rejected", code: "INVALID_HISTORY" }
      const familyId = entry.performed.method.familyId
      performed.set(familyId, (performed.get(familyId) ?? 0) + 1)
    } else if (entry.performed.status === "MISSING") missing += 1
    else if (entry.performed.status === "NOT_PERFORMED") notPerformed += 1
    else return { kind: "rejected", code: "INVALID_HISTORY" }
  }
  for (const assessment of input.assessments) {
    const identity = key(assessment)
    const config = configurations.get(identity)
    if (config === undefined || seen.has(identity)) return { kind: "rejected", code: "INVALID_ASSESSMENTS" }
    seen.add(identity)
    if (assessment.eligibility === "INELIGIBLE" && nonempty(assessment.reasonCode)) continue
    if (assessment.eligibility !== "ELIGIBLE"
      || ![assessment.eligibilityPriority, assessment.purposePriority, assessment.contextPriority].every(Number.isFinite)) {
      return { kind: "rejected", code: "INVALID_ASSESSMENTS" }
    }
    eligible.push(Object.freeze({
      ...config,
      eligibilityPriority: assessment.eligibilityPriority,
      purposePriority: assessment.purposePriority,
      contextPriority: assessment.contextPriority,
      observedPerformedCount: performed.get(config.familyId) ?? 0,
      selectedCount: selected.get(config.familyId) ?? 0,
    }))
  }
  // Missing assessments are not permission to recommend a catalog entry.
  eligible.sort((a, b) => a.eligibilityPriority - b.eligibilityPriority
    || a.purposePriority - b.purposePriority
    || a.contextPriority - b.contextPriority
    || (input.repeatPreference === "PREFER_REPEAT" ? b.observedPerformedCount - a.observedPerformedCount
      : input.repeatPreference === "PREFER_VARIETY" ? a.observedPerformedCount - b.observedPerformedCount : 0)
    || a.catalogOrder - b.catalogOrder)
  const defaults: RecommendedMethod[] = []
  for (const candidate of eligible) {
    if (defaults.every(other => other.familyId !== candidate.familyId
      && compareMainMethods(other.sequence, candidate.sequence).kind === "different")) defaults.push(candidate)
    if (defaults.length === 2) break
  }
  return Object.freeze({
    kind: "recommended",
    eligible: Object.freeze(eligible),
    defaults: Object.freeze(defaults),
    historyCoverage: Object.freeze({ entries: input.history.length, missing, notPerformed }),
  })
}
