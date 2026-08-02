import { describe, expect, it } from "vitest"
import {
  compileExposureLedger,
  generatePlanCandidates,
} from "../src/index"

describe("public typed MAIN ledger boundary", () => {
  it("exports the ledger compiler as a data-only helper beside candidate generation", () => {
    expect(typeof compileExposureLedger).toBe("function")
    expect(typeof generatePlanCandidates).toBe("function")
  })
})
