import { isValidIsoDate, isoShift, weekStartOf } from "./dates"
import type { JournalEntry, PostSessionEntry } from "./journal-schema"
import { projectStructuredJournalObservations, type StructuredJournalProjectionOptions } from "./journal-observation"
import { cumulativeDistance } from "./cumulative-distance"
import { buildFileAnalysisReport, isProjectedFileObservation } from "./import/file-analysis"
import { parseFileObservation } from "./import/file-observation"
import { hasImportedField } from "./field-provenance"
import { parseDistanceKm, parseDurationMin } from "./numeric-input"

type KnownClock = "TIMER" | "MOVING" | "ELAPSED"
export type WeeklyFactRecord = { id: string; date: string; source: "DIRECT" | "IMPORTED" }
export type WeeklyFactGroup = {
  id: string; label: string; records: number
  distanceKm: number | null; distanceSamples: number
  times: { clock: KnownClock; seconds: number; samples: number }[]
}
export type WeeklyFactPeriod = {
  start: string; end: string; records: WeeklyFactRecord[]; groups: WeeklyFactGroup[]
  excludedDistance: number; excludedTime: number; duplicateCopies: number; conflictingIds: number
}
export type ConnectedWeeklyFactsModel = { current: WeeklyFactPeriod; previous: WeeklyFactPeriod }
const sportLabel = { RUNNING: "달리기", WALKING: "걷기", CYCLING: "자전거", OTHER: "그 밖의 운동", UNKNOWN: "종목 미확인" } as const

/** Compare facts from saved journals only. No memo, plan, new provider authority or load formula. */
export function connectedWeeklyFacts(entries: readonly JournalEntry[], today: string,
  options: StructuredJournalProjectionOptions = {}): ConnectedWeeklyFactsModel | null {
  if (!isValidIsoDate(today)) return null
  const start = weekStartOf(today), previousStart = isoShift(start, -7), previousEnd = isoShift(today, -7)
  const grouped = new Map<string, PostSessionEntry[]>()
  for (const entry of entries) {
    if (entry.kind !== "post-session" || !entry.id.trim() || !isValidIsoDate(entry.date)) continue
    const group = grouped.get(entry.id) ?? []; group.push(entry); grouped.set(entry.id, group)
  }
  const accepted: PostSessionEntry[] = [], conflicts: PostSessionEntry[][] = [], duplicates: PostSessionEntry[] = []
  const sourceGroups = new Map<string, PostSessionEntry[]>()
  const signature = (entry: PostSessionEntry) => JSON.stringify([entry.date, entry.activityOutcome,
    entry.distanceKm, entry.durationMin, entry.rpe, entry.system, entry.fieldProvenance,
    entry.fileObservation?.sourceObservationKey, entry.fileObservation?.contentRevisionFingerprint,
    entry.fileObservation?.confirmation])
  for (const group of grouped.values()) {
    // Check all revisions before date/outcome eligibility; never pick a newest winner.
    if (new Set(group.map(signature)).size !== 1) { conflicts.push(group); continue }
    const first = group[0]!, file = parseFileObservation(first.fileObservation)
    const key = file ? "FILE:" + file.sourceObservationKey : "JOURNAL:" + first.id
    const sourceGroup = sourceGroups.get(key) ?? []
    sourceGroup.push(...group); sourceGroups.set(key, sourceGroup)
  }
  for (const group of sourceGroups.values()) {
    // Exact source identity only. Similar dates/distances across providers are never merged.
    if (new Set(group.map(signature)).size !== 1) { conflicts.push(group); continue }
    const ordered = [...group].sort((a, b) => a.id.localeCompare(b.id)), first = ordered[0]!
    if (first.activityOutcome === "RESTED" || first.activityOutcome === "SKIPPED") continue
    const file = parseFileObservation(first.fileObservation)
    if (!["COMPLETED", "PARTIAL", "LIGHT_ACTIVITY"].includes(first.activityOutcome ?? "")
      && parseDistanceKm(first.distanceKm) === null && parseDurationMin(first.durationMin) === null
      && !(Number.isFinite(first.rpe) && first.rpe > 0) && !file) continue
    accepted.push(first); duplicates.push(...ordered.slice(1))
  }
  const inWindow = (entry: Pick<JournalEntry, "date">, from: string, to: string) => entry.date >= from && entry.date <= to
  const period = (from: string, to: string): WeeklyFactPeriod => {
    const scoped = accepted.filter(entry => inWindow(entry, from, to))
    const projected = projectStructuredJournalObservations(scoped, options)
    const adoptedIds = new Set(projected.filter(value => isProjectedFileObservation(value.acceptedFileObservation))
      .map(value => value.sourceRef.sourceId))
    const fileEntries = scoped.filter(entry => adoptedIds.has(entry.id))
    // Per-entry current-account acknowledgement has already been checked by the shared projection.
    const file = buildFileAnalysisReport(fileEntries, { formats: options.formats,
      sourceContext: "ACCOUNT_CONFIRMED", startDate: from, endDate: to })
    const direct = projected.filter(value => !adoptedIds.has(value.sourceRef.sourceId))
    const distance = cumulativeDistance(direct, { kind: "WEEK_TO_DATE", startDate: from, endDate: to, precision: "LOCAL_DATE" })
    const groups: WeeklyFactGroup[] = []
    if (distance.includedSourceCount > 0) groups.push({ id: "DIRECT", label: "직접 입력한 거리 · 종목 미지정",
      records: distance.includedSourceCount, distanceKm: distance.totalKm, distanceSamples: distance.includedSourceCount, times: [] })
    for (const sport of file.sports) groups.push({ id: sport.sport, label: "확인한 파일 · " + sportLabel[sport.sport],
      records: sport.sampleCount, distanceKm: sport.distanceMeters.value === null ? null : sport.distanceMeters.value / 1000,
      distanceSamples: sport.distanceMeters.sampleCount,
      times: sport.timeSummaries.flatMap(time => !time.referenceOnly && time.durationSeconds.value !== null
        && (time.durationMeaning === "TIMER" || time.durationMeaning === "MOVING" || time.durationMeaning === "ELAPSED")
        ? [{ clock: time.durationMeaning, seconds: time.durationSeconds.value, samples: time.durationSeconds.sampleCount }] : []) })
    const distanceSamples = groups.reduce((sum, group) => sum + group.distanceSamples, 0)
    const timeSamples = groups.reduce((sum, group) => sum + group.times.reduce((total, time) => total + time.samples, 0), 0)
    return { start: from, end: to,
      records: scoped.sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).map(entry => ({
        id: entry.id, date: entry.date, source: entry.fileObservation || hasImportedField(entry.fieldProvenance) ? "IMPORTED" : "DIRECT",
      })),
      groups, excludedDistance: Math.max(0, scoped.length - distanceSamples),
      excludedTime: Math.max(0, scoped.length - timeSamples),
      duplicateCopies: duplicates.filter(entry => inWindow(entry, from, to)).length + file.duplicateSourceCount,
      conflictingIds: conflicts.filter(group => group.some(entry => inWindow(entry, from, to))).length + file.conflictingSourceCount }
  }
  return { current: period(start, today), previous: period(previousStart, previousEnd) }
}
