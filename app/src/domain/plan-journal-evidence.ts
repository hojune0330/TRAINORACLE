import type { PlanSession } from "@impl/plan-generator/types"
import { FIELD_PROVENANCE } from "./field-provenance"
import type { JournalEntry, PostSessionEntry } from "./journal-schema"
import type { PlanBetaState } from "./plan-beta-schema"
import { resolveCurrentPlannedSession } from "./planned-session-link"

export type PlanJournalComparison =
  | "WITHIN_RANGE" | "ABOVE_RANGE" | "BELOW_RANGE"
  | "RPE_MISSING" | "NO_PLANNED_RPE" | "NOT_PERFORMED"
  | "CHANGED_SESSION" | "CONFLICTING_RESULT"

export type PlanJournalEvidenceRow = {
  readonly plannedSessionId: string
  readonly date: string
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly role: PlanSession["role"]
  readonly actualRpe: number | null
  readonly plannedRpe: { readonly minimum: number; readonly maximum: number } | null
  readonly comparison: PlanJournalComparison
}

export type PlanJournalEvidence = {
  readonly rows: readonly PlanJournalEvidenceRow[]
  readonly rejectedLinkCount: number
  readonly duplicateCount: number
  readonly conflictCount: number
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
  })
}

function comparisonFor(entry: PostSessionEntry, session: PlanSession): PlanJournalComparison {
  if (session.role === "REST" || entry.activityOutcome === "RESTED" || entry.activityOutcome === "SKIPPED") {
    return "NOT_PERFORMED"
  }
  if (entry.activityOutcome === "PARTIAL" || entry.activityOutcome === "LIGHT_ACTIVITY"
    || entry.planExecutionRelation === "MODIFIED" || entry.planExecutionRelation === "NOT_APPLICABLE"
    || (entry.activitySlot === "AM" || entry.activitySlot === "PM") && entry.activitySlot !== session.slot) {
    return "CHANGED_SESSION"
  }
  const rpe = explicitRpe(entry)
  if (rpe === null) return "RPE_MISSING"
  if (session.prescription.kind !== "RPE_TIME_RANGE") return "NO_PLANNED_RPE"
  if (rpe > session.prescription.rpe.maximum) return "ABOVE_RANGE"
  if (rpe < session.prescription.rpe.minimum) return "BELOW_RANGE"
  return "WITHIN_RANGE"
}

export function collectPlanJournalEvidence(
  entries: readonly JournalEntry[],
  state: PlanBetaState,
): PlanJournalEvidence {
  const postSessions = entries.filter((entry): entry is PostSessionEntry => entry.kind === "post-session")
  const signaturesById = new Map<string, Set<string>>()
  for (const entry of postSessions) {
    const signatures = signaturesById.get(entry.id) ?? new Set<string>()
    signatures.add(resultSignature(entry))
    signaturesById.set(entry.id, signatures)
  }
  const byOccurrence = new Map<string, { entry: PostSessionEntry; session: PlanSession }[]>()
  let rejectedLinkCount = 0
  let duplicateCount = 0
  let conflictCount = 0
  for (const entry of postSessions) {
    if (entry.plannedSessionLink === undefined) continue
    const session = resolveCurrentPlannedSession(state, entry.plannedSessionLink)
    if (session === null || entry.date !== entry.plannedSessionLink.plannedDate) {
      rejectedLinkCount += 1
      continue
    }
    const id = entry.plannedSessionLink.plannedSessionId
    const group = byOccurrence.get(id) ?? []
    group.push({ entry, session })
    byOccurrence.set(id, group)
  }
  const rows: PlanJournalEvidenceRow[] = []
  for (const [plannedSessionId, group] of byOccurrence) {
    const first = group[0]
    if (first === undefined) continue
    const { entry, session } = first
    const conflict = new Set(group.map(item => item.entry.id)).size > 1
      || group.some(item => (signaturesById.get(item.entry.id)?.size ?? 0) > 1)
    if (conflict) conflictCount += 1
    else duplicateCount += group.length - 1
    const comparison = conflict ? "CONFLICTING_RESULT" : comparisonFor(entry, session)
    rows.push({
      plannedSessionId,
      date: entry.date,
      day: session.day,
      slot: session.slot,
      role: session.role,
      actualRpe: conflict || comparison === "NOT_PERFORMED" ? null : explicitRpe(entry),
      plannedRpe: session.prescription.kind === "RPE_TIME_RANGE"
        ? { ...session.prescription.rpe } : null,
      comparison,
    })
  }
  rows.sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
  return { rows, rejectedLinkCount, duplicateCount, conflictCount }
}
