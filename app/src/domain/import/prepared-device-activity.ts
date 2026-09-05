import { z } from "zod"

const nonNegative = z.number().finite().nonnegative().nullable()
const interval = z.object({
  distanceMeters: nonNegative,
  durationSeconds: nonNegative,
  durationMeaning: z.enum(["TIMER", "MOVING", "ELAPSED", "UNKNOWN"]),
})
const activity = z.object({
  provider: z.enum(["COROS", "GARMIN", "HEALTHKIT", "HEALTH_CONNECT"]),
  sourceId: z.string().trim().min(1).max(200),
  sourceVersion: z.string().max(100).nullable(),
  sport: z.enum(["RUNNING", "WALKING", "CYCLING", "OTHER", "UNKNOWN"]),
  startedAt: z.iso.datetime({ offset: true }),
  timeZone: z.string().refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true } catch { return false }
  }),
  distanceMeters: nonNegative,
  durationSeconds: nonNegative,
  durationMeaning: z.enum(["TIMER", "MOVING", "ELAPSED", "UNKNOWN"]),
  laps: z.array(interval).max(1000),
})

export type PreparedDeviceActivity = z.infer<typeof activity> & {
  readonly schemaVersion: "PREPARED_DEVICE_ACTIVITY_V1"
  readonly analysisEligible: false
}

/** Offline contract only. No transport, identity matching, persistence or authorization. */
export function prepareDeviceActivity(candidate: unknown): PreparedDeviceActivity | null {
  const parsed = activity.safeParse(candidate)
  if (!parsed.success) return null
  return { ...parsed.data, schemaVersion: "PREPARED_DEVICE_ACTIVITY_V1", analysisEligible: false }
}
