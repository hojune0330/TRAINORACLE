import { isoShift, weekStartOf } from "./dates"
import type { StructuredJournalObservation } from "./journal-observation"
import { eligibleMetricValue } from "./trend-analysis"

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
    const eligible = observations.flatMap((observation) => {
      if (observation.loggedOn < start || observation.loggedOn > end) return []
      const value = eligibleMetricValue(observation, "DISTANCE_KM")
      return value === null ? [] : [{ observation, value }]
    })
    if (eligible.length === 0) return { kind: "MISSING", start, end, sourceRefs: [] }
    return {
      kind: "DATA",
      start,
      end,
      totalKm: Math.round(eligible.reduce((sum, item) => sum + item.value, 0) * 10) / 10,
      n: eligible.length,
      sourceRefs: eligible.map((item) => item.observation.sourceRef),
    }
  })
}
