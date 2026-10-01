import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import type { PlanCandidate } from "@impl/plan-generator/types"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { readStoredAdjustedPlanState, type StoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import { readStoredAdjustedPlanStateV5, type StoredAdjustedPlanStateV5 } from "./adjusted-plan-storage-v5-schema"
import { readStoredMultiAdjustedPlanV6, type StoredMultiAdjustedPlanStateV6 } from "./adjusted-plan-storage-v6-schema"
import { prepareAdjustedNextFrame, prepareAdjustedNextFrameV3, prepareMultiAdjustedNextFrameV3 } from "./adjusted-plan-continuity"
import type { RetainedAdjustedPlanEvidence } from "./selected-adjusted-plan-content"
import type { RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-content-v3"
import type { RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-content-v3"
import type { PlanCurrentCheck } from "./plan-beta-flow"
import type { JournalEntry, PostSessionEntry } from "./journal-schema"
import { FIELD_PROVENANCE } from "./field-provenance"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession } from "./planned-session-link"
import type { PlanJournalEvidenceRow } from "./plan-journal-evidence"
import { PLAN_CYCLE_RESPONSE_VERSION, type PlanCycleResponse } from "./plan-cycle-response"
import { comparePlannedSegments, plannedSegmentEvidenceSchema } from "./planned-segment-evidence"
import { comparePlannedRepetitions, plannedRepetitionEvidenceSchema } from "./planned-repetition-evidence"
import { sessionWorkoutNotation } from "./workout-notation"

export type AdjustedCyclePredecessor = StoredAdjustedPlanState | StoredAdjustedPlanStateV5 | StoredMultiAdjustedPlanStateV6
export type AdjustedCycleEvidence =
  | { readonly version: 4; readonly retained: readonly RetainedAdjustedPlanEvidence[] }
  | { readonly version: 5; readonly retained: readonly RetainedAdjustedPlanEvidenceV3[] }
  | { readonly version: 6; readonly retained: readonly RetainedMultiAdjustedEvidenceV3[] }
export type AdjustedCycleSession = AdjustedCyclePredecessor["selection"]["activePlan"]["sessions"][number]
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-cycle-successor.v1", value)
const same = (a: unknown, b: unknown) => hash(a) === hash(b)
const reject = (code: string) => ({ kind: "rejected" as const, code })
const orderedMain = (sessions: readonly AdjustedCycleSession[]) => sessions.filter(s => s.role === "QUALITY")
  .sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))

/** Independent retained evidence is mandatory. No V3 cast or original-template fallback. */
export function readAdjustedCyclePredecessor(value: unknown, evidence: AdjustedCycleEvidence, at = new Date()): AdjustedCyclePredecessor | null {
  try {
    const read = evidence.version === 4 ? readStoredAdjustedPlanState(value, evidence.retained, at)
      : evidence.version === 5 ? readStoredAdjustedPlanStateV5(value, evidence.retained, at)
        : evidence.version === 6 ? readStoredMultiAdjustedPlanV6(value, evidence.retained, at) : null
    return read?.kind === "loaded" ? read.state : null
  } catch { return null }
}

function explicitRpe(entry: PostSessionEntry): number | null {
  return Number.isInteger(entry.rpe) && entry.rpe >= 1 && entry.rpe <= 10 && entry.rpeBand === undefined
    && entry.fieldProvenance?.rpe?.provenance === FIELD_PROVENANCE.explicit ? entry.rpe : null
}

/** Only schema-valid structured details bound to this immutable link enter the key. */
function actualDetail(entry: PostSessionEntry) {
  const link = entry.plannedSessionLink
  const segment = plannedSegmentEvidenceSchema.safeParse(entry.exerciseLog?.plannedSegments)
  const repetition = plannedRepetitionEvidenceSchema.safeParse(entry.exerciseLog?.plannedRepetitions)
  const bound = (value: { plannedSessionId: string; sessionContentFingerprint: string }) => link
    && value.plannedSessionId === link.plannedSessionId && value.sessionContentFingerprint === link.sessionContentFingerprint
  return { segments: segment.success && bound(segment.data)
    ? { ...segment.data, results: [...segment.data.results].sort((a, b) => a.key.localeCompare(b.key)) }
    : entry.exerciseLog?.plannedSegments === undefined ? null : "INVALID",
  repetitions: repetition.success && bound(repetition.data)
    ? { ...repetition.data, results: [...repetition.data.results].sort((a, b) => a.set - b.set || a.repetition - b.repetition) }
    : entry.exerciseLog?.plannedRepetitions === undefined ? null : "INVALID" }
}

