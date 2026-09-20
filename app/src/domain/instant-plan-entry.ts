import { z } from "zod"
import { achievedDateError, createSelfReportedAthleteRecord, loadAthleteRecords, saveAthleteRecord } from "./athlete-records"
import type { InstantPlanEntry } from "./instant-plan-contract"

const eventDistance = z.union([z.literal(800), z.literal(1500), z.literal(3000), z.literal(5000),
  z.literal(10000), z.literal(21097), z.literal(42195)])
const performance = z.number().finite().positive()
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CURRENT_RECORD"), eventDistanceM: eventDistance,
    performanceSeconds: performance, achievedOn: z.string() }).strict(),
  z.object({ kind: z.literal("GOAL_ONLY"), eventDistanceM: eventDistance, performanceSeconds: performance }).strict(),
  z.object({ kind: z.literal("NO_RECORD"), eventDistanceM: eventDistance }).strict(),
])

export function readInstantPlanEntry(value: unknown, now = new Date()): InstantPlanEntry | null {
  const parsed = schema.safeParse(value)
  if (!parsed.success || !Number.isFinite(now.getTime())) return null
  if (parsed.data.kind === "CURRENT_RECORD" && achievedDateError(parsed.data.achievedOn, now) !== null) return null
  return parsed.data
}

/** Existing account-scoped record store only; goals never become a pace anchor. */
export function prepareInstantPlanEntry(value: unknown, now = new Date()):
  | { kind: "ready"; entry: InstantPlanEntry; recordId: string | null }
  | { kind: "invalid" | "storage_failed" } {
  const entry = readInstantPlanEntry(value, now)
  if (!entry) return { kind: "invalid" }
  if (entry.kind !== "CURRENT_RECORD") return { kind: "ready", entry, recordId: null }
  try {
  const existing = loadAthleteRecords(now).find(record => record.purpose !== "RACE_GOAL"
    && record.eventDistanceM === entry.eventDistanceM && record.performanceSeconds === entry.performanceSeconds
    && record.achievedOn === entry.achievedOn)
  if (existing) return { kind: "ready", entry, recordId: existing.id }
  const record = createSelfReportedAthleteRecord({ id: `instant-${crypto.randomUUID()}`,
    purpose: "RECENT_RESULT", eventDistanceM: entry.eventDistanceM,
    performanceSeconds: entry.performanceSeconds, achievedOn: entry.achievedOn, seasonId: null }, now)
  if (!record || !saveAthleteRecord(record, now).ok) return { kind: "storage_failed" }
  return { kind: "ready", entry, recordId: record.id }
  } catch { return { kind: "storage_failed" } }
}
