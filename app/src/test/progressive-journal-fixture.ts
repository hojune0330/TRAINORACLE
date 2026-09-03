import type { PostSessionEntry } from "../domain/journal-schema"
import type { ImportedActivity } from "../domain/import/activity-file"
import type { ImportDraft, ImportDraftSelection } from "../domain/import/import-draft"

export function waitingJournal(overrides: Partial<PostSessionEntry> = {}): PostSessionEntry {
  return {
    id: "synthetic-quick", kind: "post-session", date: "2026-09-02",
    savedAt: "2026-09-02T01:00:00.000Z", syncState: "local",
    captureDepth: "QUICK", activityOutcome: "COMPLETED", activitySlot: "AM",
    objectiveDataState: "WAITING", planExecutionRelation: "NOT_APPLICABLE",
    painCheckStatus: "NO_SIGNAL_REPORTED", system: "", title: "Synthetic journal",
    distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "",
    fieldProvenance: {
      activityOutcome: { provenance: "EXPLICIT" }, activitySlot: { provenance: "EXPLICIT" },
      plannedSessionLink: { provenance: "MISSING" },
      planExecutionRelation: { provenance: "DERIVED", derivedFrom: ["activityOutcome", "plannedSessionLink"], derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2" },
      painCheckStatus: { provenance: "EXPLICIT" }, painParts: { provenance: "MISSING" },
      system: { provenance: "MISSING" }, distanceKm: { provenance: "MISSING" },
      durationMin: { provenance: "MISSING" }, avgPace: { provenance: "MISSING" }, rpe: { provenance: "MISSING" },
    },
    ...overrides,
  }
}

export const watchActivity: ImportedActivity = {
  date: "2026-09-02", name: "Synthetic watch activity", sport: "Running",
  distanceKm: "5.00", durationMin: "25", avgPace: "5:00",
}

export function addToJournal(draft: ImportDraft, entry: PostSessionEntry): ImportDraftSelection {
  return { draft, intent: { kind: "ADD_TO_EXISTING", entryId: entry.id, expectedSavedAt: entry.savedAt } }
}