/** Adjusted snapshots have no adopted session RPE target. Keep observations, never
 * borrow the original template's RPE or invent a comparison/reduction authority. */
export function deriveAdjustedCycleResponse(entries: readonly JournalEntry[], previous: AdjustedCyclePredecessor): PlanCycleResponse {
  const state = previous.selection
  const posts = entries.filter((e): e is PostSessionEntry => e.kind === "post-session")
  const signatures = new Map<string, Set<string>>()
  for (const entry of posts) {
    const set = signatures.get(entry.id) ?? new Set<string>()
    set.add(hash({ id: entry.id, date: entry.date, plannedSessionId: entry.plannedSessionLink?.plannedSessionId ?? null,
      rpe: explicitRpe(entry), outcome: entry.activityOutcome ?? null, relation: entry.planExecutionRelation ?? null,
      slot: entry.activitySlot ?? null, detail: actualDetail(entry) }))
    signatures.set(entry.id, set)
  }
  const groups = new Map<string, { entry: PostSessionEntry; session: AdjustedCycleSession }[]>()
  let rejectedLinkCount = 0, duplicateCount = 0, conflictCount = 0
  for (const entry of posts) {
    if (!entry.plannedSessionLink) continue
    const session = resolveCurrentPlannedSession<AdjustedCycleSession>(state, entry.plannedSessionLink)
    if (!session || entry.date !== entry.plannedSessionLink.plannedDate
      || Date.parse(entry.plannedSessionLink.linkedAt) < Date.parse(state.generatedAt)) { rejectedLinkCount++; continue }
    const key = `${entry.date}:${session.day}:${session.slot}`
    const group = groups.get(key) ?? []
    group.push({ entry, session }); groups.set(key, group)
  }
  const rows: PlanJournalEvidenceRow[] = []
  for (const group of groups.values()) {
    const { entry, session } = group[0]!
    const conflict = new Set(group.map(g => g.entry.id)).size > 1
      || group.some(g => signatures.get(g.entry.id)!.size > 1)
    if (conflict) conflictCount++
    else duplicateCount += group.length - 1
    const rpe = explicitRpe(entry)
    const segmentInput = entry.exerciseLog?.plannedSegments, repetitionInput = entry.exerciseLog?.plannedRepetitions
    const notPerformed = session.role === "REST" || entry.activityOutcome === "RESTED" || entry.activityOutcome === "SKIPPED"
    const executionComparison = conflict || notPerformed || entry.planExecutionRelation === "NOT_APPLICABLE" ? undefined
      : segmentInput !== undefined && repetitionInput !== undefined
      ? { kind: "unavailable" as const, facts: [], unknowns: ["구간 기록과 반복 기록이 함께 있어 확인이 필요해요."],
        interpretation: "", completeDistanceCount: 0, timedCount: 0, changed: false }
      : segmentInput !== undefined
      ? comparePlannedSegments(segmentInput, entry.plannedSessionLink!, session)
      : repetitionInput !== undefined ? comparePlannedRepetitions(repetitionInput, entry.plannedSessionLink!, session) : undefined
    const detail = actualDetail(entry)
    const changed = entry.activityOutcome === "PARTIAL" || entry.activityOutcome === "LIGHT_ACTIVITY"
      || entry.planExecutionRelation === "MODIFIED" || entry.planExecutionRelation === "NOT_APPLICABLE"
      || (entry.activitySlot === "AM" || entry.activitySlot === "PM") && entry.activitySlot !== session.slot
      || executionComparison !== undefined && (executionComparison.kind === "unavailable" || executionComparison.changed)
    const plannedRpe = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.rpe : null
    rows.push({ plannedSessionId: entry.plannedSessionLink!.plannedSessionId,
      currentPlannedSessionId: createPlannedSessionLogDraft<AdjustedCycleSession>(state, session, state.generatedAt)!.link.plannedSessionId,
      source: "ACTIVE", date: entry.date, day: session.day, slot: session.slot, role: session.role,
      actualRpe: conflict || notPerformed ? null : rpe,
      plannedRpe: plannedRpe ? { ...plannedRpe } : null,
      ...(executionComparison ? { executionComparison } : {}),
      ...(!conflict && (detail.segments || detail.repetitions) ? { executionFingerprint: hash(detail) } : {}),
      comparison: conflict ? "CONFLICTING_RESULT" : notPerformed ? "NOT_PERFORMED" : changed ? "CHANGED_SESSION"
        : rpe === null ? "RPE_MISSING" : !plannedRpe ? "NO_PLANNED_RPE"
          : rpe > plannedRpe.maximum ? "ABOVE_RANGE" : rpe < plannedRpe.minimum ? "BELOW_RANGE" : "WITHIN_RANGE" })
  }
  rows.sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
  const within = rows.filter(r => r.comparison === "WITHIN_RANGE").length,
    above = rows.filter(r => r.comparison === "ABOVE_RANGE").length, below = rows.filter(r => r.comparison === "BELOW_RANGE").length
  const comparable = within + above + below
  return { version: PLAN_CYCLE_RESPONSE_VERSION, signal: !rows.length ? "NO_LINKED_RESULTS" : !comparable ? "NO_COMPARABLE_RESULTS"
    : comparable === 1 ? "ONE_SIGNAL" : above >= 2 ? "REPEATED_HIGHER_EFFORT" : within === comparable ? "REPEATED_MATCH" : "MIXED_SIGNAL",
    recommendation: "MAINTAIN", headline: "수정된 당시 훈련과 연결된 기록을 확인했어요.", rows,
    linkedResultCount: rows.length, comparableRpeCount: comparable, withinRangeCount: within, higherThanRangeCount: above,
    lowerThanRangeCount: below, unknownCount: rows.length - comparable, rejectedLinkCount, duplicateCount, conflictCount,
    archivedResultCount: 0, historyReadIncomplete: false, evidence: [] }
}

