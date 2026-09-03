import { hasImportedField, isImportedField, type FieldProvenanceMap } from "./field-provenance"
import type { JournalEntry } from "./journal-schema"

export const IMPORTED_OBJECTIVE_FIELDS = ["distanceKm", "durationMin", "avgPace"] as const

/** Open only the mixed-origin progressive path, not arbitrary imported records. */
export function canEditJournalEntry(entry: JournalEntry): boolean {
  if (entry.syncState !== "local") return false
  if (!hasImportedField(entry.fieldProvenance)) return true
  return entry.kind === "post-session"
    && entry.captureDepth !== undefined
    && entry.fieldProvenance?.activityOutcome?.provenance === "EXPLICIT"
    && (entry.activityOutcome === "COMPLETED" || entry.activityOutcome === "PARTIAL" || entry.activityOutcome === "LIGHT_ACTIVITY")
    && Object.keys(entry.fieldProvenance ?? {})
    .filter((field) => isImportedField(field, entry.fieldProvenance))
    .every((field) => (IMPORTED_OBJECTIVE_FIELDS as readonly string[]).includes(field))
}

export function keepsImportedObjectiveFacts(previous: JournalEntry, next: JournalEntry): boolean {
  if (!hasImportedField(previous.fieldProvenance)) return true
  if (!canEditJournalEntry(previous) || previous.kind !== "post-session" || next.kind !== "post-session") return false
  return IMPORTED_OBJECTIVE_FIELDS.every((field) => !isImportedField(field, previous.fieldProvenance)
    || (sameStructuredValue(previous[field], next[field])
      && sameStructuredValue(previous.fieldProvenance?.[field], next.fieldProvenance?.[field])))
}

function provenanceValues(entry: JournalEntry): Readonly<Record<string, unknown>> {
  if (entry.kind === "post-session") return {
    system: entry.system,
    activityOutcome: entry.activityOutcome,
    activitySlot: entry.activitySlot,
    planExecutionRelation: entry.planExecutionRelation,
    painCheckStatus: entry.painCheckStatus,
    painParts: entry.painParts,
    plannedSessionLink: entry.plannedSessionLink,
    distanceKm: entry.distanceKm,
    durationMin: entry.durationMin,
    avgPace: entry.avgPace,
    rpe: entry.rpe,
    rpeBand: entry.rpeBand,
    plannedRpe: entry.intensityAssessment?.plannedRpe,
    objectiveComponents: entry.intensityAssessment?.objectiveComponents,
  }
  if (entry.kind === "evening") return {
    sleepH: entry.sleepH, sleepQuality: entry.sleepQuality,
    weightKg: entry.weightKg, restingHr: entry.restingHr,
    painParts: entry.painParts, mood: entry.mood,
  }
  return { tension: entry.tension, condition: entry.condition, mood: entry.mood, goalPace: entry.goalPace }
}

function sameStructuredValue(left: unknown, right: unknown): boolean {
  return Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right)
}

/** Plaintext and private-vault updates share the unchanged-field provenance rule. */
export function preserveJournalProvenance(previous: JournalEntry, next: JournalEntry): JournalEntry {
  if (previous.fieldProvenance === undefined) {
    const { fieldProvenance: _discarded, ...legacyEntry } = next
    return legacyEntry
  }
  const nextProvenance = next.fieldProvenance ?? {}
  const previousValues = provenanceValues(previous)
  const nextValues = provenanceValues(next)
  const merged: Record<string, FieldProvenanceMap[string]> = {}
  const fields = new Set([...Object.keys(previous.fieldProvenance), ...Object.keys(nextProvenance)])
  for (const field of fields) {
    if (nextValues[field] === undefined && nextProvenance[field] === undefined) continue
    const selected = sameStructuredValue(previousValues[field], nextValues[field])
      ? previous.fieldProvenance[field]
      : nextProvenance[field]
    if (selected !== undefined) merged[field] = selected
  }
  return { ...next, fieldProvenance: merged }
}
