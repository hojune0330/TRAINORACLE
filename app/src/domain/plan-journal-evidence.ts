import type { PlanSession } from "@impl/plan-generator/types"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { FIELD_PROVENANCE } from "./field-provenance"
import type { JournalEntry, PostSessionEntry } from "./journal-schema"
import type { PlanBetaState } from "./plan-beta-schema"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession } from "./planned-session-link"
import { resolveExecutionReplanSource } from "./execution-replan-source"
import { comparePlannedSegments, plannedSegmentEvidenceSchema } from "./planned-segment-evidence"
import { comparePlannedRepetitions, plannedRepetitionEvidenceSchema, type RepetitionComparison } from "./planned-repetition-evidence"
import { painLevelsRequireReview } from "../safety/memo-safety"

export type PlanJournalHistory =
  | { readonly kind: "loaded"; readonly plans: readonly unknown[] }
  | { readonly kind: "unavailable" }

export type PlanJournalComparison =
  | "WITHIN_RANGE" | "ABOVE_RANGE" | "BELOW_RANGE"
  | "RPE_MISSING" | "NO_PLANNED_RPE" | "NOT_PERFORMED"
  | "CHANGED_SESSION" | "CONFLICTING_RESULT"

export type PlanJournalEvidenceRow = {
  readonly plannedSessionId: string
  readonly currentPlannedSessionId: string
  readonly source: "ACTIVE" | "ARCHIVED"
  readonly date: string
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly role: PlanSession["role"]
  readonly actualRpe: number | null
  readonly plannedRpe: { readonly minimum: number; readonly maximum: number } | null
  readonly comparison: PlanJournalComparison
  readonly adaptationEligibility?: "CONFIRMED" | "PAIN_SIGNAL" | "UNCONFIRMED"
  readonly executionComparison?: RepetitionComparison
  readonly executionFingerprint?: string
}

export type PlanJournalEvidence = {
  readonly rows: readonly PlanJournalEvidenceRow[]
  readonly rejectedLinkCount: number
  readonly duplicateCount: number
  readonly conflictCount: number
  readonly archivedResultCount: number
  readonly historyReadIncomplete: boolean
}

function explicitRpe(entry: PostSessionEntry): number | null {
  return Number.isInteger(entry.rpe) && entry.rpe >= 1 && entry.rpe <= 10
    && entry.rpeBand === undefined
    && entry.fieldProvenance?.rpe?.provenance === FIELD_PROVENANCE.explicit
    ? entry.rpe : null
}

// Deliberately excludes free text, including memo existence, from deduplication.
function resultSignature(entry: PostSessionEntry): string {
  return JSON.stringify({
    id: entry.id,
    date: entry.date,
    plannedSessionId: entry.plannedSessionLink?.plannedSessionId ?? null,
    rpe: explicitRpe(entry),
    outcome: entry.activityOutcome ?? null,
    relation: entry.planExecutionRelation ?? null,
    slot: entry.activitySlot ?? null,
    painSignal: entry.painCheckStatus === "SIGNAL_REPORTED" || painLevelsRequireReview(entry.painParts ?? {}),
    performanceProvenance: [entry.fieldProvenance?.activityOutcome?.provenance ?? null,
      entry.fieldProvenance?.activitySlot?.provenance ?? null, entry.fieldProvenance?.painCheckStatus?.provenance ?? null],
    painCheckStatus: entry.painCheckStatus ?? null,
    segments: structuredSegments(entry),
    repetitions: structuredRepetitions(entry),
  })
}

function structuredSegments(entry: PostSessionEntry) {
  if (entry.exerciseLog?.plannedSegments === undefined) return null
  const parsed = plannedSegmentEvidenceSchema.safeParse(entry.exerciseLog.plannedSegments)
  return parsed.success ? { ...parsed.data, results: [...parsed.data.results].sort((a, b) => a.key.localeCompare(b.key)) } : "INVALID"
}

function structuredRepetitions(entry: PostSessionEntry) {
  if (entry.exerciseLog?.plannedRepetitions === undefined) return null
  const parsed = plannedRepetitionEvidenceSchema.safeParse(entry.exerciseLog.plannedRepetitions)
  return parsed.success ? { ...parsed.data, results: [...parsed.data.results].sort((a, b) => a.set - b.set || a.repetition - b.repetition) } : "INVALID"
}

function executionFor(entry: PostSessionEntry, session: PlanSession): RepetitionComparison | undefined {
  if (!entry.plannedSessionLink || entry.activityOutcome === "RESTED" || entry.activityOutcome === "SKIPPED"
      || entry.planExecutionRelation === "NOT_APPLICABLE") return undefined
  if (entry.exerciseLog?.plannedSegments !== undefined && entry.exerciseLog.plannedRepetitions !== undefined) {
    return { kind: "unavailable", facts: [], unknowns: ["구간 기록과 반복 기록이 함께 있어 어느 기록이 맞는지 확인이 필요해요."],
      interpretation: "", completeDistanceCount: 0, timedCount: 0, changed: false }
  }
  if (entry.exerciseLog?.plannedSegments !== undefined) {
    return comparePlannedSegments(entry.exerciseLog.plannedSegments, entry.plannedSessionLink, session)
  }
  if (entry.exerciseLog?.plannedRepetitions !== undefined) {
    return comparePlannedRepetitions(entry.exerciseLog.plannedRepetitions, entry.plannedSessionLink, session)
  }
  return undefined
}

