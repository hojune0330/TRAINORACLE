import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generateReplacementPlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { generatePlanCandidates } from "@impl/plan-generator/generator"

vi.mock("@impl/plan-generator/generator", async importOriginal => {
  const actual = await importOriginal<typeof import("@impl/plan-generator/generator")>()
  return { ...actual, generatePlanCandidates: vi.fn(actual.generatePlanCandidates) }
})

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-01T03:00:00.000Z")) })
afterEach(() => { vi.useRealTimers(); localStorage.clear(); sessionStorage.clear() })

describe("explicit new-start plan draft", () => {
  it("uses the chosen future formation date without clearing the active plan or completing its frame", () => {
    const before = stateFixture()
    const oldRaw = JSON.stringify(before)
    localStorage.setItem(activePlanBetaStorageKey(), oldRaw)
    const result = generateReplacementPlanFromDraft({ ...before.intake, startDate: "2026-10-05" }, "NO_KNOWN_RISK")
    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") throw Error(result.kind)
    expect(result.intake.startDate).toBe("2026-10-05")
    expect(result.generated.candidates[0].continuityContext.kind).toBe("NO_PREVIOUS_FRAME_CONTEXT")
    expect(generatePlanCandidates).toHaveBeenCalledWith(expect.objectContaining({ formation: expect.objectContaining({
      slots: expect.arrayContaining([expect.objectContaining({ slotIndex: 0, localDayKey: "2026-10-05", slot: "AM" })]),
    }) }))
    const selected = selectPlanForActivation(result.generated.candidates[0].candidateId, result.generated, result.gate, result.intake, result.athleteEvidence)
    expect(selected.kind).toBe("selected")
    if (selected.kind !== "selected") throw Error(selected.code)
    expect(selected.state.intake.startDate).toBe("2026-10-05")
    expect(planBetaStateV3Schema.safeParse(selected.state).success).toBe(true)
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(oldRaw)
  })

  it.each([undefined, "", "2026-09-30", "2026-02-30"])("rejects a missing, past or impossible date: %s", startDate => {
    const result = generateReplacementPlanFromDraft({ ...stateFixture().intake, ...(startDate === undefined ? {} : { startDate }) }, "NO_KNOWN_RISK")
    expect(result).toEqual({ kind: "rejected", code: "INVALID_START_DATE" })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBeNull()
  })
})
