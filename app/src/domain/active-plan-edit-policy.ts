import { z } from "zod"
import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { isoShift, isValidIsoDate } from "./dates"
import { planSessionSchema, type VersionedStoredPlanSession as Session } from "./plan-session-schema"

export const ACTIVE_PLAN_EDIT_POLICY = "manual-active-plan-edit-v1" as const
const addressSchema = z.object({ day: z.number().int().positive(), slot: z.enum(["AM", "PM"]) }).strict()
const fingerprintSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const journalGuardSchema = z.array(z.object({ documentId: z.uuid(), revision: z.number().int().positive().safe() }).strict()).max(5000).nullable()

export const activePlanEditReceiptSchema = z.object({
  version: z.literal(1),
  policy: z.literal(ACTIVE_PLAN_EDIT_POLICY),
  trigger: z.literal("EXPLICIT_PLAN_EDIT"),
  action: z.enum(["DURATION", "SWAP", "CATALOG"]),
  source: addressSchema,
  target: addressSchema.nullable(),
  baseStateFingerprint: fingerprintSchema,
  baseCandidateId: z.string().min(1),
  baseSessions: z.array(planSessionSchema).min(1).max(38),
  protectedSlots: z.array(addressSchema).max(38),
  startDate: z.string().refine(isValidIsoDate),
  projectionLengthDays: z.union([z.literal(7), z.literal(9), z.literal(10)]),
  today: z.string().refine(isValidIsoDate),
  timeZone: z.string().min(1),
  unstartedConfirmed: z.literal(true),
  evidenceFingerprint: fingerprintSchema,
  journalGuard: journalGuardSchema,
  noFixedFutureCommitments: z.boolean(),
  maximumMinutes: z.number().positive().nullable(),
  replacement: planSessionSchema.nullable(),
  acceptedRpeMaximum: z.number().min(1).max(10).nullable(),
  acceptedLongerDuration: z.boolean(),
  acceptedAt: z.string().datetime(),
}).strict()
export type ActivePlanEditReceipt = z.infer<typeof activePlanEditReceiptSchema>

const addressKey = (address: { day: number; slot: string }) => `${address.day}:${address.slot}`
const equal = (a: unknown, b: unknown) => canonicalJsonFingerprint("trainoracle.manual-active-plan-edit.equality.v1", a)
  === canonicalJsonFingerprint("trainoracle.manual-active-plan-edit.equality.v1", b)
const linearPosition = (session: Session) => (session.day - 1) * 2 + (session.slot === "AM" ? 0 : 1)

export function activePlanEditFingerprint(value: unknown): string {
  return canonicalJsonFingerprint("trainoracle.manual-active-plan-edit.v1", value)
}

export function activePlanEditDurationConsentRequired(source: Session, replacement: Session): boolean {
  if (source.prescription.kind !== "RPE_TIME_RANGE" || replacement.prescription.kind !== "RPE_TIME_RANGE") return false
  const limit = Math.min(source.prescription.durationMinutes.maximum,
    source.prescription.catalogWorkout?.originalEnvelope.durationMinutes.maximum ?? source.prescription.durationMinutes.maximum)
  return replacement.prescription.durationMinutes.maximum > limit
}

function dateInTimeZone(instant: string, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(instant))
    const part = (type: string) => parts.find(p => p.type === type)?.value
    const year = part("year"), month = part("month"), day = part("day")
    return year && month && day ? `${year}-${month}-${day}` : null
  } catch { return null }
}

