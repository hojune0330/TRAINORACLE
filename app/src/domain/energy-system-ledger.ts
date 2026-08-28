import { isValidIsoDate, isoShift } from "./dates"
import type { StructuredJournalObservation } from "./journal-observation"
import {
  ENERGY_SYSTEM_KEYS,
  plannedIntentToEnergySystem,
} from "./energy-system-taxonomy"
import type { EnergySystemKey } from "./energy-system-taxonomy"

export const ENERGY_SYSTEM_LEDGER_VERSION = "ENERGY_SYSTEM_LEDGER_V1" as const

export type EnergyLedgerPeriod = "RECENT_4_WEEKS" | "RECENT_8_WEEKS" | "RECENT_24_WEEKS" | "YEAR_TO_DATE"

export type EnergyLedgerWindow = {
  readonly period: EnergyLedgerPeriod
  readonly startDate: string
  readonly endDate: string
  readonly precision: "LOCAL_DATE"
}

export type EnergyLedgerRow = {
  readonly key: EnergySystemKey
  readonly journalSessionCount: number
  readonly durationMinutes: number | null
  readonly distanceKm: number | null
  readonly rpeSampleCount: number
  readonly meanRpe: number | null
}

export type EnergySystemLedger = {
  readonly formulaVersion: typeof ENERGY_SYSTEM_LEDGER_VERSION
  readonly window: EnergyLedgerWindow
  readonly rows: readonly EnergyLedgerRow[]
  readonly includedSourceCount: number
  readonly excludedSourceCount: number
  readonly duplicateSourceCount: number
  readonly coverage: "DATA" | "PARTIAL" | "MISSING"
  readonly reasonCodes: readonly (
    | "STRUCTURED_EXPLICIT_SYSTEM"
    | "NO_ELIGIBLE_SYSTEM_SOURCE"
    | "EXCLUDED_SYSTEM_SOURCE_PRESENT"
    | "IDENTICAL_DUPLICATE_SOURCE"
    | "CONFLICTING_SOURCE_ID"
  )[]
}

export type CurrentPlanEnergyRow = {
  readonly key: EnergySystemKey
  readonly plannedSessionCount: number
  readonly completedMarkCount: number
}

export type CurrentPlanEnergySummary = {
  readonly rows: readonly CurrentPlanEnergyRow[]
  readonly plannedSessionCount: number
  readonly completedMarkCount: number
  readonly excludedRestDayCount: number
}

type PlanEnergyProjectionInput = {
  readonly activePlan: {
    readonly sessions: readonly {
      readonly day: number
      readonly slot: "AM" | "PM"
      readonly role: "REST" | "EASY" | "QUALITY"
      readonly plannedEnergyIntent: string
    }[]
  }
  readonly progress: readonly {
    readonly sessionDay: number
    readonly sessionSlot: "AM" | "PM"
    readonly state: "COMPLETED" | "RESTED" | "SKIPPED" | "PAIN_CHECKIN"
  }[]
}

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10
}

function metricIsExplicit(
  observation: StructuredJournalObservation,
  field: "distanceKm" | "durationMin" | "rpe",
): boolean {
  return observation.fieldProvenance[field] === "EXPLICIT"
}

function eligibleSystemObservation(observation: StructuredJournalObservation): boolean {
  return observation.sourceRef.sourceKind === "SESSION_RESULT_RECORD"
    && observation.energySystem !== undefined
    && observation.energySystem !== null
    && observation.fieldProvenance.system === "EXPLICIT"
    && observation.sourceRef.trustState === "ACCEPTED"
}

function sourceSignature(observation: StructuredJournalObservation): string {
  return JSON.stringify({
    loggedOn: observation.loggedOn,
    energySystem: observation.energySystem,
    systemProvenance: observation.fieldProvenance.system,
    distanceKm: observation.distanceKm,
    distanceProvenance: observation.fieldProvenance.distanceKm,
    durationMin: observation.durationMin,
    durationProvenance: observation.fieldProvenance.durationMin,
    rpe: observation.rpe,
    rpeProvenance: observation.fieldProvenance.rpe,
    trustState: observation.sourceRef.trustState,
  })
}

function emptyRows(): Map<EnergySystemKey, {
  count: number
  duration: number
  durationCount: number
  distance: number
  distanceCount: number
  rpe: number
  rpeCount: number
}> {
  return new Map(ENERGY_SYSTEM_KEYS.map((key) => [key, {
    count: 0,
    duration: 0,
    durationCount: 0,
    distance: 0,
    distanceCount: 0,
    rpe: 0,
    rpeCount: 0,
  }]))
}

export function energyLedgerWindow(period: EnergyLedgerPeriod, asOfDate: string): EnergyLedgerWindow {
  if (!isValidIsoDate(asOfDate)) throw new RangeError("asOfDate must be a real local date")
  const startDate = period === "YEAR_TO_DATE"
    ? `${asOfDate.slice(0, 4)}-01-01`
    : isoShift(asOfDate, -({
        RECENT_4_WEEKS: 28,
        RECENT_8_WEEKS: 56,
        RECENT_24_WEEKS: 168,
      } as const)[period] + 1)
  return { period, startDate, endDate: asOfDate, precision: "LOCAL_DATE" }
}

