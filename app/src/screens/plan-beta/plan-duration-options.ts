import type { PlanSession } from "@impl/plan-generator/types"
import {
  ALL_WORKOUT_CATALOG,
  catalogMethodIdentity,
} from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { formatTotalMinutes, sessionLabel, sessionSlotLabel } from "./labels"

export type EasyDurationRow = {
  readonly key: string
  readonly title: string
  readonly minutesLabel: string
  readonly sessionCount: number
  readonly daysLabel: string
}

type DurationSummary = {
  readonly methodKey: string
  readonly minimumMinutes: number | null
  readonly maximumMinutes: number | null
  readonly minutesLabel: string
}

type MutableRow = {
  readonly key: string
  readonly title: string
  readonly minutesLabel: string
  sessionCount: number
  readonly sessions: PlanSession[]
}

function rangeLabel(minimumMinutes: number, maximumMinutes: number): string {
  const minimum = formatTotalMinutes(minimumMinutes)
  const maximum = formatTotalMinutes(maximumMinutes)
  return minimumMinutes === maximumMinutes ? minimum : `${minimum}~${maximum}`
}

function durationSummary(session: Extract<PlanSession, { role: "EASY" }>): DurationSummary {
  const prescription = session.prescription
  const binding = prescription.catalogWorkout
  if (!binding) {
    const { minimum, maximum } = prescription.durationMinutes
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum <= 0 || maximum < minimum) {
      return {
        methodKey: "RPE_TIME_RANGE:INVALID_DURATION",
        minimumMinutes: null,
        maximumMinutes: null,
        minutesLabel: "일부 시간 미정",
      }
    }
    return {
      methodKey: "RPE_TIME_RANGE",
      minimumMinutes: minimum,
      maximumMinutes: maximum,
      minutesLabel: rangeLabel(minimum, maximum),
    }
  }

  const catalogEntry = ALL_WORKOUT_CATALOG.find(entry => (
    entry.id === binding.catalogId && entry.fingerprint === binding.catalogFingerprint
  ))
  const calculation = resolveCatalogBinding(binding)
  const seconds = calculation?.totals.seconds
  if (!catalogEntry || !seconds
    || !Number.isFinite(seconds.minimum) || !Number.isFinite(seconds.maximum)
    || seconds.minimum <= 0 || seconds.maximum < seconds.minimum) {
    return {
      methodKey: `CATALOG_UNAVAILABLE:${binding.catalogId}:${binding.catalogFingerprint}`,
      minimumMinutes: null,
      maximumMinutes: null,
      minutesLabel: "일부 시간 미정",
    }
  }

  const minimumMinutes = seconds.minimum / 60
  const maximumMinutes = seconds.maximum / 60
  return {
    methodKey: `CATALOG:${catalogMethodIdentity(catalogEntry)}`,
    minimumMinutes,
    maximumMinutes,
    minutesLabel: rangeLabel(minimumMinutes, maximumMinutes),
  }
}

/** Summarize only the supplied EASY sessions; callers choose the visible date window. */
export function easyDurationRows(sessions: readonly PlanSession[]): readonly EasyDurationRow[] {
  const rows = new Map<string, MutableRow>()

  for (const session of sessions) {
    if (session.role !== "EASY") continue
    const duration = durationSummary(session)
    const prescription = session.prescription
    const key = JSON.stringify([
      duration.methodKey,
      session.plannedEnergyIntent,
      prescription.rpe.minimum,
      prescription.rpe.maximum,
      duration.minimumMinutes,
      duration.maximumMinutes,
    ])
    const existing = rows.get(key)
    if (existing) {
      existing.sessionCount += 1
      existing.sessions.push(session)
      continue
    }
    rows.set(key, {
      key,
      title: sessionLabel(session).split(" · ")[0]!,
      minutesLabel: duration.minutesLabel,
      sessionCount: 1,
      sessions: [session],
    })
  }

  return Object.freeze([...rows.values()].map(row => {
    const placements = [...row.sessions].sort((left, right) => (
      left.day - right.day || left.slot.localeCompare(right.slot)
    ))
    return Object.freeze({
      key: row.key,
      title: row.title,
      minutesLabel: row.minutesLabel,
      sessionCount: row.sessionCount,
      daysLabel: placements.map(session => `${session.day}일차 ${sessionSlotLabel(session.slot)}`).join(" · "),
    })
  }))
}
