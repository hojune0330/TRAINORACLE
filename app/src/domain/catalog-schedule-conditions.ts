import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { isValidIsoDate, isoShift } from "./dates"

export const catalogRequirementLabels: Readonly<Record<string, string>> = {
  ACCELERATION_AND_DECELERATION_SPACE: "가속하고 속도를 줄일 충분한 공간이 있어요",
  RECENT_LONG_RUN_BASELINE: "최근에도 이 정도 길이의 장거리 달리기를 해봤어요",
  RECENT_THRESHOLD_VOLUME: "최근에도 이 정도 시간의 템포 훈련을 해봤어요",
  BIKE_AVAILABLE: "자전거를 사용할 수 있어요",
  ELLIPTICAL_AVAILABLE: "일립티컬을 사용할 수 있어요",
  WATER_SAFETY_AND_EQUIPMENT: "수중 운동 장비와 안전한 환경이 있어요",
  SWIMMING_ABILITY_AND_WATER_SAFETY: "이 훈련을 할 수 있는 수영 능력과 안전한 환경이 있어요",
  HILL_SURFACE_GRADE_RETURN: "언덕의 경사·노면과 안전한 복귀 길을 확인했어요",
  CONNECTED_HILL_FLAT_ROUTE: "언덕과 평지를 이어 달릴 안전한 코스가 있어요",
  COMPOUND_TRAINING_EXPERIENCE: "서로 다른 강도를 묶은 복합 훈련 경험이 있어요",
  HIGH_INTENSITY_REPETITION_EXPERIENCE: "짧고 강한 반복 훈련 경험이 있어요",
}

const environmentRequirements = new Set([
  "ACCELERATION_AND_DECELERATION_SPACE", "BIKE_AVAILABLE", "ELLIPTICAL_AVAILABLE",
  "WATER_SAFETY_AND_EQUIPMENT", "SWIMMING_ABILITY_AND_WATER_SAFETY",
  "HILL_SURFACE_GRADE_RETURN", "CONNECTED_HILL_FLAT_ROUTE",
])
export function isCatalogEnvironmentRequirement(requirement: string): boolean {
  return environmentRequirements.has(requirement)
}

export type CatalogScheduleCondition = {
  readonly key: string
  readonly day: number
  readonly slot: "AM" | "PM"
  readonly date: string
  readonly requirements: readonly string[]
}

/** Temporary UI review identity, not persisted proof of a future environment. */
export function catalogScheduleConditions(generated: PlanGenerationSuccess, startDate: string,
  accountScope: string | null): readonly CatalogScheduleCondition[] {
  if (!isValidIsoDate(startDate)) return []
  const found = new Map<string, CatalogScheduleCondition>()
  for (const candidate of generated.candidates) {
    for (const session of candidate.sessions) {
      const binding = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout : undefined
      const requirements = binding?.inputs.confirmedRequirements.filter(isCatalogEnvironmentRequirement).sort() ?? []
      if (!binding || !requirements.length) continue
      const date = isoShift(startDate, session.day - 1)
      const key = canonicalJsonFingerprint("catalog-schedule-condition-v1", {
        accountScope, date, day: session.day, slot: session.slot, binding,
      })
      found.set(key, { key, day: session.day, slot: session.slot, date, requirements })
    }
  }
  return [...found.values()]
}