function comparisonFor(entry: PostSessionEntry, session: PlanSession, execution?: RepetitionComparison): PlanJournalComparison {
  if (session.role === "REST" || entry.activityOutcome === "RESTED" || entry.activityOutcome === "SKIPPED") {
    return "NOT_PERFORMED"
  }
  if (entry.activityOutcome === "PARTIAL" || entry.activityOutcome === "LIGHT_ACTIVITY"
    || entry.planExecutionRelation === "MODIFIED" || entry.planExecutionRelation === "NOT_APPLICABLE"
    || (entry.activitySlot === "AM" || entry.activitySlot === "PM") && entry.activitySlot !== session.slot
    || execution?.changed || execution?.kind === "unavailable") {
    return "CHANGED_SESSION"
  }
  const rpe = explicitRpe(entry)
  if (rpe === null) return "RPE_MISSING"
  if (session.prescription.kind !== "RPE_TIME_RANGE") return "NO_PLANNED_RPE"
  if (rpe > session.prescription.rpe.maximum) return "ABOVE_RANGE"
  if (rpe < session.prescription.rpe.minimum) return "BELOW_RANGE"
  return "WITHIN_RANGE"
}

function adaptationEligibility(entry: PostSessionEntry, session: PlanSession): NonNullable<PlanJournalEvidenceRow["adaptationEligibility"]> {
  if (entry.painCheckStatus === "SIGNAL_REPORTED" || painLevelsRequireReview(entry.painParts ?? {})) return "PAIN_SIGNAL"
  return entry.activityOutcome === "COMPLETED" && entry.activitySlot === session.slot
    && entry.painCheckStatus === "NO_SIGNAL_REPORTED"
    && entry.fieldProvenance?.activityOutcome?.provenance === "EXPLICIT"
    && entry.fieldProvenance?.activitySlot?.provenance === "EXPLICIT"
    && entry.fieldProvenance?.painCheckStatus?.provenance === "EXPLICIT" ? "CONFIRMED" : "UNCONFIRMED"
}

export function collectPlanJournalEvidence(
  entries: readonly JournalEntry[],
  state: PlanBetaState,
  history: PlanJournalHistory = { kind: "unavailable" },
): PlanJournalEvidence {
  const originals = history.kind === "loaded" ? history.plans : []
  const historyReadIncomplete = history.kind === "unavailable" && state.version === 3
    && (state.catalogReplacement !== undefined || state.executionReplan !== undefined)
  const postSessions = entries.filter((entry): entry is PostSessionEntry => entry.kind === "post-session")
  const signaturesById = new Map<string, Set<string>>()
  for (const entry of postSessions) {
    const signatures = signaturesById.get(entry.id) ?? new Set<string>()
    signatures.add(resultSignature(entry))
    signaturesById.set(entry.id, signatures)
  }
  const byOccurrence = new Map<string, { entry: PostSessionEntry; session: PlanSession; source: "ACTIVE" | "ARCHIVED" }[]>()
  let rejectedLinkCount = 0
  let duplicateCount = 0
  let conflictCount = 0
  for (const entry of postSessions) {
    if (entry.plannedSessionLink === undefined) continue
    const resolved = state.version === 3
      ? resolveExecutionReplanSource(state, entry.plannedSessionLink, originals) : null
    const session = state.version === 3 ? resolved?.session ?? null
      : resolveCurrentPlannedSession(state, entry.plannedSessionLink)
    if (session === null || entry.date !== entry.plannedSessionLink.plannedDate) {
      rejectedLinkCount += 1
      continue
    }
    // Exact source resolution precedes grouping; dates alone never create a link.
    const id = `${entry.plannedSessionLink.plannedDate}:${session.day}:${session.slot}`
    const group = byOccurrence.get(id) ?? []
    group.push({ entry, session, source: resolved?.source ?? "ACTIVE" })
    byOccurrence.set(id, group)
  }
  const rows: PlanJournalEvidenceRow[] = []
  for (const group of byOccurrence.values()) {
    const first = group[0]
    if (first === undefined) continue
    const { entry, session } = first
    const conflict = new Set(group.map(item => item.entry.id)).size > 1
      || group.some(item => (signaturesById.get(item.entry.id)?.size ?? 0) > 1)
    if (conflict) conflictCount += 1
    else duplicateCount += group.length - 1
    const execution = conflict ? undefined : executionFor(entry, session)
    const comparison = conflict ? "CONFLICTING_RESULT" : comparisonFor(entry, session, execution)
    rows.push({
      plannedSessionId: entry.plannedSessionLink!.plannedSessionId,
      currentPlannedSessionId: createPlannedSessionLogDraft(state, session, state.generatedAt)!.link.plannedSessionId,
      source: group.some(item => item.source === "ARCHIVED") ? "ARCHIVED" : "ACTIVE",
      date: entry.date,
      day: session.day,
      slot: session.slot,
      role: session.role,
      actualRpe: conflict || comparison === "NOT_PERFORMED" ? null : explicitRpe(entry),
      plannedRpe: session.prescription.kind === "RPE_TIME_RANGE"
        ? { ...session.prescription.rpe } : null,
      comparison,
      adaptationEligibility: conflict ? "UNCONFIRMED" : adaptationEligibility(entry, session),
      ...(execution ? { executionComparison: execution,
        executionFingerprint: canonicalJsonFingerprint("plan-actual-execution-v1", {
          segments: structuredSegments(entry), repetitions: structuredRepetitions(entry),
        }) } : {}),
    })
  }
  rows.sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
  return { rows, rejectedLinkCount, duplicateCount, conflictCount,
    archivedResultCount: rows.filter(row => row.source === "ARCHIVED").length, historyReadIncomplete }
}
