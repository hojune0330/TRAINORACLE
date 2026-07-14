import type {
  EveningEntry,
  JournalEntry,
  PostSessionEntry,
  RaceEntry,
} from "./journal-schema"
import { isEligibleForAnalysis } from "./field-provenance"

export type SafePostSessionEntry = Omit<PostSessionEntry, "memo" | "memoPurpose">
export type SafeEveningEntry = Omit<EveningEntry, "note" | "memoPurpose">
export type SafeRaceEntry = Omit<RaceEntry, "memo" | "memoPurpose">

export type SafeJournalEntry = SafePostSessionEntry | SafeEveningEntry | SafeRaceEntry

export type AnalysisPostSessionEntry = SafePostSessionEntry
export type AnalysisEveningEntry = SafeEveningEntry
export type AnalysisRaceEntry = Omit<SafeRaceEntry, "tension" | "condition" | "mood" | "goalPace">
export type AnalysisJournalEntry = AnalysisPostSessionEntry | AnalysisEveningEntry | AnalysisRaceEntry

function unreachableEntry(entry: never): never {
  throw new TypeError(`Unsupported journal entry: ${String(entry)}`)
}

function toSafeJournalEntry(entry: JournalEntry): SafeJournalEntry {
  switch (entry.kind) {
    case "post-session":
      return {
        id: entry.id,
        kind: entry.kind,
        date: entry.date,
        savedAt: entry.savedAt,
        syncState: "local",
        system: entry.system,
        title: entry.title,
        distanceKm: entry.distanceKm,
        durationMin: entry.durationMin,
        avgPace: entry.avgPace,
        rpe: entry.rpe,
      }
    case "evening":
      return {
        id: entry.id,
        kind: entry.kind,
        date: entry.date,
        savedAt: entry.savedAt,
        syncState: "local",
        sleepH: entry.sleepH,
        sleepQuality: entry.sleepQuality,
        weightKg: entry.weightKg,
        restingHr: entry.restingHr,
        painParts: entry.painParts,
        mood: entry.mood,
      }
    case "race":
      return {
        id: entry.id,
        kind: entry.kind,
        date: entry.date,
        savedAt: entry.savedAt,
        syncState: "local",
        stage: entry.stage,
        record: entry.record,
        rank: entry.rank,
        result: entry.result,
        tension: entry.tension,
        condition: entry.condition,
        mood: entry.mood,
        goalPace: entry.goalPace,
      }
    default:
      return unreachableEntry(entry)
  }
}

function hasEligibleAnalysisField(entry: PostSessionEntry | EveningEntry): boolean {
  const fields = entry.kind === "post-session"
    ? ["distanceKm", "durationMin", "avgPace", "rpe"]
    : ["sleepH", "sleepQuality", "weightKg", "restingHr", "painParts", "mood"]
  return fields.some((fieldName) => isEligibleForAnalysis(fieldName, entry.fieldProvenance))
}

function toAnalysisPostSessionEntry(entry: PostSessionEntry): AnalysisPostSessionEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    date: entry.date,
    savedAt: entry.savedAt,
    syncState: "local",
    system: entry.system,
    title: entry.title,
    distanceKm: isEligibleForAnalysis("distanceKm", entry.fieldProvenance) ? entry.distanceKm : "",
    durationMin: isEligibleForAnalysis("durationMin", entry.fieldProvenance) ? entry.durationMin : "",
    avgPace: isEligibleForAnalysis("avgPace", entry.fieldProvenance) ? entry.avgPace : "",
    rpe: isEligibleForAnalysis("rpe", entry.fieldProvenance) ? entry.rpe : 0,
  }
}

function toAnalysisEveningEntry(entry: EveningEntry): AnalysisEveningEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    date: entry.date,
    savedAt: entry.savedAt,
    syncState: "local",
    sleepH: isEligibleForAnalysis("sleepH", entry.fieldProvenance) ? entry.sleepH : 0,
    sleepQuality: isEligibleForAnalysis("sleepQuality", entry.fieldProvenance) ? entry.sleepQuality : 0,
    weightKg: isEligibleForAnalysis("weightKg", entry.fieldProvenance) ? entry.weightKg : "",
    restingHr: isEligibleForAnalysis("restingHr", entry.fieldProvenance) ? entry.restingHr : "",
    painParts: isEligibleForAnalysis("painParts", entry.fieldProvenance) ? entry.painParts : {},
    mood: isEligibleForAnalysis("mood", entry.fieldProvenance) ? entry.mood : 0,
  }
}

export function toExportJournalEntry(entry: JournalEntry): SafeJournalEntry | null {
  if (!hasExportableStructuredSignal(entry)) return null
  return toSafeJournalEntry(entry)
}

export function toAnalysisJournalEntry(entry: JournalEntry): AnalysisJournalEntry | null {
  if (entry.kind === "race") {
    if (!hasApprovedAnalysisSignal(entry)) return null
    return {
      id: entry.id,
      kind: entry.kind,
      date: entry.date,
      savedAt: entry.savedAt,
      syncState: "local",
      stage: entry.stage,
      record: entry.record,
      rank: entry.rank,
      result: entry.result,
    }
  }
  if (!hasEligibleAnalysisField(entry)) return null
  return entry.kind === "post-session"
    ? toAnalysisPostSessionEntry(entry)
    : toAnalysisEveningEntry(entry)
}

function hasExportableStructuredSignal(entry: JournalEntry): boolean {
  if (entry.kind === "post-session") {
    return entry.title.trim() !== ""
      || entry.distanceKm.trim() !== ""
      || entry.durationMin.trim() !== ""
      || entry.avgPace.trim() !== ""
      || entry.rpe > 0
  }
  if (entry.kind === "evening") {
    return entry.sleepH > 0
      || entry.sleepQuality > 0
      || entry.weightKg.trim() !== ""
      || entry.restingHr.trim() !== ""
      || Object.values(entry.painParts).some((level) => level > 0)
      || entry.mood > 0
  }
  return entry.record.trim() !== ""
    || entry.rank.trim() !== ""
    || entry.result.trim() !== ""
    || entry.tension !== undefined
    || entry.condition !== undefined
    || entry.mood !== undefined
    || entry.goalPace !== undefined
}

function hasApprovedAnalysisSignal(entry: JournalEntry): boolean {
  if (entry.kind !== "race") return hasExportableStructuredSignal(entry)
  return entry.record.trim() !== ""
    || entry.rank.trim() !== ""
    || entry.result.trim() !== ""
}
