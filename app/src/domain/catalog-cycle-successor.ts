import { canonicalJsonFingerprint, rebindCandidatePairIdentity } from "@impl/plan-generator/candidate-identity"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { isInitialCandidatePair } from "@impl/plan-generator/support-only-candidate-pair"
import type { PlanCandidate, PlanGenerationSuccess, PlanSession } from "@impl/plan-generator/types"
import { ALL_WORKOUT_CATALOG, copyWorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import type { CalculatedWorkout, WorkoutCatalogEntry } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession, catalogRpe, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { isCatalogEnvironmentRequirement } from "./catalog-schedule-conditions"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { PLAN_CYCLE_RESPONSE_VERSION, type PlanCycleResponse } from "./plan-cycle-response"
import type { PlanJournalEvidenceRow } from "./plan-journal-evidence"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { sessionWorkoutNotation } from "./workout-notation"

export type CatalogCycleEvidenceStatus = "MISSING_RESPONSE" | "NO_LINKED_RESULTS" | "NO_COMPARABLE_RESULTS"
  | "SINGLE_SIGNAL" | "COMPLETE_RESPONSE" | "INCOMPLETE_RESPONSE" | "CONFLICTING_RESPONSE" | "RESPONSE_MISMATCH"
export type CatalogCycleSuccessorRow = {
  readonly status: "MAINTAINED" | "REDUCED" | "REVIEW_REQUIRED"
  readonly reason: string
  readonly explanation: string
  readonly purpose: PlanSession["plannedEnergyIntent"]
  readonly ordinal: number
  readonly sourceNotation?: string
  readonly targetNotation?: string
  readonly source: { readonly day: number; readonly slot: "AM" | "PM"; readonly catalogId: string | null } | null
  readonly target: { readonly day: number; readonly slot: "AM" | "PM"; readonly catalogId: string | null }
  readonly sourceActualRpe: number | null
  readonly sourceComparison: PlanJournalEvidenceRow["comparison"] | "NO_LINKED_RESULT"
  readonly comparisons: readonly PlanJournalEvidenceRow[]
  readonly repeatedAboveCount: number
  readonly environmentRequirements: readonly string[]
  readonly applied: boolean
}
export type CatalogCycleSuccessorSummary = {
  readonly status: "MAINTAINED" | "APPLIED" | "REVIEW_REQUIRED" | "INCOMPATIBLE" | "NOT_APPLICABLE"
  readonly reason: string
  readonly headline: string
  readonly responseStatus: CatalogCycleEvidenceStatus
  readonly appliedCount: number
  // Includes applied REVIEW_REQUIRED rows whose exact previous detail was kept.
  readonly maintainedCount: number
  readonly reducedCount: number
  // An attention count, not an exclusive action count; may overlap maintainedCount.
  readonly reviewCount: number
  readonly requiresEnvironmentConfirmation: boolean
  readonly futureEnvironmentVerified: false
  readonly rows: readonly CatalogCycleSuccessorRow[]
}
export type CatalogCycleSuccessorResult = {
  readonly generated: PlanGenerationSuccess
  readonly summary: CatalogCycleSuccessorSummary
}

const same = (a: unknown, b: unknown) => canonicalJsonFingerprint("catalog-cycle-comparison-v1", a)
  === canonicalJsonFingerprint("catalog-cycle-comparison-v1", b)
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const orderedMain = (sessions: readonly PlanSession[]) => sessions.filter(s => s.role === "QUALITY")
  .sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
const bindingOf = (s: PlanSession) => s.prescription.kind === "RPE_TIME_RANGE" ? s.prescription.catalogWorkout : undefined

function compatible(candidate: PlanCandidate, predecessor: PlanBetaStateV3): boolean {
  const active = predecessor.activePlan
  const frame = active.frame
  const counts = (sessions: readonly PlanSession[]) => sessions.reduce<Record<string, number>>((result, s) => {
    const key = `${s.role}:${s.plannedEnergyIntent}`
    result[key] = (result[key] ?? 0) + 1
    return result
  }, {})
  return "formationKind" in frame && candidate.selectedDetailedTemplateRef === null && active.selectedDetailedTemplateRef === null
    && candidate.eventGroup === predecessor.intake.eventGroup && candidate.eventDistanceM === active.eventDistanceM
    && candidate.candidateId.includes(`:${predecessor.intake.experienceBand.toLowerCase()}:`)
    && candidate.selectedEnergyIntent === active.selectedEnergyIntent && predecessor.intake.trainingFocus === active.selectedEnergyIntent
    && same(candidate.frame, frame) && candidate.sessions.length === active.sessions.length
    && same(counts(candidate.sessions), counts(active.sessions))
    && active.candidateId.includes(`:${candidate.mainExposureLedger.countedExposureIds.join("-")}:`)
    && new Set(candidate.sessions.map(s => s.day)).size === new Set(active.sessions.map(s => s.day)).size
}

function evidenceFor(response: PlanCycleResponse | null | undefined, predecessor: PlanBetaStateV3): {
  status: CatalogCycleEvidenceStatus; rows: readonly PlanJournalEvidenceRow[]
} {
  if (!response) return { status: "MISSING_RESPONSE", rows: [] }
  const mismatch = () => ({ status: "RESPONSE_MISMATCH" as const, rows: [] })
  if (response.version !== PLAN_CYCLE_RESPONSE_VERSION || !Array.isArray(response.rows)) return mismatch()
  const rows: PlanJournalEvidenceRow[] = []
  const occurrences = new Set<string>()
  for (const row of response.rows) {
    const session = predecessor.activePlan.sessions.find(s => s.day === row.day && s.slot === row.slot)
    if (!session) return mismatch()
    const link = createPlannedSessionLogDraft(predecessor, session, predecessor.generatedAt)
    if (!link || row.currentPlannedSessionId !== link.link.plannedSessionId || row.date !== link.date || row.role !== session.role
      || !["ACTIVE", "ARCHIVED"].includes(row.source) || typeof row.plannedSessionId !== "string"
      || row.source === "ACTIVE" && row.plannedSessionId !== link.link.plannedSessionId
      || !same(row.plannedRpe, session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.rpe : null)) return mismatch()
    const key = `${row.date}:${row.day}:${row.slot}`
    if (occurrences.has(key)) return mismatch()
    occurrences.add(key)
    const comparable = ["WITHIN_RANGE", "ABOVE_RANGE", "BELOW_RANGE"].includes(row.comparison)
    if (!["WITHIN_RANGE", "ABOVE_RANGE", "BELOW_RANGE", "RPE_MISSING", "NO_PLANNED_RPE", "NOT_PERFORMED", "CHANGED_SESSION", "CONFLICTING_RESULT"]
      .includes(row.comparison) || row.actualRpe !== null && (!Number.isInteger(row.actualRpe) || row.actualRpe < 1 || row.actualRpe > 10)) return mismatch()
    if (comparable && (row.actualRpe === null || !Number.isInteger(row.actualRpe) || row.actualRpe < 1 || row.actualRpe > 10
      || !row.plannedRpe || row.comparison !== (row.actualRpe > row.plannedRpe.maximum ? "ABOVE_RANGE"
        : row.actualRpe < row.plannedRpe.minimum ? "BELOW_RANGE" : "WITHIN_RANGE"))) return mismatch()
    // Project only structured evidence. Never read the response's headline/evidence or extra text.
    rows.push({ plannedSessionId: row.plannedSessionId, currentPlannedSessionId: row.currentPlannedSessionId,
      source: row.source, date: row.date, day: row.day, slot: row.slot, role: row.role,
      actualRpe: row.actualRpe, plannedRpe: row.plannedRpe === null ? null : { ...row.plannedRpe }, comparison: row.comparison })
  }
  const within = rows.filter(r => r.comparison === "WITHIN_RANGE").length
  const above = rows.filter(r => r.comparison === "ABOVE_RANGE").length
  const below = rows.filter(r => r.comparison === "BELOW_RANGE").length
  const comparable = within + above + below
  if (response.linkedResultCount !== rows.length || response.withinRangeCount !== within || response.higherThanRangeCount !== above
    || response.lowerThanRangeCount !== below || response.comparableRpeCount !== comparable || response.unknownCount !== rows.length - comparable
    || response.conflictCount !== rows.filter(r => r.comparison === "CONFLICTING_RESULT").length
    || response.archivedResultCount !== rows.filter(r => r.source === "ARCHIVED").length
    || ![response.duplicateCount, response.rejectedLinkCount].every(n => Number.isInteger(n) && n >= 0)
    || typeof response.historyReadIncomplete !== "boolean") return mismatch()
  const status: CatalogCycleEvidenceStatus = response.conflictCount > 0 ? "CONFLICTING_RESPONSE"
    : response.historyReadIncomplete || response.rejectedLinkCount > 0 ? "INCOMPLETE_RESPONSE"
      : rows.length === 0 ? "NO_LINKED_RESULTS" : comparable === 0 ? "NO_COMPARABLE_RESULTS"
        : response.unknownCount > 0 ? "INCOMPLETE_RESPONSE" : comparable === 1 ? "SINGLE_SIGNAL" : "COMPLETE_RESPONSE"
  return { status, rows }
}

function nonIncreasing(a: number | null, b: number | null): boolean {
  return a === null || b === null ? a === b : a <= b
}

function lowerNodes(next: readonly SequenceNodeV3[], prior: readonly SequenceNodeV3[]): boolean {
  if (next.length !== prior.length) return false
  return next.every((node, i) => {
    const old = prior[i]!
    if (node.kind !== old.kind || node.repeatCount > old.repeatCount) return false
    for (const position of ["recoveryBetweenRepeats", "recoveryAfter"] as const) {
      const left = node[position], right = old[position]
      if (left.length !== right.length || left.some((r, j) => {
        const p = right[j]!
        return r.mode !== p.mode || !nonIncreasing(p.seconds, r.seconds)
          || !nonIncreasing("distanceM" in p ? p.distanceM : null, "distanceM" in r ? r.distanceM : null)
      })) return false
    }
    if (node.kind === "group" && old.kind === "group") return node.repeatUnit === old.repeatUnit && lowerNodes(node.children, old.children)
    if (node.kind !== "segment" || old.kind !== "segment") return false
    return node.role === old.role && node.work.kind === old.work.kind
      && nonIncreasing(node.work.durationSeconds, old.work.durationSeconds) && nonIncreasing(node.work.distanceM, old.work.distanceM)
  })
}

function dose(workout: CalculatedWorkout) {
  const work = workout.steps.filter(s => s.phase === "main" && s.kind === "WORK")
  return { count: work.length, distance: workout.totals.knownMainDistanceM,
    minimum: work.reduce((sum, s) => sum + s.seconds!.minimum, 0),
    maximum: work.reduce((sum, s) => sum + s.seconds!.maximum, 0) }
}

function bounded(next: CalculatedWorkout, prior: CalculatedWorkout): boolean {
  if (!next.totals.seconds || !prior.totals.seconds || next.unresolved.length || prior.unresolved.length) return false
  const a = dose(next), b = dose(prior), rpe = catalogRpe(next), oldRpe = catalogRpe(prior)
  return next.totals.seconds.minimum <= prior.totals.seconds.minimum && next.totals.seconds.maximum <= prior.totals.seconds.maximum
    && rpe.minimum <= oldRpe.minimum && rpe.maximum <= oldRpe.maximum
    && a.count <= b.count && a.distance <= b.distance && a.minimum <= b.minimum && a.maximum <= b.maximum
    && nonIncreasing(next.totals.mainDistanceM, prior.totals.mainDistanceM)
}

function safeLower(next: CalculatedWorkout, prior: CalculatedWorkout, entry: WorkoutCatalogEntry, oldEntry: WorkoutCatalogEntry): boolean {
  if (!bounded(next, prior) || !entry.reviewRef || entry.hold || entry.methodGroup !== oldEntry.methodGroup || entry.family !== oldEntry.family
    || !entry.sequence || !oldEntry.sequence || !same(entry.sequence.warmup, oldEntry.sequence.warmup)
    || !same(entry.sequence.cooldown, oldEntry.sequence.cooldown) || !lowerNodes(entry.sequence.main, oldEntry.sequence.main)) return false
  const distinct = (workout: CalculatedWorkout, kind: "WORK" | "RECOVERY") => [...new Map(workout.steps
    .filter(s => s.phase === "main" && s.kind === kind).map(s => [s.segmentId, s])).values()]
  for (const kind of ["WORK", "RECOVERY"] as const) {
    const left = distinct(next, kind), right = distinct(prior, kind)
    if (left.length !== right.length || left.some((s, i) => {
      const p = right[i]!
      return s.intent !== p.intent || s.modality !== p.modality || s.terrain !== p.terrain || s.targetModel !== p.targetModel
        || !same(s.paceSecondsPerKm, p.paceSecondsPerKm)
        || kind === "RECOVERY" && (s.instruction !== p.instruction || !s.seconds || !p.seconds
          || s.seconds.minimum < p.seconds.minimum || s.seconds.maximum < p.seconds.maximum)
    })) return false
  }
  const a = dose(next), b = dose(prior), rpe = catalogRpe(next), oldRpe = catalogRpe(prior)
  return a.count < b.count || a.distance < b.distance || a.minimum < b.minimum || a.maximum < b.maximum
    || rpe.minimum < oldRpe.minimum || rpe.maximum < oldRpe.maximum
}

/** New-draft projection only. The caller supplies a freshly derived response, owns
 * safety/readiness, asks future environment questions and explicitly accepts via CAS. */
export function resolveCatalogCycleSuccessor(input: {
  readonly generated: PlanGenerationSuccess
  readonly predecessor: PlanBetaStateV3
  readonly response: PlanCycleResponse | null | undefined
  readonly evaluatedAt: Date
}): CatalogCycleSuccessorResult {
  const { generated, predecessor, evaluatedAt } = input
  const finish = (next: PlanGenerationSuccess, rows: readonly CatalogCycleSuccessorRow[], responseStatus: CatalogCycleEvidenceStatus,
    reason = "DETAILED_MAIN_SUCCESSOR", incompatible = false): CatalogCycleSuccessorResult => {
    const maintainedCount = rows.filter(r => r.applied && r.status !== "REDUCED").length
    const reducedCount = rows.filter(r => r.applied && r.status === "REDUCED").length
    const reviewCount = rows.filter(r => r.status === "REVIEW_REQUIRED").length
    const noMain = !incompatible && rows.length === 0
    return { generated: copy(next), summary: { status: incompatible ? "INCOMPATIBLE" : noMain ? "NOT_APPLICABLE" : reviewCount ? "REVIEW_REQUIRED"
      : reducedCount ? "APPLIED" : "MAINTAINED", reason: noMain ? "NO_MAIN_SESSIONS" : reason, responseStatus,
      headline: incompatible ? "이전 계획과 새 계획의 조건이 달라 상세 훈련을 이어오지 않았어요."
        : noMain ? "이번 목적에는 MAIN 훈련이 없어 상세 MAIN 조정은 하지 않았어요."
        : reviewCount ? maintainedCount + reducedCount === 0 ? "이전 상세 훈련을 이어오지 못했어요. 다음 계획안을 다시 확인해 주세요."
          : reducedCount > 0 ? "반복된 RPE를 반영해 훈련량이 적은 구성을 제안해요. 일부 훈련은 다시 확인해 주세요."
            : "확인된 이전 상세 훈련은 유지했어요. 일부 훈련은 다시 확인해 주세요."
          : reducedCount ? "반복된 RPE를 반영해 훈련량이 적은 구성을 제안해요."
            : "이전 상세 훈련을 유지했어요. 실제 기록만으로 훈련을 늘리지 않아요.",
      appliedCount: maintainedCount + reducedCount, maintainedCount, reducedCount, reviewCount,
      requiresEnvironmentConfirmation: rows.some(r => r.environmentRequirements.length > 0),
      futureEnvironmentVerified: false, rows: copy(rows) } }
  }
  if (!Number.isFinite(evaluatedAt.getTime()) || !planBetaStateV3Schema.safeParse(predecessor).success)
    return finish(generated, [], "RESPONSE_MISMATCH", "INVALID_PREDECESSOR_OR_DATE", true)
  if (!generated.candidates.every(isVerifiedPlanCandidate) || !isInitialCandidatePair(...generated.candidates)
    || generated.pairId !== generated.candidates[0].pairId || !generated.candidates.every(c => compatible(c, predecessor)))
    return finish(generated, [], "RESPONSE_MISMATCH", "INCOMPATIBLE_SCOPE", true)
  const evidence = evidenceFor(input.response, predecessor)
  const rows: CatalogCycleSuccessorRow[] = [], replacements = new Map<string, PlanSession>()
  const previous = orderedMain(predecessor.activePlan.sessions), ordinals = new Map<string, number>()
  const day = `${evaluatedAt.getFullYear()}-${String(evaluatedAt.getMonth() + 1).padStart(2, "0")}-${String(evaluatedAt.getDate()).padStart(2, "0")}`
  for (const target of orderedMain(generated.candidates[0].sessions)) {
    const purpose = target.plannedEnergyIntent, ordinal = (ordinals.get(purpose) ?? 0) + 1
    ordinals.set(purpose, ordinal)
    const source = previous.filter(s => s.plannedEnergyIntent === purpose)[ordinal - 1]
    const binding = source ? bindingOf(source) : undefined
    const comparisons = evidence.rows.filter(r => previous.some(s => s.day === r.day && s.slot === r.slot && s.plannedEnergyIntent === purpose))
    const direct = comparisons.find(r => r.day === source?.day && r.slot === source?.slot)
    const above = comparisons.filter(r => r.comparison === "ABOVE_RANGE").length
    const purposeStatus: CatalogCycleEvidenceStatus = evidence.status === "RESPONSE_MISMATCH" || !input.response
      ? evidence.status : input.response.historyReadIncomplete || input.response.rejectedLinkCount > 0 ? "INCOMPLETE_RESPONSE"
        : comparisons.some(r => r.comparison === "CONFLICTING_RESULT") ? "CONFLICTING_RESPONSE"
          : comparisons.length > 0 && comparisons.every(r => !["WITHIN_RANGE", "ABOVE_RANGE", "BELOW_RANGE"].includes(r.comparison)) ? "NO_COMPARABLE_RESULTS"
          : comparisons.some(r => !["WITHIN_RANGE", "ABOVE_RANGE", "BELOW_RANGE"].includes(r.comparison)) ? "INCOMPLETE_RESPONSE"
            : comparisons.length === 0 ? "NO_LINKED_RESULTS" : comparisons.length === 1 ? "SINGLE_SIGNAL"
              : comparisons.length < previous.filter(s => s.plannedEnergyIntent === purpose).length ? "INCOMPLETE_RESPONSE" : "COMPLETE_RESPONSE"
    const row = (status: CatalogCycleSuccessorRow["status"], reason: string, explanation: string, replacement?: PlanSession) => {
      rows.push({ status, reason, explanation, purpose, ordinal,
        sourceNotation: source ? sessionWorkoutNotation(source) : undefined,
        targetNotation: sessionWorkoutNotation(replacement ?? target),
        source: source ? { day: source.day, slot: source.slot, catalogId: binding?.catalogId ?? null } : null,
        target: { day: target.day, slot: target.slot, catalogId: bindingOf(replacement ?? target)?.catalogId ?? null },
        sourceActualRpe: direct?.actualRpe ?? null, sourceComparison: direct?.comparison ?? "NO_LINKED_RESULT",
        comparisons, repeatedAboveCount: above,
        environmentRequirements: bindingOf(replacement ?? target)?.inputs.confirmedRequirements.filter(isCatalogEnvironmentRequirement) ?? [],
        applied: replacement !== undefined })
    }
    if (!source || !binding) {
      row("REVIEW_REQUIRED", "SOURCE_NOT_DETAILED", "이전 상세 훈련을 확인하지 못해 다음 계획안에 이어오지 않았어요.")
      continue
    }
    const prior = resolveCatalogBinding(binding), entry = ALL_WORKOUT_CATALOG.find(e => e.id === binding.catalogId)
    // Replay the exact original before rebinding onto a new address. Its envelope
    // is the source envelope, never the newly generated draft's provisional cap.
    const original = { ...source, prescription: { kind: "RPE_TIME_RANGE" as const, ...copy(binding.originalEnvelope) } }
    const replay = bindCatalogSession(original, binding.catalogId, copyWorkoutCalculationInputs(binding.inputs), binding.acceptedDurationSeconds !== undefined)
    if (!prior || !entry?.reviewRef || prior.unresolved.length || !replay || !same(replay, source)) {
      row("REVIEW_REQUIRED", "UNRESOLVABLE_SOURCE", "이전 훈련의 원본 구성과 계산값을 다시 확인할 수 없어요.")
      continue
    }
    const inputs = copyWorkoutCalculationInputs(binding.inputs)
    if (inputs.fiveK && inputs.fiveK.evaluatedAt > day) {
      row("REVIEW_REQUIRED", "INVALID_RECORD_DATE", "기준 기록의 확인 날짜가 맞지 않아 상세 훈련을 이어오지 않았어요.")
      continue
    }
    const freshInputs = { ...inputs, fiveK: inputs.fiveK ? { ...inputs.fiveK, evaluatedAt: day } : null }
    const base: PlanSession = { ...target, prescription: original.prescription }
    const maintained = bindCatalogSession(base, binding.catalogId, freshInputs, binding.acceptedDurationSeconds !== undefined)
    const current = maintained && bindingOf(maintained) ? resolveCatalogBinding(bindingOf(maintained)!) : null
    if (!maintained || !current || !bounded(current, prior)) {
      row("REVIEW_REQUIRED", "STALE_OR_UNRESOLVABLE_REFERENCE", "기준 기록이 오래됐거나 계산값을 확인할 수 없어 상세 훈련을 이어오지 않았어요.")
      continue
    }
    let chosen = maintained, reduced = false
    const mayReduce = purposeStatus === "COMPLETE_RESPONSE" && above >= 2
    if (mayReduce) {
      const lower = ALL_WORKOUT_CATALOG.filter(e => e.id !== entry.id && e.methodGroup === entry.methodGroup && e.family === entry.family)
        .flatMap(option => {
          const session = bindCatalogSession(base, option.id, freshInputs, binding.acceptedDurationSeconds !== undefined)
          const calculation = session && bindingOf(session) ? resolveCatalogBinding(bindingOf(session)!) : null
          return session && calculation && safeLower(calculation, current, option, entry) && bounded(calculation, prior)
            ? [{ session, calculation }] : []
        // Prefer the closest existing lower work dose, without a weighted score,
        // scaling or any claim that this is an optimal physiological dose.
        }).sort((a, b) => dose(b.calculation).maximum - dose(a.calculation).maximum
          || dose(b.calculation).distance - dose(a.calculation).distance
          || dose(b.calculation).count - dose(a.calculation).count
          || b.calculation.totals.seconds!.maximum - a.calculation.totals.seconds!.maximum
          || a.calculation.catalogId.localeCompare(b.calculation.catalogId))[0]
      if (lower) { chosen = lower.session; reduced = true }
    }
    replacements.set(`${target.day}:${target.slot}`, chosen)
    if (mayReduce && !reduced) row("REVIEW_REQUIRED", "NO_REVIEWED_LOWER_CONFIGURATION",
      "힘들었다는 기록이 반복됐지만 양이 적은 같은 방식의 훈련을 확인하지 못해 이전 상세 훈련을 유지했어요. 다시 확인해 주세요.", chosen)
    else if (["CONFLICTING_RESPONSE", "INCOMPLETE_RESPONSE", "RESPONSE_MISMATCH"].includes(purposeStatus))
      row("REVIEW_REQUIRED", purposeStatus, "기록이 불완전하거나 서로 맞지 않아 훈련량을 바꾸지 않고 이전 상세 훈련을 유지했어요.", chosen)
    else row(reduced ? "REDUCED" : "MAINTAINED", reduced ? "REPEATED_ABOVE_REVIEWED_LOWER" : purposeStatus,
      reduced ? "같은 목적의 훈련에서 힘들었다는 기록이 반복돼, 양이 적은 같은 방식의 훈련을 다음 계획안에 넣었어요."
        : "이전 상세 훈련을 유지했어요. 기록 누락·한 번의 기록·낮거나 범위 안인 RPE로 훈련을 늘리지 않아요.", chosen)
  }
  const first = generated.candidates[0], second = generated.candidates[1]
  const replace = (candidate: PlanCandidate): PlanCandidate => ({ ...candidate, sessions: candidate.sessions.map(s =>
    s.role === "QUALITY" ? replacements.get(`${s.day}:${s.slot}`) ?? s : s) })
  const pair = rebindCandidatePairIdentity([replace(first), replace(second)])
  if (!pair.every(isVerifiedPlanCandidate) || !isInitialCandidatePair(...pair))
    return finish(generated, rows.map(r => ({ ...r, status: "REVIEW_REQUIRED", applied: false,
      target: { ...r.target, catalogId: bindingOf(first.sessions.find(s => s.day === r.target.day && s.slot === r.target.slot)!)?.catalogId ?? null },
      reason: "INVALID_REBOUND_PAIR",
      explanation: "새 계획안의 구성 확인을 통과하지 못해 상세 훈련 변경을 적용하지 않았어요." })), evidence.status, "INVALID_REBOUND_PAIR")
  return finish({ ...generated, candidates: pair, pairId: pair[0].pairId }, rows, evidence.status)
}