export function adjustedCycleStructuredSource(previous: AdjustedCyclePredecessor, entries: readonly JournalEntry[]) {
  const response = deriveAdjustedCycleResponse(entries, previous)
  // Capture exact validated detail changes even if their RPE classification stays the same.
  const details = entries.filter((e): e is PostSessionEntry => e.kind === "post-session" && e.plannedSessionLink !== undefined)
    .map(e => ({ id: e.id, link: e.plannedSessionLink, detail: actualDetail(e) }))
    .sort((a, b) => a.id.localeCompare(b.id) || hash(a).localeCompare(hash(b)))
  return { response, details }
}

type PreparationInput = {
  readonly previous: unknown
  readonly evidence: AdjustedCycleEvidence
  readonly expectedPredecessorFingerprint: string
  readonly candidate: PlanCandidate
  readonly nextStartDate: string
  readonly currentCheck: PlanCurrentCheck
  readonly entries: readonly JournalEntry[]
  readonly evaluatedAt: Date
}

/** Resolver contract for the real adjusted next-flow paths. Each source is the
 * current selected MAIN, including its AFTER configuration, not originalCandidate. */
export function prepareAdjustedCycleSuccessor(input: PreparationInput) {
  try {
    const previous = readAdjustedCyclePredecessor(input.previous, input.evidence, input.evaluatedAt)
    if (!previous) return reject("INVALID_STORED_PLAN")
    const request = { previous, expectedFingerprint: input.expectedPredecessorFingerprint,
      nextStartDate: input.nextStartDate, currentCheck: input.currentCheck }
    const continuity = input.evidence.version === 4 ? prepareAdjustedNextFrame(request, input.evidence.retained, input.evaluatedAt)
      : input.evidence.version === 5 ? prepareAdjustedNextFrameV3(request, input.evidence.retained, input.evaluatedAt)
        : prepareMultiAdjustedNextFrameV3(request, input.evidence.retained, input.evaluatedAt)
    if (continuity.kind !== "prepared") return continuity
    const candidate = input.candidate, selection = previous.selection, active = selection.activePlan
    const counts = (sessions: readonly AdjustedCycleSession[]) => sessions.reduce<Record<string, number>>((out, s) => {
      const key = `${s.role}:${s.plannedEnergyIntent}`; out[key] = (out[key] ?? 0) + 1; return out
    }, {})
    const originalTemplate = "adjustment" in selection ? selection.adjustment.originalSelectedDetailedTemplateRef
      : selection.adjustments.originalSelectedDetailedTemplateRef
    if (!hasCanonicalJsonTree(candidate) || !isVerifiedPlanCandidate(candidate) || candidate.selectionAuthority !== "SELF"
      || candidate.eventDistanceM !== active.eventDistanceM || candidate.eventGroup !== selection.intake.eventGroup
      || !candidate.candidateId.includes(`:${selection.intake.experienceBand.toLowerCase()}:`)
      || candidate.selectedEnergyIntent !== active.selectedEnergyIntent || !same(candidate.frame, active.frame)
      || !same(candidate.selectedDetailedTemplateRef, originalTemplate) || !same(counts(candidate.sessions), counts(active.sessions))
      || !same(candidate.continuityContext, { kind: "PREVIOUS_FRAME_CONTEXT_RETAINED", ...continuity.context.continuity }))
      return reject("INCOMPATIBLE_ADJUSTED_SUCCESSOR_SCOPE")
    const old = orderedMain(active.sessions), ordinals = new Map<string, number>()
    const rows = orderedMain(candidate.sessions).map(target => {
      const purpose = target.plannedEnergyIntent, ordinal = (ordinals.get(purpose) ?? 0) + 1
      ordinals.set(purpose, ordinal)
      const source = old.filter(s => s.plannedEnergyIntent === purpose)[ordinal - 1]!
      const link = createPlannedSessionLogDraft<AdjustedCycleSession>(selection, source, selection.generatedAt)!
      return { purpose, ordinal, source: structuredClone(source), sourcePlannedSessionId: link.link.plannedSessionId,
        sourceNotation: sessionWorkoutNotation(source), targetNotation: sessionWorkoutNotation(source),
        target: { day: target.day, slot: target.slot }, sourcePrescriptionFingerprint: hash(source.prescription) }
    })
    const structured = adjustedCycleStructuredSource(previous, input.entries)
    const content = { version: 1 as const, predecessorFingerprint: previous.contentFingerprint,
      candidateFingerprint: hash(candidate), nextStartDate: input.nextStartDate,
      evidenceFingerprint: hash(structured), rows }
    return { kind: "prepared" as const, rows, response: structured.response, continuity: continuity.context,
      context: { ...content, contentFingerprint: hash(content) }, executionAuthority: "NONE" as const,
      storageState: "NOT_SAVED" as const, futureEnvironmentVerified: false as const,
      requiredNextGate: "REVIEWED_ADJUSTED_SUCCESSOR_TRANSACTION" as const }
  } catch { return reject("INVALID_ADJUSTED_CYCLE_SOURCE") }
}

