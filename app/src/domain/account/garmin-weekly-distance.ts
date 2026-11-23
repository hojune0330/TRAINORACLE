import { z } from "zod"
import { isValidIsoDate, isoShift, weekStartOf } from "../dates"

const count = z.number().int().nonnegative().max(128)
const entryId = z.string().regex(/^garmin-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u)
const group = z.object({
  sport: z.enum(["RUNNING", "WALKING", "CYCLING", "OTHER"]),
  distanceMeters: z.number().finite().nonnegative(), includedCount: count.positive(),
}).strict()
const period = z.object({
  startDate: z.iso.date(), endDate: z.iso.date(), groups: z.array(group).max(4),
  includedEntryIds: z.array(entryId).max(128), excludedCount: count,
}).strict().refine(value => new Set(value.groups.map(row => row.sport)).size === value.groups.length
  && value.groups.reduce((total, row) => total + row.includedCount, 0) === value.includedEntryIds.length)

export const garminWeeklyDistanceSchema = z.object({ current: period, previous: period }).strict()
export type GarminWeeklyDistance = z.infer<typeof garminWeeklyDistanceSchema>

export function matchesGarminWeeks(value: GarminWeeklyDistance, today: string): boolean {
  if (!isValidIsoDate(today)) return false
  const monday = weekStartOf(today)
  const ids = [...value.current.includedEntryIds, ...value.previous.includedEntryIds]
  return value.current.startDate === monday && value.current.endDate === today
    && value.previous.startDate === isoShift(monday, -7) && value.previous.endDate === isoShift(today, -7)
    && new Set(ids).size === ids.length && ids.length + value.current.excludedCount + value.previous.excludedCount <= 128
}
