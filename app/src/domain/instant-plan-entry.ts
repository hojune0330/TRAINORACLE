import { z } from "zod"
import { canonicalPaceDistance } from "@impl/prescription/record-pace"
import { achievedDateError, createSelfReportedAthleteRecord, loadAthleteRecords, saveAthleteRecord } from "./athlete-records"
import type { InstantPlanEntry } from "./instant-plan-contract"

const eventDistance = z.union([z.literal(800), z.literal(1500), z.literal(3000), z.literal(5000),
  z.literal(10000), z.literal(21097), z.literal(42195)])
const performance = z.number().finite().positive()
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CURRENT_RECORD"), eventDistanceM: eventDistance,
    performanceSeconds: performance, achievedOn: z.string().nullable() }).strict(),
  z.object({ kind: z.literal("GOAL_ONLY"), eventDistanceM: eventDistance, performanceSeconds: performance }).strict(),
  z.object({ kind: z.literal("NO_RECORD"), eventDistanceM: eventDistance }).strict(),
])

export function readInstantPlanEntry(value: unknown, now = new Date()): InstantPlanEntry | null {
  const parsed = schema.safeParse(value)
  if (!parsed.success || !Number.isFinite(now.getTime())) return null
  if (parsed.data.kind === "CURRENT_RECORD" && parsed.data.achievedOn !== null
    && achievedDateError(parsed.data.achievedOn, now) !== null) return null
  return parsed.data
}

/** Save the stated record kind; a saved goal is not automatically selected as a pace anchor. */
export function prepareInstantPlanEntry(value: unknown, now = new Date()):
  | { kind: "ready"; entry: InstantPlanEntry; recordId: string | null }
  | { kind: "invalid" | "storage_failed" } {
  const entry = readInstantPlanEntry(value, now)
  if (!entry) return { kind: "invalid" }
  if (entry.kind === "NO_RECORD") return { kind: "ready", entry, recordId: null }
  try {
  const existing = loadAthleteRecords(now).find(record => canonicalPaceDistance(record.eventDistanceM) === canonicalPaceDistance(entry.eventDistanceM)
    && record.performanceSeconds === entry.performanceSeconds
    && (entry.kind === "CURRENT_RECORD" ? record.purpose !== "RACE_GOAL" && record.achievedOn === entry.achievedOn : record.purpose === "RACE_GOAL"))
  if (existing) return { kind: "ready", entry, recordId: entry.kind === "CURRENT_RECORD" ? existing.id : null }
  const record = createSelfReportedAthleteRecord({ id: `instant-${crypto.randomUUID()}`,
    purpose: entry.kind === "CURRENT_RECORD" ? "RECENT_RESULT" : "RACE_GOAL", eventDistanceM: canonicalPaceDistance(entry.eventDistanceM),
    performanceSeconds: entry.performanceSeconds, achievedOn: entry.kind === "CURRENT_RECORD" ? entry.achievedOn : null, seasonId: null }, now)
  if (!record || !saveAthleteRecord(record, now).ok) return { kind: "storage_failed" }
  return { kind: "ready", entry, recordId: entry.kind === "CURRENT_RECORD" ? record.id : null }
  } catch { return { kind: "storage_failed" } }
}
