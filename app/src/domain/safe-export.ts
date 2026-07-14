import type {
  EveningEntry,
  JournalEntry,
  PostSessionEntry,
  RaceEntry,
} from "./journal-schema"

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

export function toExportJournalEntry(entry: JournalEntry): SafeJournalEntry | null {
  if (!hasExportableStructuredSignal(entry)) return null
  return toSafeJournalEntry(entry)
}

export function toAnalysisJournalEntry(entry: JournalEntry): AnalysisJournalEntry | null {
  if (!hasApprovedAnalysisSignal(entry)) return null
  if (entry.kind === "race") {
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
  return toSafeJournalEntry(entry)
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
