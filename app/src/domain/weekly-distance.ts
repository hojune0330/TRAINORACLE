import { isoShift, weekStartOf } from "./dates"
import type { StructuredJournalObservation } from "./journal-observation"
import { cumulativeDistance } from "./cumulative-distance"

export type WeeklyDistanceBucket =
  | {
      readonly kind: "DATA"
      readonly start: string
      readonly end: string
      readonly totalKm: number
      readonly n: number
      readonly sourceRefs: readonly StructuredJournalObservation["sourceRef"][]
    }
  | {
      readonly kind: "MISSING"
      readonly start: string
      readonly end: string
      readonly sourceRefs: readonly []
    }

export function bucketDistanceByWeek(
  observations: readonly StructuredJournalObservation[],
  todayIso: string,
  weeksBack: number,
): readonly WeeklyDistanceBucket[] {
  if (!Number.isInteger(weeksBack) || weeksBack <= 0) {
    throw new RangeError("weeksBack must be a positive integer")
  }
  const thisMonday = weekStartOf(todayIso)
  return Array.from({ length: weeksBack }, (_, index) => {
    const start = isoShift(thisMonday, -7 * (weeksBack - index - 1))
    const end = isoShift(start, 6)
    const summary = cumulativeDistance(observations, {
      kind: "RECENT_WEEK", startDate: start, endDate: end, precision: "LOCAL_DATE",
    })
    if (summary.totalKm === null) return { kind: "MISSING", start, end, sourceRefs: [] }
    return {
      kind: "DATA",
      start,
      end,
      totalKm: summary.totalKm,
      n: summary.includedSourceCount,
      sourceRefs: summary.sourceRefs,
    }
  })
}
