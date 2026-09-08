import { deriveSequenceV3Totals, type PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"

export type SessionAvailabilityLimitV3 = {
  readonly day: number; readonly slot: "AM" | "PM"; readonly maximumSeconds: number;
}
type Session = { readonly day: number; readonly slot: string; readonly prescription: {
  readonly kind: string; readonly projection?: { readonly sequence: PrescriptionSequenceV3 };
} }

export function exactSessionSecondsV3(session: Session): number | null {
  if (session.prescription.kind === "REST") return 0
  if (session.prescription.kind !== "ADJUSTED_METHOD_V3" || !session.prescription.projection) return null
  const totals = deriveSequenceV3Totals(session.prescription.projection.sequence)
  const phases = [totals.warmup, totals.main, totals.cooldown]
  if (phases.some(phase => phase.totalSeconds === null)) return null
  const seconds = phases.reduce((sum, phase) => sum + phase.totalSeconds!, 0)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
}

/** An estimated duration is never evidence that an explicit personal limit is met. */
export function checkSessionAvailabilityV3(sessions: readonly Session[], value: unknown) {
  const reject = (code: string) => ({ kind: "rejected" as const, code })
  if (value === undefined) return { kind: "checked" as const, limits: undefined }
  if (!Array.isArray(value)) return reject("INVALID_AVAILABILITY_LIMIT")
  const seen = new Set<string>(), limits: SessionAvailabilityLimitV3[] = []
  for (const limit of value) {
    if (!limit || typeof limit !== "object" || Object.keys(limit).sort().join() !== "day,maximumSeconds,slot"
      || !Number.isInteger(limit.day) || limit.day < 1 || !["AM", "PM"].includes(limit.slot)
      || !Number.isFinite(limit.maximumSeconds) || limit.maximumSeconds <= 0) return reject("INVALID_AVAILABILITY_LIMIT")
    const key = `${limit.day}:${limit.slot}`
    if (seen.has(key)) return reject("INVALID_AVAILABILITY_LIMIT")
    seen.add(key)
    const matching = sessions.filter(session => session.day === limit.day && session.slot === limit.slot)
    if (matching.length !== 1) return reject("INVALID_AVAILABILITY_SLOT")
    const seconds = exactSessionSecondsV3(matching[0]!)
    if (seconds === null) return reject("AVAILABILITY_DURATION_UNRESOLVED")
    if (seconds > limit.maximumSeconds) return reject("AVAILABILITY_LIMIT_EXCEEDED")
    limits.push({ day: limit.day, slot: limit.slot, maximumSeconds: limit.maximumSeconds })
  }
  limits.sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
  return { kind: "checked" as const, limits }
}
