import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout, catalogMethodIdentity } from "./all-workout-calculator"
import type { CalculatedWorkout, WorkoutCalculationInputs } from "./all-workout-calculator"
import type { PlanSession, RpeTimeRange } from "../plan-generator/session-types"
import type { ExperienceBand, PlannedEnergyIntent } from "../plan-generator/types"

export type CatalogSessionBinding = {
  readonly version: 1
  readonly catalogId: string
  readonly catalogFingerprint: string
  readonly calculationFingerprint: string
  readonly inputs: WorkoutCalculationInputs
  readonly originalEnvelope: { readonly rpe: RpeTimeRange["rpe"]; readonly durationMinutes: RpeTimeRange["durationMinutes"] }
  readonly acceptedDurationSeconds?: number
}
const family: Record<PlannedEnergyIntent, string> = { BASE_INTENT: "BASE", RECOVERY_INTENT: "REC", LT_INTENT: "LT",
  VO2_INTENT: "VO2", GLY_INTENT: "GLY", ATP_PC_INTENT: "ATP-PC", MIXED_INTENT: "MIX" }
export function catalogFamilyForIntent(intent: PlannedEnergyIntent): string { return family[intent] }
export function resolveCatalogBinding(binding: CatalogSessionBinding): CalculatedWorkout | null {
  try {
    if (Object.keys(binding).sort().join() !== ["calculationFingerprint", "catalogFingerprint", "catalogId", "inputs", "originalEnvelope", "version",
      ...(binding.acceptedDurationSeconds === undefined ? [] : ["acceptedDurationSeconds"])].sort().join() || binding.version !== 1) return null
    const range = (v: unknown, max: number) => {
      const r = v as { minimum: number; maximum: number }
      return r && Object.keys(r).sort().join() === "maximum,minimum" && Number.isFinite(r.minimum) && Number.isFinite(r.maximum)
        && r.minimum > 0 && r.maximum >= r.minimum && r.maximum <= max
    }
    if (Object.keys(binding.originalEnvelope).sort().join() !== "durationMinutes,rpe"
      || !range(binding.originalEnvelope.rpe, 10) || !range(binding.originalEnvelope.durationMinutes, 1440)) return null
    const result = calculateCatalogWorkout(binding.catalogId, binding.inputs)
    if (!result || result.unavailable.length || result.catalogFingerprint !== binding.catalogFingerprint
      || result.fingerprint !== binding.calculationFingerprint || result.totals.seconds === null
      || binding.inputs.availableSeconds !== (binding.acceptedDurationSeconds ?? binding.originalEnvelope.durationMinutes.maximum * 60)) return null
    if (binding.acceptedDurationSeconds !== undefined && (binding.acceptedDurationSeconds !== result.totals.seconds.maximum
      || binding.acceptedDurationSeconds <= binding.originalEnvelope.durationMinutes.maximum * 60)) return null
    return result
  } catch { return null }
}
export function catalogRpe(workout: CalculatedWorkout): { minimum: number; maximum: number } {
  const ranges = workout.steps.filter(s => s.phase === "main" && s.kind === "WORK").map(s => {
    const match = s.instruction.match(/RPE\s*(\d+)(?:[~\-](\d+))?/)
    return match ? [Number(match[1]), Number(match[2] ?? match[1])] : ["ATP-PC", "ATP_PC"].includes(s.intent) ? [8, 9]
      : s.intent === "LT" ? [6, 7] : s.intent === "VO2" ? [7, 8] : s.intent === "GLY" ? [8, 9]
        : s.intent === "STEADY" ? [5, 5] : s.intent === "REC" ? [1, 2] : s.intent === "BASE" ? [3, 4] : [6, 7]
  })
  return { minimum: Math.min(...ranges.map(r => r[0]!)), maximum: Math.max(...ranges.map(r => r[1]!)) }
}
export function isValidCatalogSession(session: PlanSession): boolean {
  if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) return true
  const binding = session.prescription.catalogWorkout
  const result = resolveCatalogBinding(binding)
  if (!result?.totals.seconds) return false
  const entry = ALL_WORKOUT_CATALOG.find(e => e.id === result.catalogId)!
  const rpe = catalogRpe(result)
  const ceiling = { NEW_TO_RUNNING: { QUALITY: 30, EASY: 35 }, DEVELOPING: { QUALITY: 40, EASY: 45 }, EXPERIENCED: { QUALITY: 50, EASY: 60 } }[binding.inputs.experience]
  return entry.family === family[session.plannedEnergyIntent]
    && session.role !== "REST" && binding.originalEnvelope.durationMinutes.maximum <= ceiling[session.role]
    && (session.role !== "EASY" || rpe.maximum <= binding.originalEnvelope.rpe.maximum)
    && (session.role === "EASY" ? ["BASE", "REC"].includes(entry.family) : !["BASE", "REC", "OFF"].includes(entry.family))
    && session.prescription.durationMinutes.minimum === result.totals.seconds.minimum / 60
    && session.prescription.durationMinutes.maximum === result.totals.seconds.maximum / 60
    && session.prescription.rpe.minimum === rpe.minimum && session.prescription.rpe.maximum === rpe.maximum
}
export function bindCatalogSession(session: PlanSession, id: string, inputs: WorkoutCalculationInputs, acceptLongerDuration = false): PlanSession | null {
  if (session.role === "REST" || session.prescription.kind !== "RPE_TIME_RANGE") return null
  const originalEnvelope = session.prescription.catalogWorkout?.originalEnvelope
    ?? { rpe: session.prescription.rpe, durationMinutes: session.prescription.durationMinutes }
  const preview = acceptLongerDuration ? calculateCatalogWorkout(id, { ...inputs, availableSeconds: null }) : null
  const acceptedDurationSeconds = preview?.totals.seconds && preview.totals.seconds.maximum > originalEnvelope.durationMinutes.maximum * 60
    ? preview.totals.seconds.maximum : undefined
  const result = calculateCatalogWorkout(id, { ...inputs, availableSeconds: acceptedDurationSeconds ?? originalEnvelope.durationMinutes.maximum * 60 })
  if (!result || result.unavailable.length || !result.totals.seconds || result.totals.seconds.minimum <= 0) return null
  const bound: PlanSession = { ...session, prescription: { kind: "RPE_TIME_RANGE", rpe: catalogRpe(result),
    durationMinutes: { minimum: result.totals.seconds.minimum / 60, maximum: result.totals.seconds.maximum / 60 },
    catalogWorkout: { version: 1, catalogId: id, catalogFingerprint: result.catalogFingerprint,
      calculationFingerprint: result.fingerprint, inputs: result.inputs, originalEnvelope,
      ...(acceptedDurationSeconds === undefined ? {} : { acceptedDurationSeconds }) } } }
  return isValidCatalogSession(bound) ? bound : null
}

