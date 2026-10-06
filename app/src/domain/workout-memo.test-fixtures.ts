import type { PlanSession } from "@impl/plan-generator/types"
import { adjustedMethodResolutionFixture } from "./adjusted-method-resolution.test-fixtures"

export function memoSessionFixture(): PlanSession {
  return { day: 3, slot: "PM", role: "QUALITY", plannedEnergyIntent: "VO2_INTENT", prescription: adjustedMethodResolutionFixture().original }
}