export function buildEnergySystemLedger(
  observations: readonly StructuredJournalObservation[],
  window: EnergyLedgerWindow,
): EnergySystemLedger {
  if (!isValidIsoDate(window.startDate)
    || !isValidIsoDate(window.endDate)
    || window.startDate > window.endDate) {
    throw new RangeError("Energy ledger window must contain real ordered local dates")
  }

  const scopedSessions = observations.filter((observation) => (
    observation.sourceRef.sourceKind === "SESSION_RESULT_RECORD"
    && isValidIsoDate(observation.loggedOn)
    && observation.loggedOn >= window.startDate
    && observation.loggedOn <= window.endDate
  ))
  let excludedSourceCount = scopedSessions.filter((observation) => !eligibleSystemObservation(observation)).length
  let duplicateSourceCount = 0
  let hasIdenticalDuplicate = false
  let hasConflict = false
  const eligibleById = new Map<string, StructuredJournalObservation[]>()

  for (const observation of scopedSessions.filter(eligibleSystemObservation)) {
    const id = `${observation.sourceRef.sourceKind}:${observation.sourceRef.sourceId}`
    const group = eligibleById.get(id)
    if (group === undefined) eligibleById.set(id, [observation])
    else group.push(observation)
  }

  const accepted: StructuredJournalObservation[] = []
  for (const group of eligibleById.values()) {
    const first = group[0]
    if (first === undefined) continue
    const signatures = new Set(group.map(sourceSignature))
    if (signatures.size > 1) {
      hasConflict = true
      duplicateSourceCount += group.length
      excludedSourceCount += 1
      continue
    }
    if (group.length > 1) {
      hasIdenticalDuplicate = true
      duplicateSourceCount += group.length - 1
    }
    accepted.push(first)
  }

  const accumulators = emptyRows()
  for (const observation of accepted) {
    const key = observation.energySystem
    if (key === undefined || key === null) continue
    const row = accumulators.get(key)
    if (row === undefined) continue
    row.count += 1
    if (observation.durationMin !== null && metricIsExplicit(observation, "durationMin")) {
      row.duration += observation.durationMin
      row.durationCount += 1
    }
    if (observation.distanceKm !== null && metricIsExplicit(observation, "distanceKm")) {
      row.distance += observation.distanceKm
      row.distanceCount += 1
    }
    if (observation.rpe !== null && metricIsExplicit(observation, "rpe")) {
      row.rpe += observation.rpe
      row.rpeCount += 1
    }
  }

  const rows = ENERGY_SYSTEM_KEYS.map((key): EnergyLedgerRow => {
    const row = accumulators.get(key)
    if (row === undefined) throw new Error(`Missing energy accumulator for ${key}`)
    return {
      key,
      journalSessionCount: row.count,
      durationMinutes: row.durationCount === 0 ? null : round1(row.duration),
      distanceKm: row.distanceCount === 0 ? null : round1(row.distance),
      rpeSampleCount: row.rpeCount,
      meanRpe: row.rpeCount === 0 ? null : round1(row.rpe / row.rpeCount),
    }
  })
  const reasonCodes: EnergySystemLedger["reasonCodes"][number][] = [
    accepted.length === 0 ? "NO_ELIGIBLE_SYSTEM_SOURCE" : "STRUCTURED_EXPLICIT_SYSTEM",
  ]
  if (excludedSourceCount > 0) reasonCodes.push("EXCLUDED_SYSTEM_SOURCE_PRESENT")
  if (hasIdenticalDuplicate) reasonCodes.push("IDENTICAL_DUPLICATE_SOURCE")
  if (hasConflict) reasonCodes.push("CONFLICTING_SOURCE_ID")

  return {
    formulaVersion: ENERGY_SYSTEM_LEDGER_VERSION,
    window,
    rows,
    includedSourceCount: accepted.length,
    excludedSourceCount,
    duplicateSourceCount,
    coverage: accepted.length === 0
      ? "MISSING"
      : excludedSourceCount > 0 || duplicateSourceCount > 0
        ? "PARTIAL"
        : "DATA",
    reasonCodes,
  }
}

export function summarizeCurrentPlanEnergy(
  state: PlanEnergyProjectionInput | null,
): CurrentPlanEnergySummary | null {
  if (state === null) return null
  const rows = new Map(ENERGY_SYSTEM_KEYS.map((key) => [key, {
    plannedSessionCount: 0,
    completedMarkCount: 0,
  }]))
  const progress = new Map(state.progress.map((item) => [
    `${item.sessionDay}:${item.sessionSlot}`,
    item.state,
  ]))
  let excludedRestDayCount = 0

  for (const session of state.activePlan.sessions) {
    if (session.role === "REST") {
      excludedRestDayCount += 1
      continue
    }
    const key = plannedIntentToEnergySystem(session.plannedEnergyIntent)
    if (key === null) continue
    const row = rows.get(key)
    if (row === undefined) continue
    row.plannedSessionCount += 1
    if (progress.get(`${session.day}:${session.slot}`) === "COMPLETED") {
      row.completedMarkCount += 1
    }
  }

  const projectedRows = ENERGY_SYSTEM_KEYS.map((key): CurrentPlanEnergyRow => ({
    key,
    ...(rows.get(key) ?? { plannedSessionCount: 0, completedMarkCount: 0 }),
  }))
  return {
    rows: projectedRows,
    plannedSessionCount: projectedRows.reduce((sum, row) => sum + row.plannedSessionCount, 0),
    completedMarkCount: projectedRows.reduce((sum, row) => sum + row.completedMarkCount, 0),
    excludedRestDayCount,
  }
}
