import type {
  ExperienceBand,
  LocalCivilNinePointFiveFormation,
} from "@impl/plan-generator/types"
import { isoShift } from "./dates"

export function createPlanFormation(
  startDate: string,
  availableDays: readonly number[],
  experienceBand: ExperienceBand,
): LocalCivilNinePointFiveFormation {
  const localDays = Array.from(
    { length: 10 },
    (_, index) => isoShift(startDate, index),
  )
  const slots = localDays.flatMap((localDayKey, dayIndex) => (
    dayIndex === 9
      ? [{ slotIndex: 18, localDayKey, slot: "AM" as const }]
      : [
          { slotIndex: dayIndex * 2, localDayKey, slot: "AM" as const },
          { slotIndex: dayIndex * 2 + 1, localDayKey, slot: "PM" as const },
        ]
  ))
  const mainDays = selectMainDays(availableDays, experienceBand)

  return Object.freeze({
    kind: "LOCAL_CIVIL_9_5",
    slots: Object.freeze(slots),
    exposures: Object.freeze(mainDays.map((day) => Object.freeze({
      exposureId: `app-main-day-${day}`,
      classification: "TRAINING_MAIN" as const,
      localDayKey: localDays[day - 1] ?? startDate,
      component: Object.freeze({ kind: "STANDALONE" as const }),
    }))),
  })
}

function selectMainDays(
  availableDays: readonly number[],
  experienceBand: ExperienceBand,
): readonly number[] {
  const days = [...new Set(availableDays)].sort((left, right) => left - right)
  const first = days[0]
  const last = days.at(-1)
  if (first === undefined || last === undefined) return Object.freeze([])

  const useThree = experienceBand === "EXPERIENCED" && days.length >= 5
  if (!useThree) return Object.freeze(first === last ? [first] : [first, last])

  const midpoint = (first + last) / 2
  const middle = days
    .slice(1, -1)
    .sort((left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint))[0]
  return Object.freeze(middle === undefined ? [first, last] : [first, middle, last])
}
