import { mapD9ResultToRveSignal } from "../../src/rve/signal"
import { decideSafetyGate } from "../../src/safety-gate/gate"
import type { SafetyGateDecision } from "../../src/safety-gate/gate"
import type {
  PlanGenerationResult,
  PlanGenerationSuccess,
} from "../../src/plan-generator/types"
import { canonicalFormation } from "./canonical-formation"

export function clearedGate() {
  const gate = decideSafetyGate(
    mapD9ResultToRveSignal({
      disposition: "D9_CLEARED",
      blocksPlanGeneration: false,
      reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
      evidence: [],
    }),
  )

  if (gate.kind !== "passed") {
    throw new Error("Expected cleared fixture to pass the Safety Gate")
  }

  return gate
}

export function activeGate() {
  return decideSafetyGate(
    mapD9ResultToRveSignal({
      disposition: "D9_ACTIVE",
      blocksPlanGeneration: true,
      reasonCodes: ["D9_ACTIVE_MANUAL_OR_MEDICAL_HOLD"],
      evidence: [],
    }),
  )
}

export function unknownGate() {
  return decideSafetyGate(
    mapD9ResultToRveSignal({
      disposition: "D9_UNKNOWN",
      blocksPlanGeneration: true,
      reasonCodes: ["D9_UNKNOWN_PAIN_WORSENING"],
      evidence: [],
    }),
  )
}

export function baseRequest(
  safetyGate: SafetyGateDecision = clearedGate(),
  mainTrainingDays: readonly [number, number] = [3, 7],
) {
  return {
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate,
    profile: {
      eventGroup: "MIDDLE_DISTANCE",
      eventDistanceM: 1500,
      experienceBand: "DEVELOPING",
      availableTrainingDays: [1, 3, 5, 7, 9],
    },
    formation: canonicalFormation(mainTrainingDays),
    journalSource: {
      kind: "NO_USABLE_JOURNAL",
    },
    selectionAuthority: "SELF",
    selectedEnergyIntent: "LT_INTENT",
  }
}

export function expectGenerated(result: PlanGenerationResult): PlanGenerationSuccess {
  if (result.kind !== "generated") {
    throw new Error(`Expected generated plan result, received ${result.kind}`)
  }

  return result
}
