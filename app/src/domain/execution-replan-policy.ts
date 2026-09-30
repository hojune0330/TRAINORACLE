import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { planSessionSchema, type VersionedStoredPlanSession as Session } from "./plan-session-schema"
import { isoShift, isValidIsoDate } from "./dates"

export const EXECUTION_REPLAN_POLICY = "execution-remainder-v1" as const
export const replanActionSchema = z.enum(["REDUCE", "REPLACE", "MOVE_LATER"])
export type ReplanAction = z.infer<typeof replanActionSchema>
const address = z.object({ day: z.number().int().positive(), slot: z.enum(["AM", "PM"]) }).strict()
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
export const executionReplanReceiptSchema = z.object({
  version: z.literal(1), policy: z.literal(EXECUTION_REPLAN_POLICY), trigger: z.literal("EXECUTION_REVIEW_CONFIRMED"),
  action: replanActionSchema, source: address, target: address.nullable(),
  baseStateFingerprint: hash, baseCandidateId: z.string().min(1), baseSessions: z.array(planSessionSchema).min(1).max(38),
  protectedSlots: z.array(address).max(38), startDate: z.string().refine(isValidIsoDate), today: z.string().refine(isValidIsoDate),
  sourceJournalId: z.string().min(1).max(100), evidenceFingerprint: hash,
  journalGuard: z.array(z.object({ documentId: z.uuid(), revision: z.number().int().positive().safe() }).strict()).max(5000).nullable(),
  noFixedFutureCommitments: z.boolean(), acceptedAt: z.string().datetime(),
}).strict()
export type ExecutionReplanReceipt = z.infer<typeof executionReplanReceiptSchema>
export const replanKey = (s: { day: number; slot: string }) => `${s.day}:${s.slot}`
const equal = (a: unknown, b: unknown) => canonicalJsonFingerprint("replan-equality", a) === canonicalJsonFingerprint("replan-equality", b)
const position = (s: Session) => (s.day - 1) * 2 + (s.slot === "AM" ? 0 : 1)

/** Replays only exact, owner-adopted transformations. No dose percentage or inferred pace. */
export function replayExecutionReplan(receipt: ExecutionReplanReceipt): readonly Session[] | null {
  const parsed = executionReplanReceiptSchema.safeParse(receipt)
  if (!parsed.success) return null
  const r = parsed.data, sessions = r.baseSessions
  if (new Set(sessions.map(replanKey)).size !== sessions.length) return null
  const protectedKeys = new Set(r.protectedSlots.map(replanKey))
  const eligible = (s: Session) => isoShift(r.startDate, s.day - 1) > r.today && !protectedKeys.has(replanKey(s))
  const source = sessions.find(s => replanKey(s) === replanKey(r.source))
  if (!source || !eligible(source) || source.role === "REST") return null
  let result: readonly Session[]
  if (r.action === "REDUCE") {
    if (r.target !== null || source.prescription.kind !== "RPE_TIME_RANGE") return null
    const p = source.prescription
    // A calculated range can represent reference pace uncertainty, not removable work.
    if (p.catalogWorkout) return null
    if (p.durationMinutes.minimum >= p.durationMinutes.maximum) return null
    result = sessions.map(s => s === source ? { ...s, prescription: { ...p,
      durationMinutes: { minimum: p.durationMinutes.minimum, maximum: p.durationMinutes.minimum } } } as Session : s)
  } else {
    const target = sessions.find(s => r.target && replanKey(s) === replanKey(r.target))
    if (!target || target === source) return null
    if (r.action === "REPLACE") {
      if (source.role !== "QUALITY" || source.prescription.kind !== "RPE_TIME_RANGE"
        || target.role !== "EASY" || target.prescription.kind !== "RPE_TIME_RANGE"
        || target.prescription.durationMinutes.maximum > source.prescription.durationMinutes.minimum
        || target.prescription.rpe.maximum > source.prescription.rpe.minimum) return null
      result = sessions.map(s => s === source ? { ...target, day: source.day, slot: source.slot } : s)
    } else {
      if (!r.noFixedFutureCommitments || !eligible(target) || target.day <= source.day
        || target.slot !== source.slot || target.role !== "EASY") return null
      const companions = (day: number) => sessions.filter(s => s.day === day && s.slot !== source.slot)
        .map(s => ({ role: s.role, plannedEnergyIntent: s.plannedEnergyIntent, prescription: s.prescription }))
      if (!equal(companions(source.day), companions(target.day))) return null
      // Reuse an already available training slot, never populate an unavailable rest day.
      result = sessions.map(s => s === source ? { day: s.day, slot: s.slot, role: "REST" as const,
        plannedEnergyIntent: "RECOVERY_INTENT" as const, prescription: { kind: "REST" as const } }
        : s === target ? { ...source, day: target.day, slot: target.slot } : s)
      const oldMain = sessions.filter(s => s.role === "QUALITY").map(position).sort((a,b) => a-b)
      const newMain = result.filter(s => s.role === "QUALITY").map(position).sort((a,b) => a-b)
      const gaps = oldMain.slice(1).map((p,i) => p-oldMain[i]!)
      if (gaps.length && newMain.slice(1).some((p,i) => p-newMain[i]! < Math.min(...gaps))) return null
      if (source.role === "EASY" && source.prescription.kind === "RPE_TIME_RANGE"
        && sessions.some(s => s.day === target.day && s.role === "QUALITY")
        && source.prescription.rpe.maximum > 3) return null
    }
  }
  if (result.some(s => protectedKeys.has(replanKey(s)) && !equal(s, sessions.find(old => replanKey(old) === replanKey(s))))) return null
  for (const day of new Set(result.map(s => s.day))) {
    const slots = result.filter(s => s.day === day)
    if (slots.filter(s => s.role === "QUALITY").length > 1) return null
    if (slots.some(s => s.role === "QUALITY") && slots.some(s => s.role === "EASY"
      && s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.rpe.maximum > 3)) return null
  }
  return result.every(s => planSessionSchema.safeParse(s).success) ? result : null
}

export function executionReplanMatches(receipt: ExecutionReplanReceipt, sessions: readonly Session[], startDate: string | undefined): boolean {
  const result = replayExecutionReplan(receipt)
  return result !== null && receipt.startDate === startDate && equal(result, sessions)
}