/** Replays the exact, user-selected value or whole-slot swap. It never generates a new dose. */
export function replayActivePlanEdit(receipt: ActivePlanEditReceipt): readonly Session[] | null {
  const parsed = activePlanEditReceiptSchema.safeParse(receipt)
  if (!parsed.success) return null
  const r = parsed.data
  if (dateInTimeZone(r.acceptedAt, r.timeZone) !== r.today) return null
  const sessions = r.baseSessions
  if (new Set(sessions.map(addressKey)).size !== sessions.length) return null
  const source = sessions.find(s => addressKey(s) === addressKey(r.source))
  if (!source || source.role === "REST" || source.prescription.kind !== "RPE_TIME_RANGE") return null
  const sourceDate = isoShift(r.startDate, source.day - 1)
  const protectedKeys = new Set(r.protectedSlots.map(addressKey))
  if (source.day > r.projectionLengthDays || sourceDate < r.today || protectedKeys.has(addressKey(r.source))) return null

  let changed: readonly Session[]
  if (r.action === "DURATION") {
    const maximum = r.maximumMinutes
    if (r.target !== null || maximum === null || r.replacement !== null || r.acceptedRpeMaximum !== null
      || r.acceptedLongerDuration || source.prescription.catalogWorkout || !Number.isFinite(maximum)) return null
    const range = source.prescription.durationMinutes
    if (maximum < range.minimum || maximum >= range.maximum) return null
    changed = sessions.map(s => s === source ? { ...source, prescription: {
      ...source.prescription, durationMinutes: { minimum: range.minimum, maximum },
    } } as Session : s)
  } else if (r.action === "SWAP") {
    if (!r.noFixedFutureCommitments || r.target === null || r.maximumMinutes !== null || r.replacement !== null
      || r.acceptedRpeMaximum !== null || r.acceptedLongerDuration
      || r.target.slot !== r.source.slot || addressKey(r.target) === addressKey(r.source)
      || r.target.day > r.projectionLengthDays || protectedKeys.has(addressKey(r.target))) return null
    const target = sessions.find(s => addressKey(s) === addressKey(r.target!))
    if (!target || target.day === source.day || (target.role !== "REST" && target.role !== "EASY")
      || isoShift(r.startDate, target.day - 1) < r.today) return null
    if (target.role === "REST" && !sessions.some(s => s.day === target.day && s.role !== "REST")) return null
    changed = sessions.map(s => s === source
      ? { ...target, day: source.day, slot: source.slot } as Session
      : s === target ? { ...source, day: target.day, slot: target.slot } as Session : s)
    const byDay = new Map<number, Session[]>()
    for (const session of changed) byDay.set(session.day, [...(byDay.get(session.day) ?? []), session])
    for (const daySessions of byDay.values()) {
      if (daySessions.length > 2 || daySessions.filter(s => s.role === "QUALITY").length > 1) return null
      if (daySessions.some(s => s.role === "QUALITY") && daySessions.some(s => s.role === "EASY"
        && (s.prescription.kind !== "RPE_TIME_RANGE" || s.prescription.rpe.minimum < 1 || s.prescription.rpe.maximum > 3))) return null
    }
    const oldMain = sessions.filter(s => s.role === "QUALITY").map(linearPosition).sort((a, b) => a - b)
    const nextMain = changed.filter(s => s.role === "QUALITY").map(linearPosition).sort((a, b) => a - b)
    const oldGaps = oldMain.slice(1).map((p, i) => p - oldMain[i]!)
    if (oldMain.length !== nextMain.length || (oldGaps.length
      && nextMain.slice(1).some((p, i) => p - nextMain[i]! < Math.min(...oldGaps)))) return null
  } else {
    const replacement = r.replacement
    if (r.target !== null || r.maximumMinutes !== null || !replacement
      || addressKey(replacement) !== addressKey(r.source) || replacement.role !== source.role
      || replacement.plannedEnergyIntent !== source.plannedEnergyIntent || replacement.prescription.kind !== "RPE_TIME_RANGE"
      || !replacement.prescription.catalogWorkout) return null
    const binding = replacement.prescription.catalogWorkout
    const rebound = bindCatalogSession(source as never, binding.catalogId, binding.inputs, r.acceptedLongerDuration)
    if (!rebound || !equal(rebound, replacement)) return null
    const oldMaximum = source.prescription.rpe.maximum
    const nextMaximum = replacement.prescription.rpe.maximum
    if ((nextMaximum > oldMaximum && r.acceptedRpeMaximum !== nextMaximum)
      || (nextMaximum <= oldMaximum && r.acceptedRpeMaximum !== null)) return null
    const longer = activePlanEditDurationConsentRequired(source, replacement)
    if (longer !== r.acceptedLongerDuration) return null
    changed = sessions.map(s => s === source ? replacement : s)
  }
  if (changed.some(s => !planSessionSchema.safeParse(s).success)) return null
  return changed
}

export function activePlanEditMatches(receipt: ActivePlanEditReceipt, sessions: readonly Session[], startDate: string | undefined): boolean {
  const replayed = replayActivePlanEdit(receipt)
  return replayed !== null && receipt.startDate === startDate && equal(replayed, sessions)
}