export type AdjustedCycleSuccessorContext = Extract<ReturnType<typeof prepareAdjustedCycleSuccessor>, { kind: "prepared" }>["context"]

function detailedContent(session: AdjustedCycleSession): unknown {
  const p = session.prescription
  if (p.kind === "ADJUSTED_METHOD") return { kind: p.kind, configuration: p.snapshot.receipt.after.configuration,
    sequence: p.snapshot.projection.sequence, targets: p.snapshot.projection.segmentTargets,
    explanation: { version: p.snapshot.explanation.version, reviewRef: p.snapshot.explanation.reviewRef,
      evidenceRefs: p.snapshot.explanation.evidenceRefs } }
  if (p.kind === "ADJUSTED_METHOD_V3") return { kind: p.kind, configuration: p.snapshot.receipt.after.configuration,
    sequence: p.projection.sequence, targets: p.projection.segmentTargets,
    explanation: { version: p.snapshot.explanation.version, reviewRef: p.snapshot.explanation.reviewRef,
      evidenceRefs: p.snapshot.explanation.evidenceRefs } }
  if (p.kind === "PACE_TARGET") {
    const { elapsedLabel: _elapsed, ...anchor } = p.selectedAnchor
    return { ...p, selectedAnchor: anchor }
  }
  return p
}

/** Both states must come from their version-aware readers/full-plan selectors.
 * Rebound snapshot IDs may change, but the selected AFTER dose and targets may not. */
export function adjustedCycleSelectionMaintainsDetail(previous: AdjustedCyclePredecessor,
  selected: AdjustedCyclePredecessor["selection"]): boolean {
  try {
    const old = orderedMain(previous.selection.activePlan.sessions), next = orderedMain(selected.activePlan.sessions)
    if (old.length !== next.length) return false
    const ordinals = new Map<string, number>()
    return next.every(target => {
      const purpose = target.plannedEnergyIntent, ordinal = (ordinals.get(purpose) ?? 0) + 1
      ordinals.set(purpose, ordinal)
      const source = old.filter(s => s.plannedEnergyIntent === purpose)[ordinal - 1]
      return source !== undefined && same(detailedContent(source), detailedContent(target))
    })
  } catch { return false }
}
