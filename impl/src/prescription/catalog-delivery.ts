import type { WorkoutCatalogEntry } from "./all-workout-calculator"
import type { SequenceNodeV3 } from "./sequence-v3"

// Presentation priority is not a training-effect, safety or physiological score.
export const CATALOG_DELIVERY_VERSION = "1.0.0"
export type CatalogDeliveryProfile = {
  readonly version: typeof CATALOG_DELIVERY_VERSION
  readonly name: string
  readonly purpose: string
  readonly tier: "STANDARD" | "CONFIRM_FIRST" | "STRUCTURED"
  readonly complexity: number
  readonly sourceRefs: readonly string[]
}

const names: Readonly<Record<string, string>> = {
  "BASE:CONTINUOUS": "이지런",
  "BASE:EASY_CONTINUOUS": "이지런",
  "BASE:WALK_BREAKS": "중간에 걷는 조깅",
  "LT:CONTINUOUS": "템포런",
  "LT:CRUISE_INTERVALS": "크루즈 인터벌",
  "LT:LONG_SPLIT": "크루즈 인터벌",
  "LT:SHORT_SPLIT": "크루즈 인터벌",
  "VO2:TWO_MINUTE": "2분 인터벌",
  "VO2:THREE_MINUTE": "3분 인터벌",
  "VO2:FOUR_MINUTE": "4분 인터벌",
  "ATP-PC:STANDING_ACCELERATION": "가속 달리기",
  "ATP-PC:TIMED_ACCELERATION": "가속 달리기",
  "MIX:TIMED_RHYTHM": "변속주",
  "MIX:TIMED_RHYTHM_SETS": "세트형 변속주",
  "REC:WALK": "회복 걷기",
  "REC:RECOVERY_JOG": "회복 조깅",
  "REC:RECOVERY_RUN_WALK": "회복 조깅·걷기",
  "REC:RECOVERY_BIKE": "회복 자전거",
  "REC:RECOVERY_ELLIPTICAL": "회복 일립티컬",
  "REC:RECOVERY_DEEP_WATER": "수중 조깅",
  "REC:RECOVERY_SWIM": "회복 수영",
  "OFF:NO_PLANNED_EXERCISE": "휴식",
}

// Product delivery order, not a claim that these methods produce better results.
const standardFirst = new Set([
  "BASE:CONTINUOUS", "BASE:EASY_CONTINUOUS", "BASE:WALK_BREAKS",
  "LT:CONTINUOUS", "LT:LONG_SPLIT", "LT:SHORT_SPLIT", "LT:CRUISE_INTERVALS",
  "VO2:TWO_MINUTE", "VO2:THREE_MINUTE", "VO2:FOUR_MINUTE", "VO2:AEROBIC_INTERVALS",
  "ATP-PC:STANDING_ACCELERATION", "ATP-PC:TIMED_ACCELERATION", "GLY:UNBROKEN_REPEATS",
  "MIX:TIMED_RHYTHM", "REC:WALK", "REC:RECOVERY_JOG", "REC:RECOVERY_RUN_WALK",
  "OFF:NO_PLANNED_EXERCISE",
])
const purposes: Readonly<Record<string, string>> = {
  BASE: "편한 속도로 달리는 시간을 쌓는 훈련이에요.",
  LT: "힘든 속도에서도 페이스를 고르게 유지하는 연습이에요.",
  VO2: "빠른 달리기 구간을 반복하며 지구력을 기르는 훈련이에요.",
  "ATP-PC": "짧은 구간에서 빠른 움직임을 연습해요.",
  GLY: "강한 달리기 구간에서 속도를 유지하는 연습이에요.",
  MIX: "서로 다른 속도나 운동 구간을 이어 가는 훈련이에요.",
  REC: "부담을 낮춰 가볍게 움직이는 일정이에요.",
  OFF: "별도의 훈련 없이 쉬는 날이에요.",
}

export function catalogDeliveryProfile(entry: WorkoutCatalogEntry): CatalogDeliveryProfile {
  const workShapes = new Set<string>()
  let sets = 0
  const inspect = (nodes: readonly SequenceNodeV3[]) => {
    for (const node of nodes) {
      if (node.kind === "group") {
        if (node.repeatUnit === "SET" && node.repeatCount > 1) sets++
        inspect(node.children)
      } else {
        const context = entry.segments.find(segment => segment.segmentId === node.id)
        workShapes.add(JSON.stringify({ work: node.work, target: node.target, role: node.role,
          intent: context?.intent, modality: context?.modality, terrain: context?.terrain }))
      }
    }
  }
  inspect(entry.sequence?.main ?? [])
  const complexity = Math.max(0, workShapes.size - 1) + sets
  return {
    version: CATALOG_DELIVERY_VERSION,
    name: names[entry.methodGroup] ?? entry.name.split(" · ")[0]!,
    purpose: entry.segments.some(segment => segment.intent === "RACE_PACE")
      ? "선택한 경기 기록의 평균 속도를 구간별로 맞추는 연습이에요."
      : purposes[entry.family] ?? entry.explanation.purpose,
    tier: entry.requirements.length || entry.hold ? "CONFIRM_FIRST" : !complexity && standardFirst.has(entry.methodGroup) ? "STANDARD" : "STRUCTURED",
    complexity,
    sourceRefs: entry.sourceRefs,
  }
}

/** Call only after the existing eligibility, duration and intensity checks. */
export function preferredCatalogEntries(entries: readonly WorkoutCatalogEntry[]): readonly WorkoutCatalogEntry[] {
  if (!entries.length) return []
  const ranks = { STANDARD: 0, STRUCTURED: 1, CONFIRM_FIRST: 2 }
  const bestTier = Math.min(...entries.map(entry => ranks[catalogDeliveryProfile(entry).tier]))
  const tier = entries.filter(entry => ranks[catalogDeliveryProfile(entry).tier] === bestTier)
  const complexity = Math.min(...tier.map(entry => catalogDeliveryProfile(entry).complexity))
  return tier.filter(entry => catalogDeliveryProfile(entry).complexity === complexity)
}
