import type { LocalCivilNinePointFiveFormation } from "../../src/plan-generator/types"

export function canonicalFormation(
  mainTrainingDays: readonly [number, number] = [3, 7],
): LocalCivilNinePointFiveFormation {
  const localDays = Array.from(
    { length: 10 },
    (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`,
  )
  const slots = localDays.flatMap((localDayKey, day) => day === 9
    ? [{ slotIndex: 18, localDayKey, slot: "AM" as const }]
    : [
        { slotIndex: day * 2, localDayKey, slot: "AM" as const },
        { slotIndex: day * 2 + 1, localDayKey, slot: "PM" as const },
      ])

  return {
    kind: "LOCAL_CIVIL_9_5",
    slots,
    exposures: mainTrainingDays.map((day, index) => ({
      exposureId: `fixture-main-${index + 1}`,
      classification: "TRAINING_MAIN" as const,
      localDayKey: localDays[day - 1] ?? "invalid-local-day",
      component: { kind: "STANDALONE" as const },
    })),
  }
}
