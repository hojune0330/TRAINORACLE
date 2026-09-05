import type { DetailedTemplateRef } from "@impl/plan-generator/types"
import type { JournalEntry, PostSessionEntry } from "./journal-schema"
import { projectStructuredJournalObservation } from "./journal-observation"
import type { PlanBetaState } from "./plan-beta-schema"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession } from "./planned-session-link"
import type { PlannedSessionLink } from "./planned-session-link"

type ActualMetrics = {
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly secondsPerKm: number | null
  readonly rpe: number | null
  readonly splits: null
  readonly recovery: null
}

type ResultRelation = {
  readonly journalId: string
  readonly outcome: PostSessionEntry["activityOutcome"] | null
  readonly relation: PostSessionEntry["planExecutionRelation"] | null
}

export type PlanMethodObservation = {
  readonly occurrence: Omit<PlannedSessionLink, "linkedAt" | "linkSource">
  readonly selectedDetailedTemplateRef: DetailedTemplateRef | null
  readonly status: "MISSING" | "LINKED" | "DUPLICATE" | "CONFLICTING"
  readonly results: readonly ResultRelation[]
  readonly duplicateCount: number
  readonly actual: ActualMetrics
  readonly actualEvidence: "EXPLICIT_STRUCTURED_ONLY"
  readonly measuredAdherence: null
}

const emptyActual = (): ActualMetrics => ({
  distanceKm: null, durationMin: null, secondsPerKm: null, rpe: null,
  splits: null, recovery: null,
})

function actualMetrics(entry: PostSessionEntry): ActualMetrics {
  // Only allowlisted explicit measurements enter the shared numeric parser.
  // No memo, system label, symptom, provenance metadata or planned value is input.
  const explicit = (field: string) => entry.fieldProvenance?.[field]?.provenance === "EXPLICIT"
  const observed = projectStructuredJournalObservation({
    sourceKind: "SESSION_RESULT_RECORD", sourceId: entry.id,
    loggedOn: entry.date, observedAt: entry.savedAt,
    distanceKm: explicit("distanceKm") ? entry.distanceKm : "",
    durationMin: explicit("durationMin") ? entry.durationMin : "",
    avgPace: explicit("avgPace") ? entry.avgPace : "",
    rpe: explicit("rpe") && entry.rpeBand === undefined ? entry.rpe : 0,
  })
  return {
    distanceKm: observed.distanceKm, durationMin: observed.durationMin,
    secondsPerKm: observed.secondsPerKm, rpe: observed.rpe,
    splits: null, recovery: null,
  }
}

function relation(entry: PostSessionEntry): ResultRelation {
  return { journalId: entry.id, outcome: entry.activityOutcome ?? null,
    relation: entry.planExecutionRelation ?? null }
}

function identity(link: PlannedSessionLink) {
  return {
    schemaVersion: link.schemaVersion, plannedSessionId: link.plannedSessionId,
    planVersionId: link.planVersionId, candidateFingerprint: link.candidateFingerprint,
    sessionContentFingerprint: link.sessionContentFingerprint,
    plannedDate: link.plannedDate, sessionDay: link.sessionDay,
    sessionSlot: link.sessionSlot, plannedRole: link.plannedRole,
    plannedEnergyIntent: link.plannedEnergyIntent,
  }
}

/** Local-only projection over caller-supplied original plan snapshots, not v4
 * archive summaries. The caller owns snapshot validity, visibility and scope.
 * Exact linkage is not measured adherence, method exposure or recommendation input.
 * RPE-only/REST occurrences retain a null method ref; no method is inferred.
 */
export function collectPlanMethodObservations(
  entries: readonly JournalEntry[],
  originalPlans: readonly PlanBetaState[],
): {
  readonly rows: readonly PlanMethodObservation[]
  readonly rejectedLinkCount: number
  readonly duplicateCount: number
  readonly conflictCount: number
} {
  const occurrences = new Map<string, {
    row: PlanMethodObservation
    plans: PlanBetaState[]
    entries: PostSessionEntry[]
  }>()
  for (const plan of originalPlans) {
    for (const session of plan.activePlan.sessions) {
      const draft = createPlannedSessionLogDraft(plan, session, plan.generatedAt)
      if (draft === null) continue
      const id = draft.link.plannedSessionId
      const existing = occurrences.get(id)
      if (existing !== undefined) { existing.plans.push(plan); continue }
      const prescription = session.prescription
      occurrences.set(id, {
        plans: [plan], entries: [],
        row: {
          occurrence: identity(draft.link),
          selectedDetailedTemplateRef: prescription.kind === "PACE_TARGET" ? {
            templateId: prescription.templateId, version: prescription.templateVersion,
            fingerprint: prescription.templateContentFingerprint,
          } : null,
          status: "MISSING", results: [], duplicateCount: 0, actual: emptyActual(),
          actualEvidence: "EXPLICIT_STRUCTURED_ONLY", measuredAdherence: null,
        },
      })
    }
  }
  const signatures = new Map<string, Set<string>>()
  let rejectedLinkCount = 0
  for (const entry of entries) {
    if (entry.kind !== "post-session") continue
    const link = entry.plannedSessionLink
    const signature = JSON.stringify({
      date: entry.date, link: link === undefined ? null : identity(link),
      slot: entry.activitySlot ?? null, ...relation(entry), actual: actualMetrics(entry),
    })
    const versions = signatures.get(entry.id) ?? new Set<string>()
    versions.add(signature)
    signatures.set(entry.id, versions)
    if (link === undefined) continue
    const occurrence = occurrences.get(link.plannedSessionId)
    if (occurrence === undefined || entry.date !== link.plannedDate
      || ((entry.activitySlot === "AM" || entry.activitySlot === "PM")
        && entry.activitySlot !== link.sessionSlot)
      || !occurrence.plans.some(plan => resolveCurrentPlannedSession(plan, link) !== null)) {
      rejectedLinkCount += 1
      continue
    }
    occurrence.entries.push(entry)
  }
  const rows = [...occurrences.values()].map(({ row, entries: linked }): PlanMethodObservation => {
    const first = linked[0]
    if (first === undefined) return row
    const conflict = new Set(linked.map(entry => entry.id)).size > 1
      || linked.some(entry => (signatures.get(entry.id)?.size ?? 0) > 1)
    const duplicateCount = conflict ? 0 : linked.length - 1
    const results = [...new Map(linked.map(entry => {
      const result = relation(entry)
      return [JSON.stringify(result), result] as const
    })).values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    const notPerformed = row.occurrence.plannedRole === "REST"
      || first.activityOutcome === "RESTED" || first.activityOutcome === "SKIPPED"
    return {
      ...row, status: conflict ? "CONFLICTING" : duplicateCount > 0 ? "DUPLICATE" : "LINKED",
      results, duplicateCount, actual: conflict || notPerformed ? emptyActual() : actualMetrics(first),
    }
  }).sort((a, b) => a.occurrence.plannedDate.localeCompare(b.occurrence.plannedDate)
    || a.occurrence.sessionSlot.localeCompare(b.occurrence.sessionSlot)
    || a.occurrence.plannedSessionId.localeCompare(b.occurrence.plannedSessionId))
  return { rows, rejectedLinkCount,
    duplicateCount: rows.reduce((sum, row) => sum + row.duplicateCount, 0),
    conflictCount: rows.filter(row => row.status === "CONFLICTING").length }
}
