import { describe, expect, it } from "vitest"
import type { PlannedSessionLink } from "./planned-session-link"
import { derivePlanExecutionRelation } from "./plan-execution-relation"

const pmPlanLink = { sessionSlot: "PM" } as PlannedSessionLink

describe("plan execution relation", () => {
  it("does not call an AM result AS_PLANNED for a linked PM session", () => {
    expect(derivePlanExecutionRelation("COMPLETED", "AM", pmPlanLink)).toBe("MODIFIED")
  })

  it("requires a matching selected slot before calling a completed linked result AS_PLANNED", () => {
    expect(derivePlanExecutionRelation("COMPLETED", "PM", pmPlanLink)).toBe("AS_PLANNED")
    expect(derivePlanExecutionRelation("COMPLETED", "UNSPECIFIED", pmPlanLink)).toBe("UNKNOWN")
    expect(derivePlanExecutionRelation("COMPLETED", undefined, pmPlanLink)).toBe("UNKNOWN")
  })

  it("leaves unlinked results outside plan-execution comparison", () => {
    expect(derivePlanExecutionRelation("COMPLETED", "PM", undefined)).toBe("NOT_APPLICABLE")
  })
})
