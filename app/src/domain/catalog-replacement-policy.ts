import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import { planSessionSchema, type VersionedStoredPlanSession as Session } from "./plan-session-schema"
import { isoShift, isValidIsoDate } from "./dates"

const address = z.object({ day: z.number().int().positive(), slot: z.enum(["AM", "PM"]) }).strict()
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
export function catalogReplacementLocalDate(now: Date, timeZone: string): string | null {
  try {
    if (!Number.isFinite(now.getTime())) return null
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
    const part = (type: string) => parts.find(value => value.type === type)?.value
    return `${part("year")}-${part("month")}-${part("day")}`
  } catch { return null }
}
export const catalogReplacementReceiptSchema = z.object({
  version: z.literal(1), policy: z.literal("manual-catalog-replacement-v1"), trigger: z.literal("EXPLICIT_CATALOG_SELECTION"),
  source: address, replacement: planSessionSchema,
  baseStateFingerprint: hash, baseCandidateId: z.string().min(1), baseSessions: z.array(planSessionSchema).min(1).max(38),
  protectedSlots: z.array(address).max(38), startDate: z.string().refine(isValidIsoDate), today: z.string().refine(isValidIsoDate),
  timeZone: z.string().min(1).max(100).refine(value => catalogReplacementLocalDate(new Date(0), value) !== null),
  evidenceFingerprint: hash,
  journalGuard: z.array(z.object({ documentId: z.uuid(), revision: z.number().int().positive().safe() }).strict()).max(5000).nullable(),
  acceptedRpeMaximum: z.number().int().min(1).max(10).nullable(), acceptedLongerDuration: z.boolean(),
  acceptedAt: z.string().datetime(),
}).strict()
export type CatalogReplacementReceipt = z.infer<typeof catalogReplacementReceiptSchema>
const key = (s: { day: number; slot: string }) => `${s.day}:${s.slot}`
const equal = (a: unknown, b: unknown) => canonicalJsonFingerprint("catalog-replacement-equality", a) === canonicalJsonFingerprint("catalog-replacement-equality", b)

export function replayCatalogReplacement(receipt: CatalogReplacementReceipt): readonly Session[] | null {
  const parsed = catalogReplacementReceiptSchema.safeParse(receipt)
  if (!parsed.success) return null
  const r = parsed.data, old = r.baseSessions.find(s => key(s) === key(r.source)), next = r.replacement
  if (!old || old.role === "REST" || old.prescription.kind !== "RPE_TIME_RANGE"
    || next.prescription.kind !== "RPE_TIME_RANGE" || !next.prescription.catalogWorkout
    || new Set(r.baseSessions.map(key)).size !== r.baseSessions.length
    || isoShift(r.startDate, old.day - 1) <= r.today || r.protectedSlots.some(s => key(s) === key(old))) return null
  const stronger = next.prescription.rpe.maximum > old.prescription.rpe.maximum
  const longer = next.prescription.durationMinutes.maximum > old.prescription.durationMinutes.maximum
  if (r.acceptedRpeMaximum !== (stronger ? next.prescription.rpe.maximum : null)
    || r.acceptedLongerDuration !== longer) return null
  const binding = next.prescription.catalogWorkout
  const rebuilt = bindCatalogSession(old, binding.catalogId, binding.inputs, binding.acceptedDurationSeconds !== undefined)
  if (!rebuilt || !equal(rebuilt, next) || equal(old, next)) return null
  const sessions = r.baseSessions.map(s => key(s) === key(old) ? next : s)
  // Do not open a new second-quality or high-intensity companion path.
  for (const day of new Set(sessions.map(s => s.day))) {
    const daySessions = sessions.filter(s => s.day === day)
    if (daySessions.filter(s => s.role === "QUALITY").length > 1
      || daySessions.some(s => s.role === "QUALITY") && daySessions.some(s => s.role === "EASY"
        && s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.rpe.maximum > 3)) return null
  }
  return sessions
}

export function catalogReplacementMatches(receipt: CatalogReplacementReceipt, sessions: readonly Session[], startDate: string | undefined) {
  const replayed = replayCatalogReplacement(receipt)
  return replayed !== null && receipt.startDate === startDate && equal(replayed, sessions)
}