/** Only new plans. Existing saved plans are never upgraded or rewritten on read. */
export function bindDefaultCatalogSessions(sessions: readonly PlanSession[], eventDistanceM: number, experience: ExperienceBand,
  seed: number): readonly PlanSession[] {
  return sessions.map(session => {
    if (session.prescription.kind !== "RPE_TIME_RANGE") return session
    const originalRpeMaximum = session.prescription.rpe.maximum
    const originalDurationMaximum = session.prescription.durationMinutes.maximum
    const input: WorkoutCalculationInputs = { eventDistanceM, experience, availableSeconds: session.prescription.durationMinutes.maximum * 60,
      confirmedRequirements: [], fiveK: null, segmentPaces: [] }
    const methods = new Map<string, PlanSession>()
    const options = ALL_WORKOUT_CATALOG.filter(e => e.family === family[session.plannedEnergyIntent])
      .flatMap(e => {
        const bound = bindCatalogSession(session, e.id, input, session.role === "QUALITY"), identity = catalogMethodIdentity(e)
        if (!bound || bound.prescription.kind !== "RPE_TIME_RANGE"
          || session.role !== "QUALITY" && bound.prescription.rpe.maximum > originalRpeMaximum) return []
        const existing = methods.get(identity)
        if (existing?.prescription.kind === "RPE_TIME_RANGE"
          && existing.prescription.durationMinutes.maximum <= bound.prescription.durationMinutes.maximum) return []
        methods.set(identity, bound)
        return [bound]
      })
    // Same-day companion recovery remains short; no extra session or MAIN slot is added.
    if (!options.length) return session
    if (session.role === "EASY") return [...options].sort((a, b) =>
      (b.prescription as RpeTimeRange).durationMinutes.maximum - (a.prescription as RpeTimeRange).durationMinutes.maximum)[0]!
    const reviewed = [...methods.values()]
    const withinEnvelope = reviewed.filter(option => option.prescription.kind === "RPE_TIME_RANGE"
      && option.prescription.durationMinutes.maximum <= originalDurationMaximum)
    // A new draft shows the exact reviewed total; the athlete still chooses whether to start it.
    const shortest = Math.min(...reviewed.map(option => (option.prescription as RpeTimeRange).durationMinutes.maximum))
    const eligible = withinEnvelope.length ? withinEnvelope : reviewed.filter(option =>
      (option.prescription as RpeTimeRange).durationMinutes.maximum === shortest)
    return eligible[(seed + session.day + (session.slot === "PM" ? 1 : 0)) % eligible.length]!
  })
}
