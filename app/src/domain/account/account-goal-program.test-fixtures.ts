import { generateGoalTrainingProgram } from "../goal-training-program"
import { evaluateD9ColloquialLayer } from "@impl/d9/evaluator"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import type { StoredGoalTrainingProgram } from "../goal-training-program-document"

/** Synthetic, reproducible public-contract fixture; no athlete/account data. */
const fixtures = new Map<number, StoredGoalTrainingProgram>()
export function syntheticGoalProgram(index = 0): StoredGoalTrainingProgram {
  const cached = fixtures.get(index)
  if (cached) return structuredClone(cached)
  const generatedAt = `2026-10-10T00:${String(index).padStart(2, "0")}:00.000Z`
  const result = generateGoalTrainingProgram({ goalMinutes: 45, dateChoice: { kind: "START", startDate: "2026-10-11" },
    today: "2026-10-10", generatedAt, experienceBand: "DEVELOPING", availableDayCount: 4,
    trainingTimePreference: "VARIES", longerDurationConfirmed: true,
    safetyGate: decideSafetyGate(mapD9ResultToRveSignal(evaluateD9ColloquialLayer("통증 없음 몸 상태 정상"))) })
  if (result.kind !== "ready") throw Error("Synthetic program unavailable")
  const document: StoredGoalTrainingProgram = { version: 1, revision: 0, program: result.program, application: null,
    cycles: [
      { cycle: 1, status: "PENDING", latestPlan: null, lineage: [] },
      { cycle: 2, status: "PENDING", latestPlan: null, lineage: [] },
      { cycle: 3, status: "PENDING", latestPlan: null, lineage: [] },
    ] }
  fixtures.set(index, document)
  return structuredClone(document)
}
